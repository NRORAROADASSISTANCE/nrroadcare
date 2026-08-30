import React,{useEffect,useState}from"react";
import CustomerDetailsOverlay from"./CustomerDetailsOverlayFixed.jsx";
const getRole=()=>{const t=localStorage.getItem("nrora_token")||localStorage.getItem("nrora_ceo_token")||"";try{return JSON.parse(atob(t.split(".")[0].replace(/-/g,"+").replace(/_/g,"/"))).role||""}catch{return""}};
export default function CustomerRegistrationAccess(){
 const[loggedIn,setLoggedIn]=useState(Boolean(localStorage.getItem("nrora_token")||localStorage.getItem("nrora_ceo_token")));
 const[hash,setHash]=useState(location.hash);
 useEffect(()=>{const sync=()=>{setLoggedIn(Boolean(localStorage.getItem("nrora_token")||localStorage.getItem("nrora_ceo_token")));setHash(location.hash)};window.addEventListener("storage",sync);window.addEventListener("hashchange",sync);const id=setInterval(sync,1000);return()=>{window.removeEventListener("storage",sync);window.removeEventListener("hashchange",sync);clearInterval(id)}},[]);
 const open=()=>{const role=getRole();if(role==="ceo"||role==="mechanic"){window.open("/register","_blank","noopener,noreferrer");return}location.hash="/customers"};
 if(!loggedIn)return null;
 const onCustomerPage=hash.startsWith("#/customers")||hash==="#customers";
 return <>{!onCustomerPage&&<button type="button" onClick={open} style={{position:"fixed",right:22,bottom:22,zIndex:300,border:0,borderRadius:13,padding:"13px 16px",background:"#1765e8",color:"#fff",fontWeight:800,boxShadow:"0 10px 30px rgba(23,101,232,.3)",cursor:"pointer",display:"flex",gap:8,alignItems:"center"}}>👤 Full Customer Registration</button>}<CustomerDetailsOverlay/></>;
}
