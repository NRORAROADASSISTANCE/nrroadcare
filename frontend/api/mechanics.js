import pg from "pg";
import crypto from "crypto";
const {Pool}=pg;
const pool=globalThis.__nroraMechanicsPool||new Pool({connectionString:process.env.DATABASE_URL,max:5,idleTimeoutMillis:10000});
globalThis.__nroraMechanicsPool=pool;
const SECRET=String(process.env.SESSION_SECRET||"change-this-session-secret-in-vercel").trim();
const json=(res,status,body)=>res.status(status).json(body);
const readToken=t=>{try{const [p,s]=String(t||"").split(".");const u=JSON.parse(Buffer.from(p,"base64url").toString());const e=crypto.createHmac("sha256",SECRET).update(`${u.id}:${u.username}:${u.role}`).digest("hex");if(!s||s.length!==e.length||!crypto.timingSafeEqual(Buffer.from(s),Buffer.from(e))||u.exp<Date.now())return null;return u}catch{return null}};
const auth=(req,res,roles)=>{const u=readToken((req.headers.authorization||"").replace(/^Bearer\s+/i,""));if(!u||!roles.includes(u.role)){json(res,401,{error:"Unauthorized"});return null}return u};
async function schema(){
 await pool.query("alter table technicians add column if not exists alternate_phone varchar(20) default ''");
 await pool.query("alter table technicians add column if not exists address text default ''");
 await pool.query("alter table technicians add column if not exists id_number varchar(80) default ''");
 await pool.query("alter table technicians add column if not exists licence_no varchar(80) default ''");
 await pool.query("alter table technicians add column if not exists vehicle_type varchar(80) default ''");
 await pool.query("alter table technicians add column if not exists vehicle_no varchar(40) default ''");
 await pool.query("alter table technicians add column if not exists experience_years integer default 0");
 await pool.query("alter table technicians add column if not exists service_area varchar(160) default ''");
 await pool.query("alter table technicians add column if not exists joining_date date");
 await pool.query("alter table technicians add column if not exists username varchar(80) default ''");
 await pool.query("alter table technicians add column if not exists password_hash text default ''");
 await pool.query("alter table technicians add column if not exists profile_photo text default ''");
 await pool.query("alter table technicians add column if not exists documents text default ''");
 await pool.query("create unique index if not exists technicians_username_idx on technicians(username) where username <> ''");
}
export default async function handler(req,res){
 res.setHeader("Access-Control-Allow-Origin","*");res.setHeader("Access-Control-Allow-Headers","Content-Type, Authorization");res.setHeader("Access-Control-Allow-Methods","GET,POST,PATCH,DELETE,OPTIONS");if(req.method==="OPTIONS")return res.status(204).end();
 try{await schema();const roles=["admin","division_manager","area_manager"];const u=auth(req,res,roles);if(!u)return;
 if(req.method==="GET"){const r=await pool.query("select id,name,phone,alternate_phone,address,specialization,active,id_number,licence_no,vehicle_type,vehicle_no,experience_years,service_area,joining_date,username,profile_photo,documents,created_at from technicians order by created_at desc");return json(res,200,r.rows)}
 if(req.method==="POST"){
  const b=req.body||{};if(!b.name||!b.phone||!b.username||!b.password)return json(res,400,{error:"name, phone, username and password are required"});
  const h=crypto.createHash("sha256").update(`${SECRET}:${b.password}`).digest("hex");
  const r=await pool.query("insert into technicians(name,phone,alternate_phone,address,specialization,id_number,licence_no,vehicle_type,vehicle_no,experience_years,service_area,joining_date,username,password_hash,profile_photo,documents,active) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,true) returning id,name,phone,alternate_phone,address,specialization,active,id_number,licence_no,vehicle_type,vehicle_no,experience_years,service_area,joining_date,username,profile_photo,documents,created_at",[b.name,b.phone,b.alternate_phone||"",b.address||"",b.specialization||"",b.id_number||"",b.licence_no||"",b.vehicle_type||"",b.vehicle_no||"",Number(b.experience_years||0),b.service_area||"",b.joining_date||null,b.username,h,b.profile_photo||"",b.documents||""]);return json(res,201,r.rows[0]);
 }
 const id=String(req.query?.id||"");if(!id)return json(res,400,{error:"id is required"});
 if(req.method==="PATCH"){const b=req.body||{};const fields=["name","phone","alternate_phone","address","specialization","id_number","licence_no","vehicle_type","vehicle_no","experience_years","service_area","joining_date","profile_photo","documents","active"].filter(k=>Object.prototype.hasOwnProperty.call(b,k));if(!fields.length)return json(res,400,{error:"No changes supplied"});const vals=fields.map(k=>k==="experience_years"?Number(b[k]||0):b[k]);const sets=fields.map((k,i)=>`${k}=$${i+1}`).join(",");const r=await pool.query(`update technicians set ${sets} where id=$${fields.length+1} returning id,name,phone,alternate_phone,address,specialization,active,id_number,licence_no,vehicle_type,vehicle_no,experience_years,service_area,joining_date,username,profile_photo,documents,created_at`,[...vals,id]);return json(res,200,r.rows[0]||null)}
 if(req.method==="DELETE"){await pool.query("delete from technicians where id=$1",[id]);return res.status(204).end()}
 return json(res,405,{error:"Method not allowed"});
 }catch(e){if(e.code==="23505")return json(res,409,{error:"Mechanic username already exists"});console.error(e);return json(res,500,{error:e?.message||"Internal server error"})}
}