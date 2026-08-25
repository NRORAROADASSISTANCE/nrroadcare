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

app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(",") || "*" }));
app.use(express.json());
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const hashPassword = password => crypto.createHash("sha256").update(`${SESSION_SECRET}:${password}`).digest("hex");
const makeToken = user => Buffer.from(JSON.stringify({id:user.id,username:user.username,role:user.role,exp:Date.now()+1000*60*60*12})).toString("base64url")+"."+crypto.createHmac("sha256",SESSION_SECRET).update(`${user.id}:${user.username}:${user.role}`).digest("hex");
const readToken = token => { try { const [payload,sig]=token.split("."); const u=JSON.parse(Buffer.from(payload,"base64url").toString()); const expected=crypto.createHmac("sha256",SESSION_SECRET).update(`${u.id}:${u.username}:${u.role}`).digest("hex"); if(!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)) || u.exp<Date.now()) return null; return u; } catch { return null; } };
const auth = (roles=[]) => (req,res,next) => { const token=req.headers.authorization?.replace(/^Bearer\s+/i,""); const user=token&&readToken(token); if(!user || (roles.length && !roles.includes(user.role))) return res.status(401).json({error:"Unauthorized"}); req.user=user; next(); };

async function ensureAdmin(){
  await pool.query(`create table if not exists users(id bigserial primary key,username varchar(80) unique not null,password_hash text not null,role varchar(20) not null default 'employee',name varchar(120) not null,phone varchar(20) default '',active boolean default true,created_at timestamptz default now())`);
  const r=await pool.query("select id from users where username=$1",[ADMIN_USERNAME]);
  if(!r.rowCount) await pool.query("insert into users(username,password_hash,role,name) values($1,$2,'admin',$3)",[ADMIN_USERNAME,hashPassword(ADMIN_PASSWORD),"NRORA Admin"]);
}

app.get("/api/health", asyncRoute(async (_req,res) => { const r=await pool.query("select now() as now"); res.json({ok:true,service:"nrroadcare-api",time:r.rows[0].now}); }));
app.post("/api/auth/login", asyncRoute(async (req,res)=>{ const {username,password}=req.body; if(!username||!password) return res.status(400).json({error:"Username and password are required"}); const r=await pool.query("select * from users where username=$1 and active=true",[username]); const u=r.rows[0]; if(!u||u.password_hash!==hashPassword(password)) return res.status(401).json({error:"Invalid username or password"}); res.json({token:makeToken(u),user:{id:u.id,username:u.username,role:u.role,name:u.name,phone:u.phone}}); }));
app.get("/api/auth/me",auth(),asyncRoute(async(req,res)=>res.json({user:req.user})));
app.get("/api/employees",auth(["admin"]),asyncRoute(async(_req,res)=>{const r=await pool.query("select id,username,role,name,phone,active,created_at from users where role='employee' order by created_at desc");res.json(r.rows);}));
app.post("/api/employees",auth(["admin"]),asyncRoute(async(req,res)=>{const {username,password,name,phone=""}=req.body;if(!username||!password||!name)return res.status(400).json({error:"name, username and password are required"});const r=await pool.query("insert into users(username,password_hash,role,name,phone) values($1,$2,'employee',$3,$4) returning id,username,role,name,phone,active",[username,hashPassword(password),name,phone]);res.status(201).json(r.rows[0]);}));
app.patch("/api/employees/:id",auth(["admin"]),asyncRoute(async(req,res)=>{const {active}=req.body;const r=await pool.query("update users set active=$1 where id=$2 and role='employee' returning id,username,role,name,phone,active",[Boolean(active),req.params.id]);res.json(r.rows[0]||null);}));

app.get("/api/dashboard", auth(), asyncRoute(async (_req,res) => { const [customers,requests,technicians,payments]=await Promise.all([pool.query("select count(*)::int as count from customers"),pool.query("select count(*)::int as count from service_requests where status <> 'closed'"),pool.query("select count(*)::int as count from technicians where active=true"),pool.query("select coalesce(sum(amount),0)::numeric as total from payments")]);res.json({customers:customers.rows[0].count,activeRequests:requests.rows[0].count,techniciansOnline:technicians.rows[0].count,revenue:Number(payments.rows[0].total)}); }));
app.get("/api/customers",auth(),asyncRoute(async(_req,res)=>{const r=await pool.query("select * from customers order by created_at desc");res.json(r.rows);}));
app.post("/api/customers",auth(["admin","employee"]),asyncRoute(async(req,res)=>{const {name,phone,address="",vehicle_no=""}=req.body;if(!name||!phone||!vehicle_no)return res.status(400).json({error:"name, phone and vehicle_no are required"});const r=await pool.query("insert into customers(name,phone,address,vehicle_no) values($1,$2,$3,$4) returning *",[name,phone,address,vehicle_no]);res.status(201).json(r.rows[0]);}));
app.delete("/api/customers/:id",auth(["admin"]),asyncRoute(async(req,res)=>{await pool.query("delete from customers where id=$1",[req.params.id]);res.status(204).end();}));
app.get("/api/requests",auth(),asyncRoute(async(_req,res)=>{const r=await pool.query(`select sr.*, c.name customer_name, c.phone customer_phone from service_requests sr left join customers c on c.id=sr.customer_id order by sr.created_at desc`);res.json(r.rows);}));
app.post("/api/requests",auth(["admin","employee"]),asyncRoute(async(req,res)=>{const {customer_id,location="",description=""}=req.body;const r=await pool.query("insert into service_requests(customer_id,location,description) values($1,$2,$3) returning *",[customer_id||null,location,description]);res.status(201).json(r.rows[0]);}));
app.patch("/api/requests/:id",auth(["admin","employee"]),asyncRoute(async(req,res)=>{const {status,assigned_technician}=req.body;const r=await pool.query("update service_requests set status=coalesce($1,status),assigned_technician=coalesce($2,assigned_technician) where id=$3 returning *",[status,assigned_technician,req.params.id]);res.json(r.rows[0]||null);}));
app.get("/api/technicians",auth(),asyncRoute(async(_req,res)=>{const r=await pool.query("select * from technicians order by name");res.json(r.rows);}));
app.post("/api/technicians",auth(["admin"]),asyncRoute(async(req,res)=>{const {name,phone,specialization=""}=req.body;if(!name||!phone)return res.status(400).json({error:"name and phone are required"});const r=await pool.query("insert into technicians(name,phone,specialization) values($1,$2,$3) returning *",[name,phone,specialization]);res.status(201).json(r.rows[0]);}));
app.post("/api/payments",auth(["admin","employee"]),asyncRoute(async(req,res)=>{const {customer_id,amount=4500,method="UPI",transaction_ref=""}=req.body;const payment=await pool.query("insert into payments(customer_id,amount,method,transaction_ref) values($1,$2,$3,$4) returning *",[customer_id,amount,method,transaction_ref]);const receiptNo="NR-"+new Date().getFullYear()+"-"+crypto.randomBytes(4).toString("hex").toUpperCase();const receipt=await pool.query("insert into receipts(customer_id,payment_id,receipt_no) values($1,$2,$3) returning *",[customer_id,payment.rows[0].id,receiptNo]);res.status(201).json({payment:payment.rows[0],receipt:receipt.rows[0]});}));
app.post("/api/memberships/renew",auth(["admin","employee"]),asyncRoute(async(req,res)=>{const {customer_id,renewal_date}=req.body;if(!customer_id||!renewal_date)return res.status(400).json({error:"customer_id and renewal_date are required"});const r=await pool.query("insert into memberships(customer_id,amount,renewal_date) values($1,4500,$2) returning *",[customer_id,renewal_date]);res.status(201).json(r.rows[0]);}));
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:"Internal server error"});});
ensureAdmin().then(()=>app.listen(port,()=>console.log(`NRORA API running on ${port}`))).catch(err=>{console.error("Startup failed",err);process.exit(1)});
