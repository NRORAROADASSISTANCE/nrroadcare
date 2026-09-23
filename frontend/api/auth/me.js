import pg from "pg";
import crypto from "crypto";
const {Pool}=pg;
const pool=globalThis.__nroraMePool||new Pool({connectionString:process.env.DATABASE_URL,max:5,idleTimeoutMillis:10000});
globalThis.__nroraMePool=pool;
const SECRET=process.env.SESSION_SECRET||"change-this-session-secret-in-vercel";
function verifyToken(token){
  if(!token)return null;
  const [raw,sig]=String(token).split(".");
  if(!raw||!sig)return null;
  let p; try{p=JSON.parse(Buffer.from(raw,"base64url").toString("utf8"))}catch{return null}
  if(!p?.id||!p?.username||!p?.role||!p?.exp||Date.now()>Number(p.exp))return null;
  const expected=crypto.createHmac("sha256",SECRET).update(String(p.id)+":"+String(p.username)+":"+String(p.role)).digest("hex");
  if(sig.length!==expected.length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return null;
  return p;
}
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods","GET, OPTIONS");
  if(req.method==="OPTIONS")return res.status(204).end();
  if(req.method!=="GET")return res.status(405).json({error:"Method Not Allowed"});
  try{
    const auth=req.headers.authorization||"";
    const token=auth.startsWith("Bearer ")?auth.slice(7):"";
    const p=verifyToken(token);
    if(!p)return res.status(401).json({error:"Unauthorized"});
    const r=await pool.query("select id,username,role,name,phone,active from users where id=$1 and username=$2 limit 1",[p.id,p.username]);
    if(!r.rowCount||!r.rows[0].active)return res.status(401).json({error:"Session expired or account disabled"});
    return res.status(200).json({user:r.rows[0]});
  }catch(e){console.error("NRORA auth/me error",e);return res.status(500).json({error:"Authentication service error"});}
}