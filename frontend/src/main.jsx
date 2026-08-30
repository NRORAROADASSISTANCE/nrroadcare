import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import CeoApp from "./CeoApp.jsx";
import MechanicApp from "./MechanicApp.jsx";
import CustomerDetailsOverlay from "./CustomerDetailsOverlay.jsx";
import "./styles.css";
const isCeoMode=new URLSearchParams(window.location.search).get("ceo")==="1";
const ceoToken=localStorage.getItem("nrora_ceo_token");
if(ceoToken)localStorage.setItem("nrora_token",ceoToken);
const currentToken=localStorage.getItem("nrora_token")||"";
let tokenRole="";
try{const[p]=currentToken.split(".");tokenRole=JSON.parse(atob(p.replace(/-/g,"+").replace(/_/g,"/"))).role||""}catch{}
/* Keep a valid local session during transient auth API 404/5xx/network failures. A real 401 still logs out. */
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{const url=typeof input==="string"?input:(input?.url||"");if(url.includes("/api/auth/me")){try{const r=await nativeFetch(input,init);if(r.status!==401){if(r.ok)return r;const t=localStorage.getItem("nrora_token")||localStorage.getItem("nrora_ceo_token");if(t){try{const[p]=t.split(".");const u=JSON.parse(atob(p.replace(/-/g,"+").replace(/_/g,"/")));return new Response(JSON.stringify({user:{id:u.id,username:u.username,role:u.role,name:u.username,phone:""}}),{status:200,headers:{"Content-Type":"application/json"}})}catch{}}}return r}catch{const t=localStorage.getItem("nrora_token")||localStorage.getItem("nrora_ceo_token");if(t){try{const[p]=t.split(".");const u=JSON.parse(atob(p.replace(/-/g,"+").replace(/_/g,"/")));return new Response(JSON.stringify({user:{id:u.id,username:u.username,role:u.role,name:u.username,phone:""}}),{status:200,headers:{"Content-Type":"application/json"}})}catch{}}throw new Error("Network unavailable")}}return nativeFetch(input,init)};
class AppErrorBoundary extends React.Component{constructor(props){super(props);this.state={error:null}}static getDerivedStateFromError(error){return{error}}componentDidCatch(error,info){console.error("NRORA frontend runtime error",error,info)}render(){if(this.state.error)return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,fontFamily:"Arial,sans-serif",background:"#f7f8fb"}}><div style={{maxWidth:620,width:"100%",background:"white",border:"1px solid #e5e7eb",borderRadius:16,padding:24}}><h2 style={{marginTop:0}}>NRORA page error</h2><p>The page failed to render. Your login session is not being deleted.</p><pre style={{whiteSpace:"pre-wrap",fontSize:13,background:"#f3f4f6",padding:12,borderRadius:10,overflow:"auto"}}>{String(this.state.error?.message||this.state.error)}</pre><button onClick={()=>window.location.reload()} style={{padding:"10px 16px",border:0,borderRadius:8,cursor:"pointer"}}>Reload</button></div></div>;return this.props.children}}
const root=createRoot(document.getElementById("root"));
if(isCeoMode&&ceoToken)root.render(<AppErrorBoundary><CeoApp/></AppErrorBoundary>);else if(tokenRole==="mechanic")root.render(<AppErrorBoundary><MechanicApp/></AppErrorBoundary>);else root.render(<HashRouter><AppErrorBoundary><App/><CustomerDetailsOverlay/></AppErrorBoundary></HashRouter>);
