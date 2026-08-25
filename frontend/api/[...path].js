import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;
const pool = globalThis.__nroraPool || new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10000 });
globalThis.__nroraPool = pool;
const SECRET = process.env.SESSION_SECRET || "change-this-session-secret-in-vercel";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "NRORA@123";

const json = (res, status, body) => { res.status(status).json(body); };
const hash = p => crypto.createHash("sha256").update(`${SECRET}:${p}`).digest("hex");
const token = u => Buffer.from(JSON.stringify({id:u.id,username:u.username,role:u.role,exp:Date.now()+43200000})).toString("base64url")+"."+crypto.createHmac("sha256",SECRET).update(`${u.id}:${u.username}:${u.role}`).digest("hex");
const readToken = t => { try { const [p,s]=t.split("."); const u=JSON.parse(Buffer.from(p,"base64url").toString()); const e=crypto.createHmac("sha256",SECRET).update(`${u.id}:${u.username}:${u.role}`).digest("hex"); if(s.length!==e.length || !crypto.timingSafeEqual(Buffer.from(s),Buffer.from(e)) || u.exp<Date.now()) return null; return u; } catch { return null; } };
const userFrom = req => { const h=req.headers.authorization||""; const t=h.replace(/^Bearer\s+/i,""); return t?readToken(t):null; };
const requireAuth = (req,res,roles=[]) => { const u=userFrom(req); if(!u || (roles.length && !roles.includes(u.role))) { json(res,401,{error:"Unauthorized"}); return null; } return u; };

async function schema(){
 await pool.query(`create table if not exists customers(id bigserial primary key,name varchar(120) not null,phone varchar(20) not null,address text default '',vehicle_no varchar(30) not null,created_at timestamptz default now());
 create table if not exists technicians(id bigserial primary key,name varchar(120) not null,phone varchar(20) not null,specialization varchar(120) default '',active boolean default true,created_at timestamptz default now());
 create table if not exists service_requests(id bigserial primary key,customer_id bigint references customers(id) on delete set null,status varchar(30) default 'pending',location text default '',description text default '',assigned_technician varchar(120) default '',created_at timestamptz default now());
 create table if not exists payments(id bigserial primary key,customer_id bigint references customers(id) on delete set null,amount numeric(12,2) not null default 4500,method varchar(30) default 'UPI',transaction_ref varchar(120) default '',paid_at timestamptz default now());
 create table if not exists memberships(id bigserial primary key,customer_id bigint references customers(id) on delete cascade,amount numeric(12,2) not null default 4500,renewal_date date not null,created_at timestamptz default now());
 create table if not exists receipts(id bigserial primary key,customer_id bigint references customers(id) on delete set null,payment_id bigint references payments(id) on delete set null,receipt_no varchar(50) unique not null,created_at timestamptz default now());
 create table if not exists users(id bigserial primary key,username varchar(80) unique not null,password_hash text not null,role varchar(20) not null default 'employee',name varchar(120) not null,phone varchar(20) default '',active boolean default true,created_at timestamptz default now());`);
 const r=await pool.query("select id from users where username=$1",[ADMIN_USERNAME]);
 if(!r.rowCount) await pool.query("insert into users(username,password_hash,role,name) values($1,$2,'admin',$3)",[ADMIN_USERNAME,hash(ADMIN_PASSWORD),"NRORA Admin"]);
}

export default async function handler(req,res){
 res.setHeader("Access-Control-Allow-Origin","*"); res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization"); res.setHeader("Access-Control-Allow-Methods","GET,POST,PATCH,DELETE,OPTIONS");
 if(req.method==="OPTIONS") return res.status(204).end();
 try{
  await schema();
  let path=req.query?.path; if(Array.isArray(path)) path=path.join("/"); else path=String(path||""); path=path.replace(/^\/+|\/+$/g,"");
  const parts=path.split("/").filter(Boolean), id=parts[1];

  if(req.method==="GET" && path==="health") return json(res,200,{ok:true,service:"nrroadcare-api",time:new Date().toISOString()});
  if(req.method==="POST" && path==="auth/login"){
   const {username,password}=req.body||{}; if(!username||!password) return json(res,400,{error:"Username and password are required"});
   const r=await pool.query("select * from users where username=$1 and active=true",[username]); const u=r.rows[0];
   if(!u||u.password_hash!==hash(password)) return json(res,401,{error:"Invalid username or password"});
   return json(res,200,{token:token(u),user:{id:u.id,username:u.username,role:u.role,name:u.name,phone:u.phone}});
  }
  if(req.method==="GET" && path==="auth/me"){ const u=requireAuth(req,res); if(!u)return; return json(res,200,{user:u}); }

  if(req.method==="GET" && path==="employees"){ if(!requireAuth(req,res,["admin"]))return; const r=await pool.query("select id,username,role,name,phone,active,created_at from users where role='employee' order by created_at desc"); return json(res,200,r.rows); }
  if(req.method==="POST" && path==="employees"){ if(!requireAuth(req,res,["admin"]))return; const {username,password,name,phone=""}=req.body||{}; if(!username||!password||!name)return json(res,400,{error:"name, username and password are required"}); try{const r=await pool.query("insert into users(username,password_hash,role,name,phone) values($1,$2,'employee',$3,$4) returning id,username,role,name,phone,active",[username,hash(password),name,phone]);return json(res,201,r.rows[0]);}catch(e){if(e.code==="23505")return json(res,409,{error:"Username already exists"});throw e;} }
  if(req.method==="PATCH" && parts[0]==="employees" && id){ if(!requireAuth(req,res,["admin"]))return; const r=await pool.query("update users set active=$1 where id=$2 and role='employee' returning id,username,role,name,phone,active",[Boolean(req.body?.active),id]); return json(res,200,r.rows[0]||null); }

  if(req.method==="GET" && path==="dashboard"){ if(!requireAuth(req,res))return; const [c,q,t,p]=await Promise.all([pool.query("select count(*)::int count from customers"),pool.query("select count(*)::int count from service_requests where status <> 'closed'"),pool.query("select count(*)::int count from technicians where active=true"),pool.query("select coalesce(sum(amount),0)::numeric total from payments")]); return json(res,200,{customers:c.rows[0].count,activeRequests:q.rows[0].count,techniciansOnline:t.rows[0].count,revenue:Number(p.rows[0].total)}); }

  if(req.method==="GET" && path==="customers"){ if(!requireAuth(req,res))return; const r=await pool.query("select * from customers order by created_at desc"); return json(res,200,r.rows); }
  if(req.method==="POST" && path==="customers"){ if(!requireAuth(req,res,["admin","employee"]))return; const {name,phone,address="",vehicle_no=""}=req.body||{}; if(!name||!phone||!vehicle_no)return json(res,400,{error:"name, phone and vehicle_no are required"}); const r=await pool.query("insert into customers(name,phone,address,vehicle_no) values($1,$2,$3,$4) returning *",[name,phone,address,vehicle_no]); return json(res,201,r.rows[0]); }
  if(req.method==="DELETE" && parts[0]==="customers" && id){ if(!requireAuth(req,res,["admin"]))return; await pool.query("delete from customers where id=$1",[id]); return res.status(204).end(); }

  if(req.method==="GET" && path==="requests"){ if(!requireAuth(req,res))return; const r=await pool.query("select sr.*,c.name customer_name,c.phone customer_phone from service_requests sr left join customers c on c.id=sr.customer_id order by sr.created_at desc"); return json(res,200,r.rows); }
  if(req.method==="POST" && path==="requests"){ if(!requireAuth(req,res,["admin","employee"]))return; const {customer_id,location="",description=""}=req.body||{}; const r=await pool.query("insert into service_requests(customer_id,location,description) values($1,$2,$3) returning *",[customer_id||null,location,description]); return json(res,201,r.rows[0]); }
  if(req.method==="PATCH" && parts[0]==="requests" && id){ if(!requireAuth(req,res,["admin","employee"]))return; const {status,assigned_technician}=req.body||{}; const r=await pool.query("update service_requests set status=coalesce($1,status),assigned_technician=coalesce($2,assigned_technician) where id=$3 returning *",[status,assigned_technician,id]); return json(res,200,r.rows[0]||null); }

  if(req.method==="GET" && path==="technicians"){ if(!requireAuth(req,res))return; const r=await pool.query("select * from technicians order by name"); return json(res,200,r.rows); }
  if(req.method==="POST" && path==="technicians"){ if(!requireAuth(req,res,["admin"]))return; const {name,phone,specialization=""}=req.body||{}; if(!name||!phone)return json(res,400,{error:"name and phone are required"}); const r=await pool.query("insert into technicians(name,phone,specialization) values($1,$2,$3) returning *",[name,phone,specialization]); return json(res,201,r.rows[0]); }

  if(req.method==="POST" && path==="payments"){ if(!requireAuth(req,res,["admin","employee"]))return; const {customer_id,amount=4500,method="UPI",transaction_ref=""}=req.body||{}; const payment=await pool.query("insert into payments(customer_id,amount,method,transaction_ref) values($1,$2,$3,$4) returning *",[customer_id||null,amount,method,transaction_ref]); const receiptNo="NR-"+new Date().getFullYear()+"-"+crypto.randomBytes(4).toString("hex").toUpperCase(); const receipt=await pool.query("insert into receipts(customer_id,payment_id,receipt_no) values($1,$2,$3) returning *",[customer_id||null,payment.rows[0].id,receiptNo]); return json(res,201,{payment:payment.rows[0],receipt:receipt.rows[0]}); }
  if(req.method==="POST" && path==="memberships/renew"){ if(!requireAuth(req,res,["admin","employee"]))return; const {customer_id,renewal_date}=req.body||{}; if(!customer_id||!renewal_date)return json(res,400,{error:"customer_id and renewal_date are required"}); const r=await pool.query("insert into memberships(customer_id,amount,renewal_date) values($1,4500,$2) returning *",[customer_id,renewal_date]); return json(res,201,r.rows[0]); }

  return json(res,404,{error:"Not found"});
 }catch(e){ console.error(e); return json(res,500,{error:e?.message||"Internal server error"}); }
}
