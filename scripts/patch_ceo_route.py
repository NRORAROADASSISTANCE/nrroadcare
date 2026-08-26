from pathlib import Path

# Keep CEO operations on the same authenticated app without falling into the Admin login.
p = Path("frontend/src/App.jsx")
s = p.read_text()
old = 'function Login({onLogin}){const[f,setF]=useState({username:"admin",password:""}),[error,setError]=useState("");const submit=async e=>{e.preventDefault();setError("");try{const r=await api("/auth/login",{method:"POST",body:JSON.stringify(f)});if(r.user.role==="ceo"){localStorage.setItem("nrora_ceo_token",r.token);localStorage.setItem("nrora_token",r.token)}else{localStorage.removeItem("nrora_ceo_token");localStorage.setItem("nrora_token",r.token)}onLogin(r.user);if(r.user.role==="mechanic")window.location.href="/mechanic-orders.html"}catch(e){setError(e.message)}};return <div className="login"><div className="login-card"><div className="brand"><div className="logo">NR</div><div><b>NRORA</b><small>Admin / Employee / Mechanic Login</small></div></div><h1>Sign in</h1><form onSubmit={submit}><label>USERNAME<input value={f.username} onChange={e=>setF({...f,username:e.target.value})}/></label><label>PASSWORD<input type="password" value={f.password} onChange={e=>setF({...f,password:e.target.value})}/></label>{error&&<p className="error">{error}</p>}<button className="primary">Login</button></form></div></div>}'
new = 'function Login({onLogin}){const ceoMode=new URLSearchParams(window.location.search).get("ceo")==="1";const[f,setF]=useState({username:ceoMode?"ceo":"admin",password:""}),[error,setError]=useState("");const submit=async e=>{e.preventDefault();setError("");try{const r=await api("/auth/login",{method:"POST",body:JSON.stringify(f)});if(ceoMode&&r.user.role!=="ceo")throw new Error("CEO login required");if(r.user.role==="ceo"){localStorage.setItem("nrora_ceo_token",r.token);localStorage.setItem("nrora_token",r.token)}else{localStorage.removeItem("nrora_ceo_token");localStorage.setItem("nrora_token",r.token)}onLogin(r.user);if(r.user.role==="mechanic")window.location.href="/mechanic-orders.html"}catch(e){setError(e.message)}};return <div className="login"><div className="login-card"><div className="brand"><div className="logo">NR</div><div><b>NRORA</b><small>{ceoMode?"CEO Operations Login":"Admin / Employee / Mechanic Login"}</small></div></div><h1>{ceoMode?"CEO Sign in":"Sign in"}</h1><form onSubmit={submit}><label>USERNAME<input value={f.username} onChange={e=>setF({...f,username:e.target.value})}/></label><label>PASSWORD<input type="password" value={f.password} onChange={e=>setF({...f,password:e.target.value})}/></label>{error&&<p className="error">{error}</p>}<button className="primary">{ceoMode?"CEO Login":"Login"}</button></form></div></div>}'
if old not in s:
    raise SystemExit("Login block not found; no change made")
s = s.replace(old, new)
p.write_text(s)

p = Path("frontend/ceo.html")
s = p.read_text()
for route in ["/","/requests","/customers","/technicians","/employees","/settings","/contact"]:
    s = s.replace(f'href="/#' + route, f'href="/?ceo=1#' + route)
p.write_text(s)
