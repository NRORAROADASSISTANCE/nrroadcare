from pathlib import Path

p = Path("frontend/src/App.jsx")
s = p.read_text()

# Always prefer the normal operations token, but fall back to the CEO token.
s = s.replace(
    'const getToken=()=>localStorage.getItem("nrora_token");',
    'const getToken=()=>localStorage.getItem("nrora_token")||localStorage.getItem("nrora_ceo_token");'
)

# If a non-CEO login happens, remove the CEO session so accounts cannot mix.
old = 'if(r.user.role==="ceo"){localStorage.setItem("nrora_ceo_token",r.token);localStorage.setItem("nrora_token",r.token)}else{localStorage.removeItem("nrora_ceo_token");localStorage.setItem("nrora_token",r.token)}'
new = 'if(r.user.role==="ceo"){localStorage.setItem("nrora_ceo_token",r.token);localStorage.setItem("nrora_token",r.token)}else{localStorage.removeItem("nrora_ceo_token");localStorage.setItem("nrora_token",r.token)}'
if old in s:
    s = s.replace(old, new)

p.write_text(s)
