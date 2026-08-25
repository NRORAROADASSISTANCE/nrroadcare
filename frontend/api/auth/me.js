import crypto from "crypto";

const SECRET = process.env.SESSION_SECRET || "change-this-session-secret-in-vercel";

const json = (res, status, body) => res.status(status).json(body);

function readToken(value){
  try{
    const token = String(value || "").replace(/^Bearer\s+/i, "");
    const [payload, signature] = token.split(".");
    if(!payload || !signature) return null;
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const expected = crypto.createHmac("sha256", SECRET).update(`${user.id}:${user.username}:${user.role}`).digest("hex");
    if(signature.length !== expected.length) return null;
    if(!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    if(!user.exp || Number(user.exp) < Date.now()) return null;
    return user;
  }catch{return null}
}

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");
  if(req.method === "OPTIONS") return res.status(204).end();
  if(req.method !== "GET") return json(res,405,{error:"Method not allowed"});
  const user = readToken(req.headers.authorization);
  if(!user) return json(res,401,{error:"Session expired or invalid"});
  return json(res,200,{user});
}
