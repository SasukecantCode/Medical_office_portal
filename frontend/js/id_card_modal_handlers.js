// Delegated handlers for ID card modal, print and download
(function(){
  function buildIdCardHtml(staff, fieldDefs){
    if(!staff) return '<!doctype html><html><body>No staff</body></html>';
    // attempt to reuse existing generators if present
    const front = (typeof generateIdCardFront === 'function') ? generateIdCardFront(staff) : '';
    const back = (typeof generateIdCardBack === 'function') ? generateIdCardBack(staff, fieldDefs) : '';
    const css = '\n<link rel="stylesheet" href="/static/css/id_card.css">\n<style>body{margin:0;padding:20px;background:#f6f7fb}</style>\n';
    return '<!doctype html><html><head><meta charset="utf-8">'+css+'</head><body><div class="id-cards-wrap">'+front+back+'</div></body></html>';
  }

  function buildIdCardHtmlBlob(staff, fieldDefs){
    const html = buildIdCardHtml(staff, fieldDefs);
    return new Blob([html], { type: 'text/html' });
  }

  function openModal(){
    const backdrop = document.getElementById('idcard-modal-backdrop');
    if(!backdrop) return;
    document.body.classList.add('idcard-open');
    backdrop.hidden = false;
    setTimeout(()=>backdrop.classList.add('open'),20);
  }

  function closeModal(){
    const backdrop = document.getElementById('idcard-modal-backdrop');
    if(!backdrop) return;
    backdrop.classList.remove('open');
    setTimeout(()=>{ backdrop.hidden = true; document.body.classList.remove('idcard-open'); }, 200);
  }

  document.addEventListener('click', async (e) => {
    const el = e.target;
    if (el.closest('#btn-print-id')){
      const staff = window.__medical_last_idcard_staff;
      const fieldDefs = window.__medical_field_defs;
      if(!staff) return;
      openModal();
      // trigger modal print button after showing
      setTimeout(()=>{
        const modalPrint = document.getElementById('idcard-print-btn');
        if(modalPrint) modalPrint.click();
      }, 60);
      return;
    }

    if (el.closest('#btn-download-id')){
      const staff = window.__medical_last_idcard_staff;
      const fieldDefs = window.__medical_field_defs;
      if(!staff) return;
      try{
        const blob = buildIdCardHtmlBlob(staff, fieldDefs);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = (staff.full_name || 'idcard').replace(/[^A-Za-z0-9_\- ]+/g, '');
        a.download = `${safeName}_IDCard.html`;
        document.body.appendChild(a);
        a.click(); a.remove(); URL.revokeObjectURL(url);
      }catch(err){ console.error(err); }
      return;
    }

    if (el.closest('#idcard-close-btn')){
      closeModal();
      return;
    }

    if (el.closest('#idcard-print-btn')){
      const staff = window.__medical_last_idcard_staff;
      const fieldDefs = window.__medical_field_defs;
      if(!staff) return;
      const html = buildIdCardHtml(staff, fieldDefs);
      const w = window.open('', '_blank');
      if(!w) return;
      w.document.write(html);
      w.document.close();
      return;
    }

    if (el.closest('#idcard-download-btn')){
      const staff = window.__medical_last_idcard_staff;
      const fieldDefs = window.__medical_field_defs;
      if(!staff) return;
      try{
        const blob = buildIdCardHtmlBlob(staff, fieldDefs);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = (staff.full_name || 'idcard').replace(/[^A-Za-z0-9_\- ]+/g, '');
        a.download = `${safeName}_IDCard.html`;
        document.body.appendChild(a);
        a.click(); a.remove(); URL.revokeObjectURL(url);
      }catch(err){ console.error(err); }
      return;
    }
  });

})();
