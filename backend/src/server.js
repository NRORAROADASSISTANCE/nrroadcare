import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pg from "pg";
import crypto from "crypto";

dotenv.config();
const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 4000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors({ origin: process.env.FRONTEND_ORIGIN?.split(",") || "*" }));
app.use(express.json());

const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);

app.get("/api/health", asyncRoute(async (_req,res) => {
  const r = await pool.query("select now() as now");
  res.json({ ok:true, service:"nrroadcare-api", time:r.rows[0].now });
}));

app.get("/api/dashboard", asyncRoute(async (_req,res) => {
  const [customers, requests, technicians, payments] = await Promise.all([
    pool.query("select count(*)::int as count from customers"),
    pool.query("select count(*)::int as count from service_requests where status <> 'closed'"),
    pool.query("select count(*)::int as count from technicians where active=true"),
    pool.query("select coalesce(sum(amount),0)::numeric as total from payments")
  ]);
  res.json({
    customers: customers.rows[0].count,
    activeRequests: requests.rows[0].count,
    techniciansOnline: technicians.rows[0].count,
    revenue: Number(payments.rows[0].total)
  });
}));

app.get("/api/customers", asyncRoute(async (_req,res) => {
  const r = await pool.query("select * from customers order by created_at desc");
  res.json(r.rows);
}));

app.post("/api/customers", asyncRoute(async (req,res) => {
  const { name, phone, address="", vehicle_no="" } = req.body;
  if(!name || !phone || !vehicle_no) return res.status(400).json({error:"name, phone and vehicle_no are required"});
  const r = await pool.query(
    "insert into customers(name,phone,address,vehicle_no) values($1,$2,$3,$4) returning *",
    [name,phone,address,vehicle_no]
  );
  res.status(201).json(r.rows[0]);
}));

app.delete("/api/customers/:id", asyncRoute(async (req,res) => {
  await pool.query("delete from customers where id=$1",[req.params.id]);
  res.status(204).end();
}));

app.get("/api/requests", asyncRoute(async (_req,res) => {
  const r = await pool.query(`
    select sr.*, c.name customer_name, c.phone customer_phone
    from service_requests sr left join customers c on c.id=sr.customer_id
    order by sr.created_at desc`);
  res.json(r.rows);
}));

app.post("/api/requests", asyncRoute(async (req,res) => {
  const {customer_id, location="", description=""} = req.body;
  const r = await pool.query(
    "insert into service_requests(customer_id,location,description) values($1,$2,$3) returning *",
    [customer_id || null,location,description]
  );
  res.status(201).json(r.rows[0]);
}));

app.patch("/api/requests/:id", asyncRoute(async (req,res) => {
  const {status, assigned_technician} = req.body;
  const r = await pool.query(
    "update service_requests set status=coalesce($1,status),assigned_technician=coalesce($2,assigned_technician) where id=$3 returning *",
    [status,assigned_technician,req.params.id]
  );
  res.json(r.rows[0] || null);
}));

app.get("/api/technicians", asyncRoute(async (_req,res) => {
  const r = await pool.query("select * from technicians order by name");
  res.json(r.rows);
}));

app.post("/api/technicians", asyncRoute(async (req,res) => {
  const {name,phone,specialization=""} = req.body;
  if(!name || !phone) return res.status(400).json({error:"name and phone are required"});
  const r = await pool.query(
    "insert into technicians(name,phone,specialization) values($1,$2,$3) returning *",
    [name,phone,specialization]
  );
  res.status(201).json(r.rows[0]);
}));

app.post("/api/payments", asyncRoute(async (req,res) => {
  const {customer_id,amount=4500,method="UPI",transaction_ref=""} = req.body;
  const payment = await pool.query(
    "insert into payments(customer_id,amount,method,transaction_ref) values($1,$2,$3,$4) returning *",
    [customer_id,amount,method,transaction_ref]
  );
  const receiptNo = "NR-" + new Date().getFullYear() + "-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  const receipt = await pool.query(
    "insert into receipts(customer_id,payment_id,receipt_no) values($1,$2,$3) returning *",
    [customer_id,payment.rows[0].id,receiptNo]
  );
  res.status(201).json({payment:payment.rows[0],receipt:receipt.rows[0]});
}));

app.post("/api/memberships/renew", asyncRoute(async (req,res) => {
  const {customer_id, renewal_date} = req.body;
  if(!customer_id || !renewal_date) return res.status(400).json({error:"customer_id and renewal_date are required"});
  const r = await pool.query(
    "insert into memberships(customer_id,amount,renewal_date) values($1,4500,$2) returning *",
    [customer_id,renewal_date]
  );
  res.status(201).json(r.rows[0]);
}));

app.use((err,_req,res,_next) => {
  console.error(err);
  res.status(500).json({error:"Internal server error"});
});

app.listen(port,()=>console.log(`NR Road Care API running on ${port}`));
