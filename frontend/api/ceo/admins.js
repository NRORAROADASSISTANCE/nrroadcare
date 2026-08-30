import pg from "pg";
import crypto from "crypto";

const { Pool } = pg;
const pool = globalThis.__nroraCeoAdminPool || new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});
globalThis.__nroraCeoAdminPool = pool;

const SECRET = process.env.SESSION_SECRET || "change-this-session-secret-in-vercel";
const json = (res, status, body) => res.status(status).json(body);
const hash = (password) => crypto.createHash("sha256").update(`${SECRET}:${password}`).digest("hex");

function readToken(req) {
  try {
    const raw = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const [payload, signature] = raw.split(".");
    if (!payload || !signature) return null;
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const expected = crypto.createHmac("sha256", SECRET)
      .update(`${user.id}:${user.username}:${user.role}`)
      .digest("hex");
    if (signature.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    if (!user.exp || user.exp < Date.now()) return null;
    return user;
  } catch {
    return null;
  }
}

async function ensureUsersTable() {
  await pool.query(`create table if not exists users(
    id bigserial primary key,
    username varchar(80) unique not null,
    password_hash text not null,
    role varchar(30) not null default 'staff',
    name varchar(120) not null,
    phone varchar(20) default '',
    active boolean default true,
    created_at timestamptz default now()
  )`);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();

  try {
    await ensureUsersTable();
    const user = readToken(req);
    if (!user || user.role !== "ceo") return json(res, 401, { error: "CEO authorization required" });

    if (req.method === "GET") {
      const result = await pool.query(
        "select id,username,name,phone,active,created_at from users where role='admin' order by created_at desc"
      );
      return json(res, 200, result.rows);
    }

    if (req.method === "POST") {
      const body = req.body || {};
      const name = String(body.name || "").trim();
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      const phone = String(body.phone || "").trim();

      if (!name || !username || !password) {
        return json(res, 400, { error: "Name, username and password are required" });
      }
      if (password.length < 6) {
        return json(res, 400, { error: "Password must be at least 6 characters" });
      }

      const existing = await pool.query("select id from users where lower(username)=lower($1) limit 1", [username]);
      if (existing.rowCount) return json(res, 409, { error: "Username already exists" });

      const result = await pool.query(
        "insert into users(username,password_hash,role,name,phone,active) values($1,$2,'admin',$3,$4,true) returning id,username,role,name,phone,active,created_at",
        [username, hash(password), name, phone]
      );

      return json(res, 201, { ok: true, admin: result.rows[0], message: "Admin created successfully." });
    }

    return json(res, 405, { error: "Method Not Allowed" });
  } catch (error) {
    console.error("NRORA CEO admin API error", error);
    return json(res, 500, { error: error?.message || "Unable to create admin" });
  }
}
