import pg from "pg";
import crypto from "crypto";
const { Pool } = pg;
const pool = globalThis.__nroraEmployeesPool || new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10000 });
globalThis.__nroraEmployeesPool = pool;
const SECRET = process.env.SESSION_SECRET || "change-this-session-secret-in-vercel";
const readToken = t => { try { const [p,s] = t.split("."); const u = JSON.parse(Buffer.from(p,"base64url").toString()); const e = crypto.createHmac("sha256",SECRET).update(`${u.id}:${u.username}:${u.role}`).digest("hex"); if(s.length!==e.length || !crypto.timingSafeEqual(Buffer.from(s),Buffer.from(e)) || u.exp<Date.now()) return null; return u; } catch { return null; } };
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods","PATCH,OPTIONS");
  if(req.method==="OPTIONS") return res.status(204).end();
  try{
    const t=(req.headers.authorization||"").replace(/^Bearer\s+/i,""); const u=t?readToken(t):null;
    if(!u || !["ceo","admin","division_manager","area_manager","tl"].includes(u.role)) return res.status(401).json({error:"Unauthorized"});
    if(req.method!=="PATCH") return res.status(405).json({error:"Method not allowed"});
    const id=req.query?.id; const active=Boolean(req.body?.active);
    const r=await pool.query("update users set active=$1 where id=$2 and role not in ('admin','ceo') returning id,username,role,name,phone,active",[active,id]);
    return res.status(200).json(r.rows[0]||null);
  }catch(e){ console.error("Employee update API Error:",e); return res.status(500).json({error:e.message||"Employee update failed"}); }
}
