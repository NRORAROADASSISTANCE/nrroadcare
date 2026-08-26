import pg from "pg";
import crypto from "crypto";
const { Pool } = pg;
const pool = globalThis.__nroraPermissionsMePool || new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10000 });
globalThis.__nroraPermissionsMePool = pool;
const SECRET = process.env.SESSION_SECRET || "change-this-session-secret-in-vercel";
const ROLES = ["ceo","admin","division_manager","area_manager","tl","staff","telecaller","mechanic"];
const KEYS = ["dashboard_view","requests_view","requests_create","requests_manage","customers_view","customers_create","customers_delete","payments_view","payments_manage","technicians_view","technicians_manage","employees_view","employees_create","employees_manage","workorders_view","workorders_manage","settings_view"];
const DEFAULTS = {
  ceo: KEYS,
  admin: KEYS,
  division_manager: ["dashboard_view","requests_view","requests_create","requests_manage","customers_view","customers_create","payments_view","technicians_view","technicians_manage","employees_view","employees_create","employees_manage","workorders_view","workorders_manage","settings_view"],
  area_manager: ["dashboard_view","requests_view","requests_create","requests_manage","customers_view","customers_create","payments_view","technicians_view","technicians_manage","employees_view","employees_create","workorders_view","workorders_manage"],
  tl: ["dashboard_view","requests_view","requests_create","requests_manage","customers_view","customers_create","technicians_view","workorders_view","workorders_manage"],
  staff: ["dashboard_view","requests_view","requests_create","customers_view","customers_create","technicians_view","workorders_view"],
  telecaller: ["dashboard_view","requests_view","requests_create","customers_view","customers_create","payments_view","workorders_view"],
  mechanic: ["dashboard_view","requests_view","technicians_view","workorders_view","workorders_manage"]
};
const readUser=req=>{try{const raw=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");if(!raw)return null;const [p,s]=raw.split(".");const u=JSON.parse(Buffer.from(p,"base64url").toString());const expected=crypto.createHmac("sha256",SECRET).update(`${u.id}:${u.username}:${u.role}`).digest("hex");if(!s||s.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(expected))||u.exp<Date.now())return null;return u}catch{return null}};
async function ensureSchema(){await pool.query("create table if not exists role_permissions(role varchar(30) not null,permission varchar(60) not null,allowed boolean not null default false,primary key(role,permission))");for(const role of ROLES){for(const permission of KEYS){await pool.query("insert into role_permissions(role,permission,allowed) values($1,$2,$3) on conflict(role,permission) do nothing",[role,permission,DEFAULTS[role].includes(permission)])}}}
export default async function handler(req,res){res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");if(req.method==="OPTIONS")return res.status(204).end();try{const user=readUser(req);if(!user)return res.status(401).json({error:"Unauthorized"});await ensureSchema();const r=await pool.query("select permission,allowed from role_permissions where role=$1",[user.role]);const permissions=Object.fromEntries(r.rows.map(x=>[x.permission,x.allowed]));if(user.role==="ceo")for(const key of KEYS)permissions[key]=true;return res.status(200).json({role:user.role,permissions})}catch(err){console.error("Permissions me API",err);return res.status(500).json({error:err.message||"Permissions service failed"})}}
