import pg from "pg";
import crypto from "crypto";
const { Pool } = pg;
const pool = globalThis.__nroraRequestsPool || new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10000 });
globalThis.__nroraRequestsPool = pool;
const SECRET = process.env.SESSION_SECRET || "change-this-session-secret-in-vercel";
const allowed = ["admin","division_manager","area_manager","tl","staff","telecaller"];
const json=(res,status,body)=>res.status(status).json(body);
function auth(req){
  const t=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  if(!t) return null;
  try{
    const [p,s]=t.split(".");
    const u=JSON.parse(Buffer.from(p,"base64url").toString());
    const sig=crypto.createHmac("sha256",SECRET).update(`${u.id}:${u.username}:${u.role}`).digest("hex");
    if(!s||s.length!==sig.length||!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(sig))||u.exp<Date.now()||!allowed.includes(u.role)) return null;
    return u;
  }catch{return null}
}
async function ensure(){
  await pool.query(`create table if not exists service_requests(id bigserial primary key,customer_id bigint references customers(id) on delete set null,status varchar(30) default 'pending',location text default '',description text default '',assigned_technician varchar(120) default '',created_at timestamptz default now())`);
  await pool.query(`create table if not exists mechanic_orders(id bigserial primary key,request_id bigint unique references service_requests(id) on delete cascade,technician_id bigint references technicians(id) on delete set null,technician_name varchar(120) default '',status varchar(30) default 'sent',assigned_by bigint,created_at timestamptz default now(),accepted_at timestamptz,started_at timestamptz,completed_at timestamptz)`);
}
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,PATCH,OPTIONS");
  if(req.method==="OPTIONS") return res.status(204).end();
  const u=auth(req); if(!u) return json(res,401,{error:"Unauthorized"});
  try{
    await ensure();
    if(req.method==="GET"){
      const r=await pool.query(`select sr.*,c.name customer_name,c.phone customer_phone,c.vehicle_no,mo.status mechanic_order_status,mo.technician_id,mo.technician_name from service_requests sr left join customers c on c.id=sr.customer_id left join mechanic_orders mo on mo.request_id=sr.id order by sr.created_at desc`);
      return json(res,200,r.rows);
    }
    const id=req.query?.id;
    if(req.method==="POST"){
      const {customer_id,location="",description=""}=req.body||{};
      if(!customer_id) return json(res,400,{error:"Customer is required"});
      const c=await pool.query("select id from customers where id=$1 and coalesce(account_status,'active')='active'",[customer_id]);
      if(!c.rowCount) return json(res,400,{error:"Verified active customer is required"});
      const r=await pool.query("insert into service_requests(customer_id,location,description) values($1,$2,$3) returning *",[customer_id,location,description]);
      return json(res,201,r.rows[0]);
    }
    if(req.method==="PATCH"){
      if(!id) return json(res,400,{error:"Request id is required"});
      const {status,assigned_technician}=req.body||{};
      const valid=["pending","assigned","on_the_way","completed","closed"];
      if(status && !valid.includes(status)) return json(res,400,{error:"Invalid request status"});
      if(assigned_technician!==undefined){
        if(!assigned_technician) {
          await pool.query("delete from mechanic_orders where request_id=$1",[id]);
          const r=await pool.query("update service_requests set assigned_technician='',status=coalesce($1,status) where id=$2 returning *",[status||null,id]);
          return r.rowCount?json(res,200,r.rows[0]):json(res,404,{error:"Request not found"});
        }
        const m=await pool.query("select id,name,phone,active from technicians where name=$1 and active=true limit 1",[assigned_technician]);
        if(!m.rowCount) return json(res,400,{error:"Selected mechanic is not active or was not found"});
        const tech=m.rows[0];
        const r=await pool.query("update service_requests set status='assigned',assigned_technician=$1 where id=$2 returning *",[tech.name,id]);
        if(!r.rowCount)return json(res,404,{error:"Request not found"});
        await pool.query(`insert into mechanic_orders(request_id,technician_id,technician_name,status,assigned_by) values($1,$2,$3,'sent',$4) on conflict(request_id) do update set technician_id=excluded.technician_id,technician_name=excluded.technician_name,status='sent',assigned_by=excluded.assigned_by,accepted_at=null,started_at=null,completed_at=null`,[id,tech.id,tech.name,u.id]);
        return json(res,200,{...r.rows[0],mechanic_order_sent:true,technician_id:tech.id,technician_name:tech.name});
      }
      const r=await pool.query("update service_requests set status=coalesce($1,status) where id=$2 returning *",[status||null,id]);
      if(status && status==="completed") await pool.query("update mechanic_orders set status='completed',completed_at=coalesce(completed_at,now()) where request_id=$1",[id]);
      return r.rowCount?json(res,200,r.rows[0]):json(res,404,{error:"Request not found"});
    }
    return json(res,405,{error:"Method not allowed"});
  }catch(e){console.error(e);return json(res,500,{error:e?.message||"Internal server error"})}
}
