import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";
import crypto from "crypto";

dotenv.config();
const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 4000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-session-secret-in-vercel";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "NRORA@123";
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "";
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";
const MEMBERSHIP_AMOUNT = 4500;

app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(",") || "*" }));
app.post("/api/payments/webhook", express.raw({type:"application/json"}), async (req,res)=>{
  try {
    if(!RAZORPAY_WEBHOOK_SECRET) return res.status(200).json({ok:true,configured:false});
    const signature=req.headers["x-razorpay-signature"]||"";
    const expected=crypto.createHmac("sha256",RAZORPAY_WEBHOOK_SECRET).update(req.body).digest("hex");
    if(!signature || !crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected))) return res.status(400).json({error:"Invalid webhook signature"});
    const event=JSON.parse(req.body.toString("utf8"));
    const p=event.payload?.payment?.entity;
    if(event.event==="payment.captured" && p?.id){
      await finalizeCapturedPayment({orderId:p.order_id,paymentId:p.id,amount:Number(p.amount||0)/100,method:(p.method||"UPI").toUpperCase(),transactionRef:p.id});
    }
    if(event.event==="payment.failed" && p?.order_id) await pool.query("update payments set status='failed' where gateway_order_id=$1",[p.order_id]);
    res.status(200).json({ok:true});
  } catch(err){ console.error("Razorpay webhook error",err); res.status(500).json({error:"Webhook processing failed"}); }
});
app.use(express.json());
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const hashPassword = password => crypto.createHash("sha256").update(`${SESSION_SECRET}:${password}`).digest("hex");
const makeToken = user => Buffer.from(JSON.stringify({id:user.id,username:user.username,role:user.role,exp:Date.now()+1000*60*60*12})).toString("base64url")+"."+crypto.createHmac("sha256",SESSION_SECRET).update(`${user.id}:${user.username}:${user.role}`).digest("hex");
const readToken = token => { try { const [payload,sig]=token.split("."); const u=JSON.parse(Buffer.from(payload,"base64url").toString()); const expected=crypto.createHmac("sha256",SESSION_SECRET).update(`${u.id}:${u.username}:${u.role}`).digest("hex"); if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)) || u.exp<Date.now()) return null; return u; } catch { return null; } };
const auth = (roles=[]) => (req,res,next) => { const token=req.headers.authorization?.replace(/^Bearer\s+/i,""); const user=token&&readToken(token); if(!user || (roles.length && !roles.includes(user.role))) return res.status(401).json({error:"Unauthorized"}); req.user=user; next(); };

async function ensurePaymentSchema(){
  await pool.query("alter table payments add column if not exists status varchar(30) not null default 'pending'");
  await pool.query("alter table payments add column if not exists gateway_order_id varchar(120) default ''");
  await pool.query("alter table payments add column if not exists gateway_payment_id varchar(120) default ''");
  await pool.query("create unique index if not exists payments_gateway_order_idx on payments(gateway_order_id) where gateway_order_id <> ''");
  await pool.query("create unique index if not exists payments_gateway_payment_idx on payments(gateway_payment_id) where gateway_payment_id <> ''");
}
async function ensureAdmin(){
  await pool.query(`create table if not exists users(id bigserial primary key,username varchar(80) unique not null,password_hash text not null,role varchar(20) not null default 'employee',name varchar(120) not null,phone varchar(20) default '',active boolean default true,created_at timestamptz default now())`);
  const r=await pool.query("select id from users where username=$1",[ADMIN_USERNAME]);
  if(!r.rowCount) await pool.query("insert into users(username,password_hash,role,name) values($1,$2,'admin',$3)",[ADMIN_USERNAME,hashPassword(ADMIN_PASSWORD),"NRORA Admin"]);
}
async function razorpayRequest(path,method="GET",body){
  if(!RAZORPAY_KEY_ID||!RAZORPAY_KEY_SECRET) throw Object.assign(new Error("Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel."),{statusCode:503});
  const authHeader=Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
  const r=await fetch(`https://api.razorpay.com/v1${path}`,{method,headers:{Authorization:`Basic ${authHeader},Content-Type":"application/json"},body:body?JSON.stringify(body):undefined});
  const data=await r.json(); if(!r.ok) throw Object.assign(new Error(data.error?.description||"Razorpay request failed"),{statusCode:r.status}); return data;
}
async function makeReceipt(customerId,paymentId){
  const existing=await pool.query("select * from receipts where payment_id=$1 limit 1",[paymentId]);
  if(existing.rowCount) return existing.rows[0];
  const receiptNo="NR-"+new Date().getFullYear()+"-"+crypto.randomBytes(4).toString("hex").toUpperCase();
  const r=await pool.query("insert into receipts(customer_id,payment_id,receipt_no) values($1,$2,$3) returning *",[customerId,paymentId,receiptNo]);
  return r.rows[0];
}
async function finalizeCapturedPayment({orderId,paymentId,amount,method="UPI",transactionRef=paymentId}){
  const q=await pool.query("select * from payments where gateway_order_id=$1 or gateway_payment_id=$2 limit 1",[orderId||"",paymentId||""]);
  if(!q.rowCount) return null;
  const current=q.rows[0];
  if(Number(amount) && Number(current.amount)!==Number(amount)) return null;
  const updated=await pool.query("update payments set status='captured',gateway_payment_id=$1,transaction_ref=$2,method=$3,paid_at=now() where id=$4 returning *",[paymentId,transactionRef,method,current.id]);
  const receipt=await makeReceipt(current.customer_id,current.id);
  return {payment:updated.rows[0],receipt};
}

app.get("/api/health", asyncRoute(async (_req,res) => { const r=await pool.query("select now() as now"); res.json({ok:true,service:"nrroadcare-api",time:r.rows[0].now,paymentsConfigured:Boolean(RAZORPAY_KEY_ID&&RAZORPAY_KEY_SECRET)}); }));
app.post("/api/auth/login", asyncRoute(async (req,res)=>{ const {username,password}=req.body; if(!username||!password) return res.status(400).json({error:"Username and password are required"}); const r=await pool.query("select * from users where username=$1 and active=true",[username]); const u=r.rows[0]; if(!u||u.password_hash!==hashPassword(password)) return res.status(401).json({error:"Invalid username or password"}); res.json({token:makeToken(u),user:{id:u.id,username:u.username,role:u.role,name:u.name,phone:u.phone}}); }));
app.get("/api/auth/me",auth(),asyncRoute(async(req,res)=>res.json({user:req.user})));
app.get("/api/employees",auth(["admin"]),asyncRoute(async(_req,res)=>{const r=await pool.query("select id,username,role,name,phone,active,created_at from users where role='employee' order by created_at desc");res.json(r.rows);}));
app.post("/api/employees",auth(["admin"]),asyncRoute(async(req,res)=>{const {username,password,name,phone=""}=req.body;if(!username||!password||!name)return res.status(400).json({error:"name, username and password are required"});const r=await pool.query("insert into users(username,password_hash,role,name,phone) values($1,$2,'employee',$3,$4) returning id,username,role,name,phone,active",[username,hashPassword(password),name,phone]);res.status(201).json(r.rows[0]);}));
app.patch("/api/employees/:id",auth(["admin"]),asyncRoute(async(req,res)=>{const {active}=req.body;const r=await pool.query("update users set active=$1 where id=$2 and role='employee' returning id,username,role,name,phone,active",[Boolean(active),req.params.id]);res.json(r.rows[0]||null);}));
app.get("/api/dashboard", auth(), asyncRoute(async (_req,res) => { const [customers,requests,technicians,payments]=await Promise.all([pool.query("select count(*)::int as count from customers"),pool.query("select count(*)::int as count from service_requests where status <> 'closed'"),pool.query("select count(*)::int as count from technicians where active=true"),pool.query("select coalesce(sum(amount),0)::numeric as total from payments where status='captured'")]);res.json({customers:customers.rows[0].count,activeRequests:requests.rows[0].count,techniciansOnline:technicians.rows[0].count,revenue:Number(payments.rows[0].total)}); }));
app.get("/api/customers",auth(),asyncRoute(async(_req,res)=>{const r=await pool.query("select * from customers order by created_at desc");res.json(r.rows);}));
app.post("/api/customers",auth(["admin","employee"]),asyncRoute(async(req,res)=>{const {name,phone,address="",vehicle_no=""}=req.body;if(!name||!phone||!vehicle_no)return res.status(400).json({error:"name, phone and vehicle_no are required"});const r=await pool.query("insert into customers(name,phone,address,vehicle_no) values($1,$2,$3,$4) returning *",[name,phone,address,vehicle_no]);res.status(201).json(r.rows[0]);}));
app.delete("/api/customers/:id",auth(["admin"]),asyncRoute(async(req,res)=>{await pool.query("delete from customers where id=$1",[req.params.id]);res.status(204).end();}));
app.get("/api/requests",auth(),asyncRoute(async(_req,res)=>{const r=await pool.query(`select sr.*, c.name customer_name, c.phone customer_phone from service_requests sr left join customers c on c.id=sr.customer_id order by sr.created_at desc`);res.json(r.rows);}));
app.post("/api/requests",auth(["admin","employee"]),asyncRoute(async(req,res)=>{const {customer_id,location="",description=""}=req.body;const r=await pool.query("insert into service_requests(customer_id,location,description) values($1,$2,$3) returning *",[customer_id||null,location,description]);res.status(201).json(r.rows[0]);}));
app.patch("/api/requests/:id",auth(["admin","employee"]),asyncRoute(async(req,res)=>{const {status,assigned_technician}=req.body;const r=await pool.query("update service_requests set status=coalesce($1,status),assigned_technician=coalesce($2,assigned_technician) where id=$3 returning *",[status,assigned_technician,req.params.id]);res.json(r.rows[0]||null);}));
app.get("/api/technicians",auth(),asyncRoute(async(_req,res)=>{const r=await pool.query("select * from technicians order by name");res.json(r.rows);}));
app.post("/api/technicians",auth(["admin"]),asyncRoute(async(req,res)=>{const {name,phone,specialization=""}=req.body;if(!name||!phone)return res.status(400).json({error:"name and phone are required"});const r=await pool.query("insert into technicians(name,phone,specialization) values($1,$2,$3) returning *",[name,phone,specialization]);res.status(201).json(r.rows[0]);}));

app.post("/api/payments/create-order",auth(["admin","employee"]),asyncRoute(async(req,res)=>{
  const customerId=Number(req.body.customer_id); if(!customerId) return res.status(400).json({error:"customer_id is required"});
  const c=await pool.query("select id,name,phone,vehicle_no from customers where id=$1",[customerId]); if(!c.rowCount) return res.status(404).json({error:"Customer not found"});
  const order=await razorpayRequest("/orders","POST",{amount:MEMBERSHIP_AMOUNT*100,currency:"INR",receipt:`NRORA-${customerId}-${Date.now()}`,payment_capture:1,notes:{customer_id:String(customerId),customer_name:c.rows[0].name,vehicle_no:c.rows[0].vehicle_no}});
  const payment=await pool.query("insert into payments(customer_id,amount,method,transaction_ref,status,gateway_order_id) values($1,$2,'UPI','',$3,$4) returning *",[customerId,MEMBERSHIP_AMOUNT,"pending",order.id]);
  let qr=null;
  try { qr=await razorpayRequest("/payments/qr_codes","POST",{type:"upi_qr",name:`NRORA ${c.rows[0].name}`,usage:"single_use",fixed_amount:true,payment_amount:MEMBERSHIP_AMOUNT*100,description:`NRORA yearly membership - ${c.rows[0].vehicle_no}`,close_by:Math.floor(Date.now()/1000)+7200,notes:{payment_id:String(payment.rows[0].id),customer_id:String(customerId)}}); } catch(e){ console.warn("Razorpay QR unavailable:",e.message); }
  res.status(201).json({orderId:order.id,keyId:RAZORPAY_KEY_ID,amount:MEMBERSHIP_AMOUNT*100,currency:"INR",paymentId:payment.rows[0].id,qr:qr?{id:qr.id,image_url:qr.image_url||qr.image_content,status:qr.status}:null,customer:c.rows[0]});
}));
app.post("/api/payments/verify",auth(["admin","employee"]),asyncRoute(async(req,res)=>{
  const {razorpay_order_id,razorpay_payment_id,razorpay_signature}=req.body; if(!razorpay_order_id||!razorpay_payment_id||!razorpay_signature) return res.status(400).json({error:"Incomplete payment verification data"});
  const q=await pool.query("select * from payments where gateway_order_id=$1 limit 1",[razorpay_order_id]); if(!q.rowCount) return res.status(404).json({error:"Payment order not found"});
  const expected=crypto.createHmac("sha256",RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex"); if(!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(razorpay_signature))) return res.status(400).json({error:"Payment signature verification failed"});
  const r=await razorpayRequest(`/payments/${encodeURIComponent(razorpay_payment_id)}`); if(r.status!=="captured") return res.status(409).json({error:`Payment is ${r.status}. Receipt will be created only after capture.`});
  const done=await finalizeCapturedPayment({orderId:razorpay_order_id,paymentId:razorpay_payment_id,amount:Number(r.amount)/100,method:(r.method||"UPI").toUpperCase(),transactionRef:razorpay_payment_id}); if(!done) return res.status(409).json({error:"Payment could not be confirmed"}); res.json(done);
}));
app.get("/api/payments/status",auth(["admin","employee"]),asyncRoute(async(req,res)=>{const orderId=String(req.query.order_id||""); if(!orderId) return res.status(400).json({error:"order_id is required"}); const r=await pool.query("select p.*,c.name customer_name,c.phone,c.vehicle_no,r.receipt_no,r.created_at receipt_created_at from payments p left join customers c on c.id=p.customer_id left join receipts r on r.payment_id=p.id where p.gateway_order_id=$1 limit 1",[orderId]); if(!r.rowCount)return res.status(404).json({error:"Payment not found"}); res.json(r.rows[0]);}));
app.post("/api/payments",auth(["admin","employee"]),asyncRoute(async(req,res)=>{return res.status(410).json({error:"Manual payment confirmation is disabled. Use the secure payment gateway."});}));
app.post("/api/memberships/renew",auth(["admin","employee"]),asyncRoute(async(req,res)=>{const {customer_id,renewal_date}=req.body;if(!customer_id||!renewal_date)return res.status(400).json({error:"customer_id and renewal_date are required"});const r=await pool.query("insert into memberships(customer_id,amount,renewal_date) values($1,4500,$2) returning *",[customer_id,renewal_date]);res.status(201).json(r.rows[0]);}));
app.use((err,_req,res,_next)=>{console.error(err);res.status(err.statusCode||500).json({error:err.message||"Internal server error"});});
ensurePaymentSchema().then(ensureAdmin).then(()=>app.listen(port,()=>console.log(`NRORA API running on ${port}`))).catch(err=>{console.error("Startup failed",err);process.exit(1)});
