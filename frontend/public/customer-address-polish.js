/* NRORA address UI: Mandal and Village/Town are dropdown-only. */
(function(){
  function polish(){
    if(!location.hash.startsWith('#/customers')) return;
    const forms=[...document.querySelectorAll('form')];
    const form=forms.find(f=>(f.textContent||'').toUpperCase().includes('MANDAL SEARCH'));
    if(!form) return;
    const labels=[...form.querySelectorAll('label')];
    labels.forEach(label=>{
      const text=(label.textContent||'').trim().toUpperCase();
      if(text.startsWith('MANDAL SEARCH')){
        label.style.display='none';
        const input=label.querySelector('input');
        if(input) input.removeAttribute('required');
      }
      if(text.startsWith('VILLAGE / TOWN SEARCH')){
        label.style.display='none';
        const input=label.querySelector('input');
        if(input) input.removeAttribute('required');
      }
    });
    const mandalLabel=labels.find(l=>(l.textContent||'').trim().toUpperCase().startsWith('MANDAL *'));
    const villageLabel=labels.find(l=>(l.textContent||'').trim().toUpperCase().startsWith('VILLAGE / TOWN *'));
    const mandal=mandalLabel?.querySelector('select');
    const village=villageLabel?.querySelector('select');
    if(mandal){
      const first=mandal.querySelector('option[value=""]');
      if(first) first.textContent='Select Mandal';
    }
    if(village){
      const first=village.querySelector('option[value=""]');
      if(first) first.textContent='Select Village / Town';
    }
  }
  const observer=new MutationObserver(polish);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  polish();
  window.addEventListener('hashchange',polish);
})();
