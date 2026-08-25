import pg from "pg";
import crypto from "crypto";
const { Pool } = pg;
const pool = globalThis.__nroraPaymentsPool || new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10000 });
globalThis.__nroraPaymentsPool = pool;
const SECRET = process.env.SESSION_SECRET || "change-this-session-secret-in-vercel";
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const json=(res,status,body)=>res.status(status).json(body);
const readToken=t=>{try{const [p,s]=String(t||"").split(".");const u=JSON.parse(Buffer.from(p,"base64url").toString());const e=crypto.createHmac("sha256",SECRET).update(`${u.id}:${u.username}:${u.role}`).digest("hex");if(!s||s.length!==e.length||!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(e))||u.exp<Date.now())return null;return u}catch{return null}};
const requireAuth=(req,res)=>{const t=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");const u=readToken(t);if(!u||!["admin","division_manager","area_manager","tl","staff"].includes(u.role)){json(res,401,{error:"Unauthorized"});return null}return u};
async function razor(path,method="GET",body){
  if(!RAZORPAY_KEY_ID||!RAZORPAY_KEY_SECRET) throw new Error("Razorpay is not configured in Vercel.");
  const auth=Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  const r=await fetch(`https://api.razorpay.com/v1${path}`,{method,headers:{Authorization:`Basic ${auth}`,"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
  const data=await r.json();
  if(!r.ok) throw new Error(data?.error?.description||`Razorpay request failed (${r.status})`);
  return data;
}
async function schema(){
  await pool.query("alter table payments add column if not exists status varchar(30) not null default 'pending'");
  await pool.query("alter table payments add column if not exists gateway_order_id varchar(120) default ''");
  await pool.query("alter table payments add column if not exists gateway_payment_id varchar(120) default ''");
  await pool.query("create unique index if not exists payments_gateway_order_idx on payments(gateway_order_id) where gateway_order_id <> ''");
  await pool.query("create unique index if not exists payments_gateway_payment_idx on payments(gateway_payment_id) where gateway_payment_id <> ''");
}
async function receipt(customerId,paymentId){
  const old=await pool.query("select * from receipts where payment_id=$1 limit 1",[paymentId]);
  if(old.rowCount)return old.rows[0];
  const no="NR-"+new Date().getFullYear()+"-"+crypto.randomBytes(4).toString("hex").toUpperCase();
  const r=await pool.query("insert into receipts(customer_id,payment_id,receipt_no) values($1,$2,$3) returning *",[customerId,paymentId,no]);
  return r.rows[0];
}
async function capture(orderId,paymentId,amount,method){
  const q=await pool.query("select * from payments where gateway_order_id=$1 limit 1",[orderId]);
  if(!q.rowCount)return null;
  const p=q.rows[0];
  if(Number(amount)!==Number(p.amount))return null;
  const u=await pool.query("update payments set status='captured',gateway_payment_id=$1,transaction_ref=$2,method=$3,paid_at=now() where id=$4 returning *",[paymentId,paymentId,String(method||"UPI").toUpperCase(),p.id]);
  return {payment:u.rows[0],receipt:await receipt(p.customer_id,p.id)};
}
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  if(req.method==="OPTIONS")return res.status(204).end();
  try{
    const u=requireAuth(req,res); if(!u)return;
    await schema();
    let path=req.query?.path; if(Array.isArray(path))path=path.join("/"); else path=String(path||""); path=path.replace(/^\/+|\/+$/g,"");
    if(req.method==="POST"&&path==="create-order"){
      const customerId=Number(req.body?.customer_id); if(!customerId)return json(res,400,{error:"customer_id is required"});
      const c=await pool.query("select id,name,phone,vehicle_no from customers where id=$1",[customerId]); if(!c.rowCount)return json(res,404,{error:"Customer not found"});
      const order=await razor("/orders","POST",{amount:450000,currency:"INR",receipt:`NRORA-${customerId}-${Date.now()}`,payment_capture:1,notes:{customer_id:String(customerId),customer_name:c.rows[0].name,vehicle_no:c.rows[0].vehicle_no}});
      const p=await pool.query("insert into payments(customer_id,amount,method,transaction_ref,status,gateway_order_id) values($1,4500,'UPI','', 'pending',$2) returning *",[customerId,order.id]);
      return json(res,201,{orderId:order.id,keyId:RAZORPAY_KEY_ID,amount:450000,currency:"INR",paymentId:p.rows[0].id,customer:c.rows[0]});
    }
    if(req.method==="POST"&&path==="verify"){
      const {razorpay_order_id,razorpay_payment_id,razorpay_signature}=req.body||{};
      if(!razorpay_order_id||!razorpay_payment_id||!razorpay_signature)return json(res,400,{error:"Incomplete payment verification data"});
      const expected=crypto.createHmac("sha256",RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
      if(expected!==razorpay_signature)return json(res,400,{error:"Payment signature verification failed"});
      const p=await razor(`/payments/${encodeURIComponent(razorpay_payment_id)}`);
      if(p.status!=="captured")return json(res,409,{error:`Payment is ${p.status}. Receipt will be created only after capture.`});
      const done=await capture(razorpay_order_id,razorpay_payment_id,Number(p.amount)/100,p.method);
      if(!done)return json(res,409,{error:"Payment could not be confirmed"});
      return json(res,200,done);
    }
    if(req.method==="GET"&&path==="status"){
      const orderId=String(req.query?.order_id||""); if(!orderId)return json(res,400,{error:"order_id is required"});
      const r=await pool.query("select p.*,c.name customer_name,c.phone,c.vehicle_no,r.receipt_no,r.created_at receipt_created_at from payments p left join customers c on c.id=p.customer_id left join receipts r on r.payment_id=p.id where p.gateway_order_id=$1 limit 1",[orderId]);
      if(!r.rowCount)return json(res,404,{error:"Payment not found"});
      return json(res,200,r.rows[0]);
    }
    return json(res,404,{error:"Not found"});
  }catch(e){console.error(e);return json(res,500,{error:e?.message||"Internal server error"});}
}
