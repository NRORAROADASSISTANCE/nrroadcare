(function(){
  const originalFetch=window.fetch.bind(window);
  const villages=['Amrabad','Badsi','Bhairapur','Chinnapur','Kalpole','Kanjar','Kulaspur','Manchippa','Mudakpalle','Mugpal','Narsingpally','Nyalkal','Sirpur','Thana Khurd','Yellamkunta'];
  window.fetch=function(input,init){
    try{
      const raw=typeof input==='string'?input:(input&&input.url)||'';
      const u=new URL(raw,location.origin);
      const where=u.searchParams.get('where')||'';
      if(u.origin===location.origin && u.pathname==='/api/telangana/villages' && where.includes("DISTRICT_NAME='Nizamabad'") && where.includes("MANDAL_NAME='Mugpal'")){
        return Promise.resolve(new Response(JSON.stringify({features:villages.map(v=>({attributes:{VILLAGE_NAME:v,MANDAL_NAME:'Mugpal',DISTRICT_NAME:'Nizamabad'}}))}),{status:200,headers:{'Content-Type':'application/json'}}));
      }
    }catch(e){}
    return originalFetch(input,init);
  };
})();
