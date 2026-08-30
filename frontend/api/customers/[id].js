import pg from "pg";
import crypto from "crypto";
const { Pool } = pg;
const pool = globalThis.__nroraCustomerDeletePool || new Pool({ connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 10000 });
globalThis.__nroraCustomerDeletePool = pool;
const SECRET=process.env.SESSION_SECRET||"change-this-session-secret-in-vercel";
const readToken=t=>{try{const[p,s]=String(t||"").split(".");const u=JSON.parse(Buffer.from(p,"base64url").toString());const e=crypto.createHmac("sha256",SECRET).update(`${u.id}:${u.username}:${u.role}`).digest("hex");if(!s||s.length!==e.length||!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(e))||u.exp<Date.now())return null;return u}catch{return null}};
export default async function handler(req,res){res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");const u=readToken((req.headers.authorization||"").replace(/^Bearer\s+/i,""));if(!u||u.role!=="admin")return res.status(401).json({error:"Unauthorized"});if(req.method!=="DELETE")return res.status(405).json({error:"Method not allowed"});try{await pool.query("delete from customers where id=$1",[req.query.id]);return res.status(204).end()}catch(e){return res.status(500).json({error:e.message||"Unable to delete customer"})}}
