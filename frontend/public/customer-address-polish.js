/* NRORA address UI: dropdown-only plus verified Mugpal village master. */
(function(){
  const originalFetch=window.fetch.bind(window);
  const mugpalVillages=['Amrabad','Badsi','Bhairapur','Chinnapur','Kalpole','Kanjar','Kulaspur','Manchippa','Mudakpalle','Mugpal','Narsingpally','Nyalkal','Sirpur','Thana Khurd','Yellamkunta'];
  window.fetch=function(input,init){
    try{
      const raw=typeof input==='string'?input:(input&&input.url)||'';
      const u=new URL(raw,location.origin);
      const where=u.searchParams.get('where')||'';
      if(u.origin===location.origin&&u.pathname==='/api/telangana/villages'&&where.includes("DISTRICT_NAME='Nizamabad'")&&where.includes("MANDAL_NAME='Mugpal'")){
        const features=mugpalVillages.map(v=>({attributes:{VILLAGE_NAME:v,MANDAL_NAME:'Mugpal',DISTRICT_NAME:'Nizamabad'}}));
        return Promise.resolve(new Response(JSON.stringify({features}),{status:200,headers:{'Content-Type':'application/json'}}));
      }
    }catch(e){}
    return originalFetch(input,init);
  };
  function polish(){
    if(!location.hash.startsWith('#/customers'))return;
    document.querySelectorAll('label').forEach(label=>{
      const text=(label.textContent||'').trim().toUpperCase();
      if(text.startsWith('MANDAL SEARCH')||text.startsWith('VILLAGE / TOWN SEARCH'))label.style.display='none';
    });
    document.querySelectorAll('select').forEach(s=>{
      const t=(s.parentElement?.textContent||'').trim().toUpperCase();
      const first=s.querySelector('option[value=""]');
      if(!first)return;
      if(t.startsWith('MANDAL *'))first.textContent='Select Mandal';
      if(t.startsWith('VILLAGE / TOWN *'))first.textContent='Select Village / Town';
    });
  }
  const observer=new MutationObserver(polish);observer.observe(document.documentElement,{subtree:true,childList:true});polish();window.addEventListener('hashchange',polish);
})();
