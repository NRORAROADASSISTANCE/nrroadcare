import React from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";

// CEO is the highest authority. Always prefer the CEO session when one exists,
// so a stale Admin/Employee token can never redirect CEO into the Admin login.
const ceoToken = localStorage.getItem("nrora_ceo_token");
if (ceoToken) localStorage.setItem("nrora_token", ceoToken);

class AppErrorBoundary extends React.Component {
  constructor(props){
    super(props);
    this.state={error:null};
  }
  static getDerivedStateFromError(error){
    return {error};
  }
  componentDidCatch(error,info){
    console.error("NRORA frontend runtime error",error,info);
  }
  render(){
    if(this.state.error){
      return <div style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,fontFamily:"Arial,sans-serif",background:"#f7f8fb"}}>
        <div style={{maxWidth:620,width:"100%",background:"white",border:"1px solid #e5e7eb",borderRadius:16,padding:24,boxShadow:"0 8px 30px rgba(0,0,0,.06)"}}>
          <h2 style={{marginTop:0}}>NRORA page error</h2>
          <p>The page failed to render. Your login session is not being deleted.</p>
          <pre style={{whiteSpace:"pre-wrap",fontSize:13,background:"#f3f4f6",padding:12,borderRadius:10,overflow:"auto"}}>{String(this.state.error?.message||this.state.error)}</pre>
          <button onClick={()=>window.location.reload()} style={{padding:"10px 16px",border:0,borderRadius:8,cursor:"pointer"}}>Reload</button>
        </div>
      </div>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")).render(
  <HashRouter>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </HashRouter>
);