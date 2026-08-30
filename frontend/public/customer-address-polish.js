/* NRORA address UI polish: keep Mandal/Village as dropdowns only. */
(function(){
  function polish(){
    if(!location.hash.startsWith('#/customers')) return;
    const form=document.querySelector('form');
    if(!form) return;
    const sections=[...form.querySelectorAll('section')];
    const address=sections[1];
    if(!address) return;
    const grid=address.querySelector('div');
    if(!grid) return;
    const labels=[...grid.children];
    // Current Address grid order: house, landmark, state, district, mandal-search, mandal, village-search, village, pin.
    [labels[4],labels[6]].forEach(el=>{if(el){el.style.display='none';const control=el.querySelector('input');if(control)control.removeAttribute('required')}});
    const mandal=labels[5]?.querySelector('select');
    const village=labels[7]?.querySelector('select');
    if(mandal){const first=mandal.querySelector('option');if(first&&first.value==='')first.textContent='Select Mandal';mandal.removeAttribute('disabled')}
    if(village){const first=village.querySelector('option');if(first&&first.value==='')first.textContent='Select Village / Town';}
  }
  const observer=new MutationObserver(polish);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  polish();
  window.addEventListener('hashchange',polish);
})();
