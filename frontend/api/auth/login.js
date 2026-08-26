import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;
const pool = globalThis.__nroraLoginPool || new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
});
globalThis.__nroraLoginPool = pool;

const SECRET = process.env.SESSION_SECRET || "change-this-session-secret-in-vercel";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "NRORA@123";
const hash = (password) => crypto.createHash("sha256").update(`${SECRET}:${password}`).digest("hex");
const makeToken = (user) => {
  const payload = Buffer.from(JSON.stringify({id:user.id,username:user.username,role:user.role,exp:Date.now()+30*24*60*60*1000})).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(`${user.id}:${user.username}:${user.role}`).digest("hex");
  return `${payload}.${signature}`;
};
async function ensureUser(){
  await pool.query(`create table if not exists users(id bigserial primary key,username varchar(80) unique not null,password_hash text not null,role varchar(30) not null default 'staff',name varchar(120) not null,phone varchar(20) default '',active boolean default true,created_at timestamptz default now())`);
  const found=await pool.query("select id from users where username=$1",[ADMIN_USERNAME]);
  if(!found.rowCount) await pool.query("insert into users(username,password_hash,role,name) values($1,$2,'admin',$3)",[ADMIN_USERNAME,hash(ADMIN_PASSWORD),"NRORA Admin"]);
}
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods","POST, OPTIONS");
  if(req.method==="OPTIONS") return res.status(204).end();
  if(req.method!=="POST") return res.status(405).json({error:"Method Not Allowed"});
  try{
    await ensureUser();
    const {username,password}=req.body||{};
    if(!username||!password)return res.status(400).json({error:"Username and password are required"});
    const result=await pool.query("select * from users where username=$1 and active=true",[username]);
    const user=result.rows[0];
    if(user&&user.password_hash===hash(password)) return res.status(200).json({token:makeToken(user),user:{id:user.id,username:user.username,role:user.role,name:user.name,phone:user.phone}});
    const mech=await pool.query("select id,name,phone,username,password_hash,active from technicians where username=$1 and active=true",[username]);
    const m=mech.rows[0];
    if(m&&m.password_hash===hash(password)) return res.status(200).json({token:makeToken({id:m.id,username:m.username,role:"mechanic",name:m.name,phone:m.phone}),user:{id:m.id,username:m.username,role:"mechanic",name:m.name,phone:m.phone}});
    return res.status(401).json({error:"Invalid username or password"});
  }catch(error){console.error("NRORA login error",error);return res.status(500).json({error:"Login service error"});}
}
