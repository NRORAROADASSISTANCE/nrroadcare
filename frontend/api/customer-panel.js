import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;
const pool = globalThis.__nroraCustomerPanelPool || new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000
});
globalThis.__nroraCustomerPanelPool = pool;

const SECRET = process.env.SESSION_SECRET || process.env.DATABASE_URL;
const json = (res, status, body) => res.status(status).json(body);
const clean = v => String(v ?? "").trim();
const phoneDigits = v => clean(v).replace(/\\D/g, "");
const vehicleKey = v => clean(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
const requestIp = req => String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || "unknown").split(",")[0].trim();
const ipHash = req => crypto.createHash("sha256").update(requestIp(req) + "|" + String(SECRET || "")).digest("hex");

async function ensureSchema() {
  await pool.query(`
    create table if not exists customer_panel_login_attempts(
      ip_hash varchar(64) primary key,
      failed_count integer not null default 0,
      first_failed_at timestamptz not null default now(),
      locked_until timestamptz
    );
    create table if not exists customer_vehicles(
      id bigserial primary key,
      customer_id bigint not null references customers(id) on delete cascade,
      vehicle_no varchar(30) not null,
      vehicle_type varchar(60) not null default '',
      make_brand varchar(100) not null default '',
      model varchar(100) not null default '',
      variant varchar(100) not null default '',
      fuel_type varchar(40) not null default '',
      manufacturing_year varchar(4) not null default '',
      color varchar(50) not null default '',
      rc_number varchar(60) not null default '',
      photo1 text not null default '',
      photo2 text not null default '',
      created_at timestamptz default now()
    );
  `);
}
function issueToken(customerId) {
  const payload = Buffer.from(JSON.stringify({ customerId: String(customerId), exp: Date.now() + 60 * 60 * 1000 })).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  return payload + "." + sig;
}
function readToken(token) {
  try {
    if (!SECRET || SECRET.length < 32) return null;
    const [payload, signature] = String(token || "").split(".");
    if (!payload || !signature) return null;
    const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.customerId || !Number.isFinite(data.exp) || data.exp < Date.now()) return null;
    return data;
  } catch { return null; }
}
async function failedLogin(req) {
  const key = ipHash(req);
  const q = await pool.query(
    `insert into customer_panel_login_attempts(ip_hash,failed_count,first_failed_at,locked_until)
     values($1,1,now(),null)
     on conflict(ip_hash) do update set
       failed_count=case when customer_panel_login_attempts.first_failed_at < now()-interval '15 minutes' then 1 else customer_panel_login_attempts.failed_count+1 end,
       first_failed_at=case when customer_panel_login_attempts.first_failed_at < now()-interval '15 minutes' then now() else customer_panel_login_attempts.first_failed_at end,
       locked_until=case when customer_panel_login_attempts.first_failed_at >= now()-interval '15 minutes' and customer_panel_login_attempts.failed_count+1 >= 5 then now()+interval '15 minutes' else null end
     returning failed_count,locked_until`,
    [key]
  );
  return q.rows[0];
}
async function login(req, res) {
  const phone = phoneDigits(req.body?.phone);
  const vehicle = vehicleKey(req.body?.vehicle_no);
  if (phone.length !== 10 || vehicle.length < 5) return json(res, 400, { error: "Enter your registered 10-digit mobile number and vehicle number." });
  const key = ipHash(req);
  const attempts = await pool.query("select locked_until from customer_panel_login_attempts where ip_hash=$1", [key]);
  if (attempts.rows[0]?.locked_until && new Date(attempts.rows[0].locked_until) > new Date()) {
    return json(res, 429, { error: "Too many attempts. Please wait 15 minutes and try again." });
  }
  const found = await pool.query(
    `select c.id,c.name,c.phone,c.address,c.vehicle_no,c.account_status,c.created_at
       from customers c
      where regexp_replace(c.phone,'[^0-9]','','g')=$1
        and (
          regexp_replace(upper(c.vehicle_no),'[^A-Z0-9]','','g')=$2
          or exists (
            select 1 from customer_vehicles cv
             where cv.customer_id=c.id
               and regexp_replace(upper(cv.vehicle_no),'[^A-Z0-9]','','g')=$2
          )
        )
      order by c.id desc limit 1`,
    [phone, vehicle]
  );
  if (!found.rowCount) {
    const result = await failedLogin(req);
    return json(res, 401, { error: result.locked_until && new Date(result.locked_until) > new Date() ? "Too many attempts. Please wait 15 minutes and try again." : "Details did not match our records. Check the registered mobile and vehicle number." });
  }
  await pool.query("delete from customer_panel_login_attempts where ip_hash=$1", [key]);
  return json(res, 200, { ok: true, token: issueToken(found.rows[0].id), customer: { name: found.rows[0].name } });
}
async function dashboard(req, res) {
  const auth = String(req.headers.authorization || "").replace(/^Bearer\\s+/i, "");
  const session = readToken(auth);
  if (!session) return json(res, 401, { error: "Your session expired. Please login again." });
  const customerId = Number(session.customerId);
  const customerQ = await pool.query(
    "select id,name,phone,address,vehicle_no,account_status,created_at from customers where id=$1",
    [customerId]
  );
  if (!customerQ.rowCount) return json(res, 401, { error: "Customer account not found. Please login again." });
  const [vehiclesQ, membershipsQ, paymentsQ, requestsQ] = await Promise.all([
    pool.query("select vehicle_no,vehicle_type,make_brand,model,variant from customer_vehicles where customer_id=$1 order by id desc", [customerId]),
    pool.query("select amount,renewal_date,created_at from memberships where customer_id=$1 order by renewal_date desc limit 5", [customerId]),
    pool.query("select amount,method,status,paid_at,transaction_ref from payments where customer_id=$1 order by id desc limit 5", [customerId]),
    pool.query("select id,status,location,description,created_at from service_requests where customer_id=$1 order by id desc limit 10", [customerId])
  ]);
  const c = customerQ.rows[0];
  const vehicles = vehiclesQ.rows.length ? vehiclesQ.rows : [{ vehicle_no: c.vehicle_no, vehicle_type: "", make_brand: "", model: "", variant: "" }];
  return json(res, 200, {
    ok: true,
    customer: { name: c.name, phone: c.phone, address: c.address, account_status: c.account_status, created_at: c.created_at },
    vehicles,
    memberships: membershipsQ.rows,
    payments: paymentsQ.rows.map(p => ({ amount: p.amount, method: p.method, status: p.status, paid_at: p.paid_at, transaction_ref: p.transaction_ref })),
    serviceRequests: requestsQ.rows
  });
}
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://www.nrroadcare.in");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method === "OPTIONS") return res.status(204).end();
  try {
    if (!SECRET || SECRET.length < 32) return json(res, 503, { error: "Customer login is temporarily unavailable. Please contact support." });
    await ensureSchema();
    const action = clean(req.query?.action || "");
    if (req.method === "POST" && action === "login") return await login(req, res);
    if (req.method === "GET" && action === "dashboard") return await dashboard(req, res);
    return json(res, 404, { error: "Not found" });
  } catch (e) {
    console.error("NRORA customer panel error", e);
    return json(res, 500, { error: "Unable to load customer panel right now. Please try again later." });
  }
}
