from pathlib import Path
p = Path('frontend/src/App.jsx')
s = p.read_text(encoding='utf-8')
start = s.index('function Customers({user}){')
end = s.index('function Employees({user}){', start)
block = s[start:end]

marker = 'const add=async e=>'
helper = 'const readPhoto=file=>new Promise((resolve,reject)=>{if(!file)return resolve("");const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error("Unable to read image"));r.readAsDataURL(file)});const choosePhoto=async(key,file)=>{if(!file)return;try{setError("");const data=await readPhoto(file);setF(x=>({...x,[key]:data}))}catch(e){setError(e.message)}};'
if 'const readPhoto=file=>new Promise' not in block:
    block = block.replace(marker, helper + marker)

old1 = '<label>VEHICLE PHOTO 1 URL<input value={f.photo1} onChange={e=>setF({...f,photo1:e.target.value})} placeholder="Optional image URL"/></label>'
old2 = '<label>VEHICLE PHOTO 2 URL<input value={f.photo2} onChange={e=>setF({...f,photo2:e.target.value})} placeholder="Optional image URL"/></label>'
new1 = '<label>VEHICLE PHOTO 1<input type="file" accept="image/*" capture="environment" onChange={e=>choosePhoto("photo1",e.target.files?.[0])}/>{f.photo1&&<small>Photo selected ✓</small>}</label>'
new2 = '<label>VEHICLE PHOTO 2<input type="file" accept="image/*" capture="environment" onChange={e=>choosePhoto("photo2",e.target.files?.[0])}/>{f.photo2&&<small>Photo selected ✓</small>}</label>'
block = block.replace(old1,new1).replace(old2,new2)

photo_box = 'const photoBox=(key,label)=><div><label>{label}<input type="file" accept="image/*" capture="environment" onChange={e=>choosePhoto(key,e.target.files?.[0])}/></label>{f[key]&&<div style={{marginTop:8}}><img src={f[key]} alt={label} style={{width:"100%",maxHeight:180,objectFit:"contain",borderRadius:10,border:"1px solid #d7e0ee"}}/><button className="danger" type="button" style={{marginTop:6}} onClick={()=>setF(x=>({...x,[key]:""}))}>Remove Photo</button></div>}</div>;'
if 'const photoBox=' not in block:
    return_marker = 'return <Page title="Customers"'
    block = block.replace(return_marker, photo_box + return_marker)
block = block.replace(new1, '{photoBox("photo1","VEHICLE PHOTO 1")}').replace(new2, '{photoBox("photo2","VEHICLE PHOTO 2")}')

if 'VEHICLE PHOTO 1 URL' in block or 'VEHICLE PHOTO 2 URL' in block:
    raise SystemExit('Vehicle photo URL fields were not replaced')
if 'Remove Photo' not in block or 'type="file" accept="image/*"' not in block:
    raise SystemExit('Vehicle photo upload/remove UI was not added')
p.write_text(s[:start] + block + s[end:], encoding='utf-8')
print('Customer vehicle photo upload UI patched with preview/remove')
