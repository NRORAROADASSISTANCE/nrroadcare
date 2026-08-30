import React,{Suspense,lazy,useEffect} from "react";
import {createRoot} from "react-dom/client";
import {HashRouter} from "react-router-dom";
import App from "./App.jsx";
import CeoApp from "./CeoApp.jsx";
import MechanicApp from "./MechanicApp.jsx";
import "./styles.css";
const CustomerDetailsOverlay=lazy(()=>import("./CustomerDetailsOverlay.jsx"));
const isCeoMode=new URLSearchParams(window.location.search).get("ceo")==="1";
const ceoToken=localStorage.getItem("nrora_ceo_token");
if(ceoToken)localStorage.setItem("nrora_token",ceoToken);
const currentToken=localStorage.getItem("nrora_token")||"";
let tokenRole="";
try{const[p]=currentToken.split(".");tokenRole=JSON.parse(atob(p.replace(/-/g,"+").replace(/_/g,"/"))).role||""}catch{}
class AppErrorBoundary extends React.Component{constructor(p){super(p);this.state={error:null}}static getDerivedStateFromError(error){return{error}}componentDidCatch(error,info){console.error("NRORA frontend runtime error",error,info)}render(){if(this.state.error)return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,fontFamily:"Arial,sans-serif",background:"#f7f8fb"}}><div style={{maxWidth:620,width:"100%",background:"white",border:"1px solid #e5e7eb",borderRadius:16,padding:24}}><h2>NRORA page error</h2><p>The page failed to render. Your login session is not being deleted.</p><pre style={{whiteSpace:"pre-wrap",fontSize:13,background:"#f3f4f6",padding:12,borderRadius:10,overflow:"auto"}}>{String(this.state.error?.message||this.state.error)}</pre><button onClick={()=>location.reload()}>Reload</button></div></div>;return this.props.children}}
function AutoOpenCustomerRegistration(){useEffect(()=>{let timer=null;let cancelled=false;const open=()=>{if(cancelled||!location.hash.startsWith("#/customers"))return;let tries=0;const find=()=>{if(cancelled||!location.hash.startsWith("#/customers"))return;const btn=[...document.querySelectorAll("button")].find(b=>b.textContent?.includes("Full Customer Registration"));if(btn){btn.click();return}if(tries++<40)timer=setTimeout(find,75)};find()};open();const onHash=()=>{if(timer)clearTimeout(timer);open()};window.addEventListener("hashchange",onHash);return()=>{cancelled=true;if(timer)clearTimeout(timer);window.removeEventListener("hashchange",onHash)}},[]);return null}
function AdminRoot(){return <HashRouter><AppErrorBoundary><App/><Suspense fallback={null}><CustomerDetailsOverlay/></Suspense><AutoOpenCustomerRegistration/></AppErrorBoundary></HashRouter>}
const root=createRoot(document.getElementById("root"));
if(isCeoMode&&ceoToken)root.render(<AppErrorBoundary><CeoApp/></AppErrorBoundary>);else if(tokenRole==="mechanic")root.render(<AppErrorBoundary><MechanicApp/></AppErrorBoundary>);else root.render(<AdminRoot/>);
