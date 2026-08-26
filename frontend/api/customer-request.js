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
      const customer=await pool.query("select id from customers where phone=$1 limit 1",[String(phone)]);
      const customerId=customer.rows[0]?.id||null;
      const r=await pool.query("insert into service_requests(customer_id,customer_name,customer_phone,vehicle_no,location,description,photo_data,status) values($1,$2,$3,$4,$5,$6,$7,'pending') returning id,status,created_at",[customerId,name,String(phone),vehicle_no,location,description,photo_data]);
      return json(res,201,{requestId:r.rows[0].id,status:r.rows[0].status,createdAt:r.rows[0].created_at});
    }
    if(req.method==="GET"){
      const {id,phone}=req.query||{};
      if(!id||!phone) return json(res,400,{error:"Request ID and mobile number are required"});
      const r=await pool.query("select id,status,location,description,assigned_technician,created_at from service_requests where id=$1 and customer_phone=$2 limit 1",[id,String(phone)]);
      return r.rowCount?json(res,200,r.rows[0]):json(res,404,{error:"Request not found"});
    }
    return json(res,405,{error:"Method not allowed"});
  }catch(e){console.error(e);return json(res,500,{error:e?.message||"Unable to process request"})}
}
