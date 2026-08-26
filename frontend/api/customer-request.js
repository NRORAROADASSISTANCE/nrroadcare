import pg from "pg";
const {Pool}=pg;
const pool=globalThis.__nroraCustomerRequestPool||new Pool({connectionString:process.env.DATABASE_URL,max:5,idleTimeoutMillis:10000});
globalThis.__nroraCustomerRequestPool=pool;
const json=(res,status,body)=>res.status(status).json(body);
async function ensure(){
  await pool.query(`create table if not exists service_requests(id bigserial primary key,customer_id bigint references customers(id) on delete set null,status varchar(30) default 'pending',location text default '',description text default '',assigned_technician varchar(120) default '',created_at timestamptz default now())`);
  await pool.query(`alter table service_requests add column if not exists customer_name text default '', add column if not exists customer_phone varchar(20) default '', add column if not exists vehicle_no varchar(40) default '', add column if not exists photo_data text default ''`);
}
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  res.setHeader("Access-Control-Allow-Methods","POST,GET,OPTIONS");
  if(req.method==="OPTIONS") return res.status(204).end();
  try{
    await ensure();
    if(req.method==="POST"){
      const {name,phone,vehicle_no,description,location="",photo_data=""}=req.body||{};
      if(!name||!phone||!vehicle_no||!description) return json(res,400,{error:"Name, mobile, vehicle number and problem are required"});
      if(!/^[0-9]{10}$/.test(String(phone))) return json(res,400,{error:"Enter a valid 10-digit mobile number"});
      const cleanPhone=String(phone).trim();
      const cleanVehicle=String(vehicle_no).trim().toUpperCase();
      const customer=await pool.query("select id,name,phone,vehicle_no from customers where phone=$1 and upper(trim(vehicle_no))=$2 and coalesce(account_status,'active')='active' limit 1",[cleanPhone,cleanVehicle]);
      if(!customer.rowCount) return json(res,403,{error:"Not Verified Customer. Please enter your registered mobile number and vehicle number."});
      const c=customer.rows[0];
      const r=await pool.query("insert into service_requests(customer_id,customer_name,customer_phone,vehicle_no,location,description,photo_data,status) values($1,$2,$3,$4,$5,$6,$7,'pending') returning id,status,created_at",[c.id,c.name,c.phone,c.vehicle_no,location,description,photo_data]);
      return json(res,201,{requestId:r.rows[0].id,status:r.rows[0].status,createdAt:r.rows[0].created_at,customerId:c.id});
    }
    if(req.method==="GET"){
      const {id,phone}=req.query||{};
      if(!id||!phone) return json(res,400,{error:"Request ID and mobile number are required"});
      const r=await pool.query("select sr.id,sr.status,sr.location,sr.description,sr.assigned_technician,sr.created_at,c.name customer_name,c.phone customer_phone,c.vehicle_no from service_requests sr join customers c on c.id=sr.customer_id where sr.id=$1 and c.phone=$2 limit 1",[id,String(phone).trim()]);
      return r.rowCount?json(res,200,r.rows[0]):json(res,404,{error:"Request not found"});
    }
    return json(res,405,{error:"Method not allowed"});
  }catch(e){console.error(e);return json(res,500,{error:e?.message||"Unable to process request"})}
}
