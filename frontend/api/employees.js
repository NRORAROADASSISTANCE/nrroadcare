import pg from "pg";
import crypto from "crypto";
const { Pool } = pg;
const pool = globalThis.__nroraEmployeesPool || new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10000 });
globalThis.__nroraEmployeesPool = pool;
const SECRET = process.env.SESSION_SECRET || "change-this-session-secret-in-vercel";
const hash = p => crypto.createHash("sha256").update(`${SECRET}:${p}`).digest("hex");
const readToken = t => { try { const [p,s] = t.split("."); const u = JSON.parse(Buffer.from(p,"base64url").toString()); const e = crypto.createHmac("sha256",SECRET).update(`${u.id}:${u.username}:${u.role}`).digest("hex"); if(s.length!==e.length || !crypto.timingSafeEqual(Buffer.from(s),Buffer.from(e)) || u.exp<Date.now()) return null; return u; } catch { return null; } };
const auth = (req,res,roles=[]) => { const t=(req.headers.authorization||"").replace(/^Bearer\s+/i,""); const u=t?readToken(t):null; if(!u || (roles.length && !roles.includes(u.role))){res.status(401).json({error:"Unauthorized"});return null;} return u; };
async function ensureUsers(){
  await pool.query(`create table if not exists users(id bigserial primary key,username varchar(80) unique not null,password_hash text not null,role varchar(30) not null default 'staff',name varchar(120) not null,phone varchar(20) default '',active boolean default true,created_at timestamptz default now())`);
}
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  if(req.method==="OPTIONS") return res.status(204).end();
  try{
    await ensureUsers();
    const u=auth(req,res,["ceo","admin","division_manager","area_manager","tl"]); if(!u)return;
    if(req.method==="GET"){
      const q=u.role==="ceo"
        ? "select id,username,role,name,phone,active,created_at from users where role <> 'ceo' order by created_at desc"
        : "select id,username,role,name,phone,active,created_at from users where role not in ('admin','ceo') order by created_at desc";
      const r=await pool.query(q); return res.status(200).json(r.rows);
    }
    if(req.method==="POST"){
      const {username,password,name,phone="",role="staff"}=req.body||{};
      if(!username||!password||!name) return res.status(400).json({error:"name, username and password are required"});
      if(role==="admin" && u.role!=="ceo") return res.status(403).json({error:"Only the CEO can create an Admin"});
      const allowed=u.role==="ceo"?["admin","division_manager","area_manager","tl","staff","telecaller","mechanic"]:u.role==="admin"?["division_manager","area_manager","tl","staff"]:u.role==="division_manager"?["area_manager","tl","staff"]:u.role==="area_manager"?["tl","staff"]:["staff"];
      if(!allowed.includes(role)) return res.status(403).json({error:"You cannot create this role"});
      try{
        const r=await pool.query("insert into users(username,password_hash,role,name,phone) values($1,$2,$3,$4,$5) returning id,username,role,name,phone,active",[username,hash(password),role,name,phone]);
        return res.status(201).json(r.rows[0]);
      }catch(e){ if(e.code==="23505") return res.status(409).json({error:"Username already exists"}); throw e; }
    }
    return res.status(405).json({error:"Method not allowed"});
  }catch(e){ console.error("Employees API Error:",e); return res.status(500).json({error:e.message||"Employees API failed"}); }
}
