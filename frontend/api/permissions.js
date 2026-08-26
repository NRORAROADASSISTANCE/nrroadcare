import pg from "pg";
import crypto from "crypto";
const { Pool } = pg;
const pool = globalThis.__nroraPermissionsPool || new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10000 });
globalThis.__nroraPermissionsPool = pool;
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
const json=(res,status,body)=>res.status(status).json(body);
const readUser=req=>{try{const raw=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");if(!raw)return null;const [p,s]=raw.split(".");const u=JSON.parse(Buffer.from(p,"base64url").toString());const expected=crypto.createHmac("sha256",SECRET).update(`${u.id}:${u.username}:${u.role}`).digest("hex");if(!s||s.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(expected))||u.exp<Date.now())return null;return u}catch{return null}};
async function ensureSchema(){await pool.query("create table if not exists role_permissions(role varchar(30) not null,permission varchar(60) not null,allowed boolean not null default false,primary key(role,permission))");for(const role of ROLES){for(const permission of KEYS){await pool.query("insert into role_permissions(role,permission,allowed) values($1,$2,$3) on conflict(role,permission) do nothing",[role,permission,DEFAULTS[role].includes(permission)])}}}
export default async function handler(req,res){res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");res.setHeader("Access-Control-Allow-Methods","GET,PATCH,OPTIONS");if(req.method==="OPTIONS")return res.status(204).end();try{const user=readUser(req);if(!user)return json(res,401,{error:"Unauthorized"});await ensureSchema();if(req.method==="GET"){if(user.role!=="ceo")return json(res,403,{error:"Permission denied"});const r=await pool.query("select role,permission,allowed from role_permissions order by role,permission");const permissions={};for(const row of r.rows)(permissions[row.role] ||= {})[row.permission]=row.allowed;return json(res,200,{permissions})}if(req.method==="PATCH"){if(user.role!=="ceo")return json(res,403,{error:"Only CEO can change permissions"});const {role,permission,allowed}=req.body||{};if(!ROLES.includes(role)||role==="ceo"||!KEYS.includes(permission))return json(res,400,{error:"Invalid role or permission"});await pool.query("insert into role_permissions(role,permission,allowed) values($1,$2,$3) on conflict(role,permission) do update set allowed=excluded.allowed",[role,permission,Boolean(allowed)]);return json(res,200,{ok:true,role,permission,allowed:Boolean(allowed)})}return json(res,405,{error:"Method not allowed"})}catch(err){console.error("Permissions API",err);return json(res,500,{error:err.message||"Permissions service failed"})}}
