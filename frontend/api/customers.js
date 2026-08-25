import pg from "pg";
import crypto from "crypto";
import handler from "./[...path].js";

const { Pool } = pg;
const pool = globalThis.__nroraCustomerPool || new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 10000 });
globalThis.__nroraCustomerPool = pool;
const SECRET = process.env.SESSION_SECRET || "change-this-session-secret-in-vercel";

const json = (res,status,body) => res.status(status).json(body);
const readUser = req => {
  try{
    const value = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const [payload,signature] = value.split(".");
    if(!payload || !signature) return null;
    const user = JSON.parse(Buffer.from(payload,"base64url").toString("utf8"));
    const expected = crypto.createHmac("sha256",SECRET).update(`${user.id}:${user.username}:${user.role}`).digest("hex");
    if(signature.length!==expected.length || !crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected)) || !user.exp || Number(user.exp)<Date.now()) return null;
    return user;
  }catch{return null}
};

export default async function customersHandler(req,res) {
  if(req.method === "DELETE"){
    const user = readUser(req);
    if(!user) return json(res,401,{error:"Unauthorized"});
    if(user.role !== "admin") return json(res,403,{error:"Only Main Admin can delete customers"});
    const id = req.query?.id;
    if(!id) return json(res,400,{error:"Customer id is required"});
    try{
      const result = await pool.query("delete from customers where id=$1 returning id",[id]);
      if(!result.rowCount) return json(res,404,{error:"Customer not found"});
      return res.status(204).end();
    }catch(e){
      console.error("NRORA customer delete error",e);
      return json(res,500,{error:e?.message || "Customer delete failed"});
    }
  }

  const id = req.query?.id;
  req.query = {
    ...(req.query || {}),
    path: id ? ["customers", String(id)] : ["customers"]
  };
  return handler(req, res);
}
