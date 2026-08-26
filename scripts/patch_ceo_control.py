from pathlib import Path

# Frontend CEO session handoff.
p = Path("frontend/src/App.jsx")
s = p.read_text()
old = 'const r=await api("/auth/login",{method:"POST",body:JSON.stringify(f)});localStorage.setItem("nrora_token",r.token);onLogin(r.user);if(r.user.role==="mechanic")window.location.href="/mechanic-orders.html"'
new = 'const r=await api("/auth/login",{method:"POST",body:JSON.stringify(f)});if(r.user.role==="ceo"){localStorage.setItem("nrora_ceo_token",r.token);localStorage.setItem("nrora_token",r.token)}else{localStorage.removeItem("nrora_ceo_token");localStorage.setItem("nrora_token",r.token)}onLogin(r.user);if(r.user.role==="mechanic")window.location.href="/mechanic-orders.html"'
if old in s:
    s = s.replace(old, new)
old = 'const logout=()=>{localStorage.removeItem("nrora_token");setUser(null)}'
new = 'const logout=()=>{localStorage.removeItem("nrora_token");localStorage.removeItem("nrora_ceo_token");setUser(null)}'
if old in s:
    s = s.replace(old, new)
p.write_text(s)

# CEO control page links all operational modules to the same authenticated HashRouter.
p = Path("frontend/ceo.html")
s = p.read_text()
old = 'token=r.token;localStorage.setItem("nrora_ceo_token",token);show()'
new = 'token=r.token;localStorage.setItem("nrora_ceo_token",token);localStorage.setItem("nrora_token",token);show()'
if old in s:
    s = s.replace(old, new)
old = 'logout.onclick=()=>{localStorage.removeItem("nrora_ceo_token");location.reload()}'
new = 'logout.onclick=()=>{localStorage.removeItem("nrora_ceo_token");localStorage.removeItem("nrora_token");location.reload()}'
if old in s:
    s = s.replace(old, new)
marker = '<section class="card"><h2>⚙️ System Settings</h2>'
if marker in s and 'CEO Operations' not in s:
    nav = '<section class="card"><h2>🚀 CEO Operations</h2><p class="sub">CEO stays in control; these modules never ask for a second Admin login.</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px"><a class="btn" href="/#/" style="text-decoration:none;text-align:center">Dashboard</a><a class="btn" href="/#/requests" style="text-decoration:none;text-align:center">Requests</a><a class="btn" href="/#/customers" style="text-decoration:none;text-align:center">Customers</a><a class="btn" href="/#/technicians" style="text-decoration:none;text-align:center">Technicians</a><a class="btn" href="/#/employees" style="text-decoration:none;text-align:center">Employees & Roles</a><a class="btn" href="/#/settings" style="text-decoration:none;text-align:center">Settings</a><a class="btn" href="/#/contact" style="text-decoration:none;text-align:center">Contact</a></div><p class="muted" style="margin-bottom:0">Employees & Roles is where CEO can create Admin, Division Manager, Area Manager, TL, Staff, Telecaller and Mechanic accounts.</p></section>'
    s = s.replace(marker, nav + marker)
p.write_text(s)

# Backend CEO permissions and role creation.
p = Path("backend/src/server.js")
s = p.read_text()
s = s.replace('const staffRoles=["admin","division_manager","area_manager","tl","staff","employee"];', 'const staffRoles=["ceo","admin","division_manager","area_manager","tl","staff","telecaller","employee"];')

start = s.index('app.get("/api/employees"')
end = s.index('app.patch("/api/employees/:id"', start)
block = '''app.get("/api/employees",auth(["ceo","admin","division_manager","area_manager","tl"]),asyncRoute(async(req,res)=>{const r=await pool.query("select id,username,role,name,phone,active,created_at from users where role in ('admin','employee','staff','division_manager','area_manager','tl','telecaller','mechanic') order by created_at desc");res.json(r.rows);}));
app.post("/api/employees",auth(["ceo","admin","division_manager","area_manager","tl"]),asyncRoute(async(req,res)=>{
  const {username,password,name,phone="",role="staff"}=req.body;
  if(!username||!password||!name)return res.status(400).json({error:"name, username and password are required"});
  const allowedBy={ceo:["admin","division_manager","area_manager","tl","staff","telecaller","mechanic"],admin:["division_manager","area_manager","tl","staff","telecaller"],division_manager:["area_manager","tl","staff","telecaller"],area_manager:["tl","staff","telecaller"],tl:["staff","telecaller"]};
  if(!(allowedBy[req.user.role]||[]).includes(role))return res.status(403).json({error:"You cannot create this role"});
  const client=await pool.connect();
  try{
    await client.query("begin");
    const u=await client.query("insert into users(username,password_hash,role,name,phone) values($1,$2,$3,$4,$5) returning id,username,role,name,phone,active",[username,hashPassword(password),role,name,phone]);
    if(role==="mechanic") await client.query("insert into mechanics(name,phone,username,password_hash) values($1,$2,$3,$4) on conflict (username) do nothing",[name,phone,username,hashPassword(password)]);
    await client.query("commit");
    res.status(201).json(u.rows[0]);
  }catch(e){await client.query("rollback");throw e}finally{client.release()}
}));
'''
s = s[:start] + block + s[end:]

repls = {
'app.delete("/api/customers/:id",auth(["admin"]),': 'app.delete("/api/customers/:id",auth(["ceo","admin"]),',
'app.get("/api/mechanics",auth(["admin","division_manager","area_manager","tl","staff","employee"]),': 'app.get("/api/mechanics",auth(["ceo","admin","division_manager","area_manager","tl","staff","telecaller","employee"]),',
'app.post("/api/mechanics",auth(["admin"]),': 'app.post("/api/mechanics",auth(["ceo","admin"]),',
'app.patch("/api/mechanics",auth(["admin"]),': 'app.patch("/api/mechanics",auth(["ceo","admin"]),',
'app.delete("/api/mechanics",auth(["admin"]),': 'app.delete("/api/mechanics",auth(["ceo","admin"]),',
'app.post("/api/payments/create-order",auth(["admin","employee","staff"]),': 'app.post("/api/payments/create-order",auth(["ceo","admin","employee","staff","telecaller"]),',
'app.post("/api/payments/verify",auth(["admin","employee","staff"]),': 'app.post("/api/payments/verify",auth(["ceo","admin","employee","staff","telecaller"]),',
'app.get("/api/payments/status",auth(["admin","employee","staff"]),': 'app.get("/api/payments/status",auth(["ceo","admin","employee","staff","telecaller"]),',
'app.post("/api/payments",auth(["admin","employee","staff"]),': 'app.post("/api/payments",auth(["ceo","admin","employee","staff","telecaller"]),',
'app.post("/api/memberships/renew",auth(["admin","employee","staff"]),': 'app.post("/api/memberships/renew",auth(["ceo","admin","employee","staff","telecaller"]),',
}
for old, new in repls.items():
    s = s.replace(old, new)
p.write_text(s)
