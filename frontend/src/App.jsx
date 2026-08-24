import React,{useEffect,useState} from "react";
import {Routes,Route,NavLink,useNavigate} from "react-router-dom";
import {Home,Users,MapPin,Settings,Phone,Globe,Map,LogIn,UserPlus,Wrench,Menu,X,Plus,Trash2,RefreshCw} from "lucide-react";

const API=import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const phone="9160264439", domain="nrroadcare.in";

function Layout(){
 const [open,setOpen]=useState(false);
 const links=[["/",Home,"Dashboard"],["/requests",MapPin,"Requests"],["/customers",UserPlus,"Customers"],["/technicians",Users,"Technicians"],["/payments",RefreshCw,"Payments"],["/employee-login",LogIn,"Employee Login"],["/mechanic-login",Wrench,"Mechanic Login"],["/settings",Settings,"Settings"],["/contact",Map,"Contact"]];
 return <div className="shell">
  <button className="mobile" onClick={()=>setOpen(!open)}>{open?<X/>:<Menu/>}</button>
  <aside className={open?"side open":"side"}>
   <div className="brand"><div className="logo">NR</div><div><b>NR Road Care</b><small>Road Assistance</small></div></div>
   <nav>{links.map(([to,I,label])=><NavLink key={to} to={to} end={to==="/"} onClick={()=>setOpen(false)} className={({isActive})=>isActive?"nav active":"nav"}><I size={18}/>{label}</NavLink>)}</nav>
   <div className="footer"><a href={`tel:${phone}`}><Phone size={15}/>{phone}</a><a href={`https://${domain}`} target="_blank" rel="noreferrer"><Globe size={15}/>{domain}</a><span><Map size={15}/>Mugpal Village, Mugpal Mandal,<br/>Nizamabad District, Telangana 503230</span></div>
  </aside>
  <main><Routes><Route path="/" element={<Dashboard/>}/><Route path="/customers" element={<Customers/>}/><Route path="/requests" element={<Requests/>}/><Route path="/technicians" element={<Technicians/>}/><Route path="/payments" element={<Payments/>}/><Route path="/employee-login" element={<Login title="Employee Login"/>}/><Route path="/mechanic-login" element={<Login title="Mechanic Login"/>}/><Route path="/settings" element={<SettingsPage/>}/><Route path="/contact" element={<Contact/>}/></Routes></main>
 </div>
}

function Dashboard(){
 const [d,setD]=useState(null);
 useEffect(()=>{fetch(`${API}/dashboard`).then(r=>r.json()).then(setD).catch(()=>{})},[]);
 return <Page title="Dashboard" sub="NR Road Care operations">
  <div className="stats"><Stat t="Customers" v={d?.customers??"—"}/><Stat t="Active Requests" v={d?.activeRequests??"—"}/><Stat t="Technicians" v={d?.techniciansOnline??"—"}/><Stat t="Revenue" v={d?`₹${d.revenue}`:"—"}/></div>
  <div className="card"><h2>Yearly Membership</h2><p className="muted">₹4,500 per year</p><p className="muted">Payment, receipt and renewal APIs are ready for integration.</p></div>
 </Page>
}
const Stat=({t,v})=><div className="stat"><small>{t}</small><strong>{v}</strong></div>;

function Customers(){
 const [rows,setRows]=useState([]),[f,setF]=useState({name:"",phone:"",address:"",vehicle_no:""});
 const load=()=>fetch(`${API}/customers`).then(r=>r.json()).then(setRows).catch(()=>setRows([]));
 useEffect(load,[]);
 const add=async e=>{e.preventDefault();await fetch(`${API}/customers`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(f)});setF({name:"",phone:"",address:"",vehicle_no:""});load()};
 const del=async id=>{await fetch(`${API}/customers/${id}`,{method:"DELETE"});load()};
 return <Page title="Customers" sub="Customer records"><div className="cols"><form className="card form" onSubmit={add}><h2><Plus size={18}/> Add Customer</h2>{Object.keys(f).map(k=><label key={k}>{k.replace("_"," ").toUpperCase()}<input required={k!=="address"} value={f[k]} onChange={e=>setF({...f,[k]:e.target.value})}/></label>)}<button className="primary">Add Customer</button></form><div className="card"><h2>Customer List</h2>{rows.length===0?<p className="muted">No customers yet.</p>:rows.map(c=><div className="row" key={c.id}><div><b>{c.name}</b><small>{c.phone} · {c.vehicle_no}</small><small>{c.address}</small></div><button className="danger" onClick={()=>del(c.id)}><Trash2 size={17}/></button></div>)}</div></div></Page>
}
function Requests(){return <Page title="Service Requests" sub="Live roadside assistance requests"><div className="card empty"><MapPin/><h2>Requests API ready</h2><p className="muted">Connect the mobile request form to POST /api/requests.</p></div></Page>}
function Technicians(){return <Page title="Technicians" sub="Mechanic and field technician management"><div className="card empty"><Users/><h2>Technician API ready</h2><p className="muted">Add technicians through POST /api/technicians.</p></div></Page>}
function Payments(){return <Page title="Payments & Receipts" sub="Membership payment and instant receipt workflow"><div className="card"><h2>Membership</h2><p className="muted">₹4,500 · UPI / QR supported at API layer.</p><p className="muted">Payment creates a receipt number automatically.</p></div></Page>}
function Login({title}){const nav=useNavigate();return <Page title={title} sub="Secure authentication will connect to the production auth service."><form className="card form login" onSubmit={e=>{e.preventDefault();nav("/")}}><label>Username<input required/></label><label>Password<input type="password" required/></label><button className="primary">Login</button></form></Page>}
function SettingsPage(){return <Page title="Settings" sub="System configuration"><div className="card"><h2>NR Road Care</h2><p className="muted">Domain: {domain}</p><p className="muted">Membership: ₹4,500 / year</p><p className="muted">Phone: {phone}</p></div></Page>}
function Contact(){return <Page title="Contact Us" sub="Mugpal Village, Mugpal Mandal, Nizamabad District, Telangana 503230"><div className="card"><a className="primary" href={`tel:${phone}`}><Phone/> Call {phone}</a></div></Page>}
const Page=({title,sub,children})=><section><div className="head"><div><span>NR ROAD CARE</span><h1>{title}</h1><p>{sub}</p></div></div>{children}</section>;

export default function App(){return <Layout/>}
