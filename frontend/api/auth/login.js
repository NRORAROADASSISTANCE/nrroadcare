import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;
const pool = globalThis.__nroraAuthPool || new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10000 });
globalThis.__nroraAuthPool = pool;

const SECRET = process.env.SESSION_SECRET || "change-this-session-secret-in-vercel";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "NRORA@123";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;

const json = (res, status, body) => res.status(status).json(body);
const hash = p => crypto.createHash("sha256").update(`${SECRET}:${p}`).digest("hex");
const makeToken = u => Buffer.from(JSON.stringify({ id:u.id, username:u.username, role:u.role, exp:Date.now()+SESSION_MS })).toString("base64url") + "." + crypto.createHmac("sha256", SECRET).update(`${u.id}:${u.username}:${u.role}`).digest("hex");

async function schema(){
  await pool.query(`create table if not exists users(
    id bigserial primary key,
    username varchar(80) unique not null,
    password_hash text not null,
    role varchar(30) not null default 'staff',
    name varchar(120) not null,
    phone varchar(20) default '',
    active boolean default true,
    created_at timestamptz default now()
  )`);
  const r = await pool.query("select id from users where username=$1", [ADMIN_USERNAME]);
  if(!r.rowCount){
    await pool.query("insert into users(username,password_hash,role,name) values($1,$2,'admin',$3)", [ADMIN_USERNAME, hash(ADMIN_PASSWORD), "NRORA Admin"]);
  }
}

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  if(req.method === "OPTIONS") return res.status(204).end();
  if(req.method !== "POST") return json(res,405,{error:"Method not allowed"});
  try{
    await schema();
    const {username,password} = req.body || {};
    if(!username || !password) return json(res,400,{error:"Username and password are required"});
    const r = await pool.query("select * from users where username=$1 and active=true", [username]);
    const u = r.rows[0];
    if(!u || u.password_hash !== hash(password)) return json(res,401,{error:"Invalid username or password"});
    return json(res,200,{token:makeToken(u),user:{id:u.id,username:u.username,role:u.role,name:u.name,phone:u.phone}});
  }catch(e){
    console.error("NRORA login error",e);
    return json(res,500,{error:e?.message || "Login server error"});
  }
}
