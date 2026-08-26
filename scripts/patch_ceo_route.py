from pathlib import Path
import re

# CEO operations must use the same authenticated React app without falling into
# the normal Admin/Employee login. Patch the Login component by function boundary
# instead of depending on one exact minified string.
p = Path("frontend/src/App.jsx")
s = p.read_text(encoding="utf-8")

login = '''function Login({onLogin}){const ceoMode=new URLSearchParams(window.location.search).get("ceo")==="1";const[f,setF]=useState({username:ceoMode?"ceo":"admin",password:""}),[error,setError]=useState("");const submit=async e=>{e.preventDefault();setError("");try{const r=await api("/auth/login",{method:"POST",body:JSON.stringify(f)});if(ceoMode&&r.user.role!=="ceo")throw new Error("CEO login required");if(r.user.role==="ceo"){localStorage.setItem("nrora_ceo_token",r.token);localStorage.setItem("nrora_token",r.token)}else{localStorage.removeItem("nrora_ceo_token");localStorage.setItem("nrora_token",r.token)}onLogin(r.user);if(r.user.role==="mechanic")window.location.href="/mechanic-orders.html"}catch(e){setError(e.message)}};return <div className="login"><div className="login-card"><div className="brand"><div className="logo">NR</div><div><b>NRORA</b><small>{ceoMode?"CEO Operations Login":"Admin / Employee / Mechanic Login"}</small></div></div><h1>{ceoMode?"CEO Sign in":"Sign in"}</h1><form onSubmit={submit}><label>USERNAME<input value={f.username} onChange={e=>setF({...f,username:e.target.value})}/></label><label>PASSWORD<input type="password" value={f.password} onChange={e=>setF({...f,password:e.target.value})}/></label>{error&&<p className="error">{error}</p>}<button className="primary">{ceoMode?"CEO Login":"Login"}</button></form></div></div>}'''

m = re.search(r'function Login\(\{onLogin\}\)\{.*?(?=function Layout\(\{user,onLogout\}\))', s, flags=re.S)
if m:
    s = s[:m.start()] + login + "\n" + s[m.end():]
else:
    raise SystemExit("Could not locate Login component")

# Always prefer the CEO token if it exists, even if an old Admin token is present.
s = s.replace('const getToken=()=>localStorage.getItem("nrora_token")||localStorage.getItem("nrora_ceo_token");',
              'const getToken=()=>localStorage.getItem("nrora_ceo_token")||localStorage.getItem("nrora_token");')

p.write_text(s, encoding="utf-8")

# Keep CEO navigation explicitly in CEO mode. These links intentionally open the
# React application with ?ceo=1 so Login renders CEO mode if a session is missing.
p = Path("frontend/ceo.html")
s = p.read_text(encoding="utf-8")
for route in ["/", "/requests", "/customers", "/technicians", "/employees", "/settings", "/contact", "/permissions"]:
    s = s.replace(f'href="/?ceo=1#{route}"', f'href="/?ceo=1#{route}"')
# Remove the old Admin-oriented explanatory text if present.
s = s.replace('They will not send you back to the Admin login.', 'CEO session is preserved across every operation.')
p.write_text(s, encoding="utf-8")
