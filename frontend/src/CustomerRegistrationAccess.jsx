import React,{useEffect,useState}from"react";
import CustomerDetailsOverlay from"./CustomerDetailsOverlayFixed.jsx";
export default function CustomerRegistrationAccess(){
 const[loggedIn,setLoggedIn]=useState(Boolean(localStorage.getItem("nrora_token")||localStorage.getItem("nrora_ceo_token")));
 useEffect(()=>{const sync=()=>setLoggedIn(Boolean(localStorage.getItem("nrora_token")||localStorage.getItem("nrora_ceo_token")));window.addEventListener("storage",sync);const id=setInterval(sync,1000);return()=>{window.removeEventListener("storage",sync);clearInterval(id)}},[]);
 const open=()=>{const ceo=new URLSearchParams(location.search).get("ceo")==="1";location.hash=ceo?"customers":"/customers"};
 if(!loggedIn)return null;
 return <><button type="button" onClick={open} style={{position:"fixed",right:22,bottom:22,zIndex:300,border:0,borderRadius:13,padding:"13px 16px",background:"#1765e8",color:"#fff",fontWeight:800,boxShadow:"0 10px 30px rgba(23,101,232,.3)",cursor:"pointer",display:"flex",gap:8,alignItems:"center"}}>👤 Full Customer Registration</button><CustomerDetailsOverlay/></>;
}
