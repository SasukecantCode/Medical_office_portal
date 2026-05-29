// Delegated handlers for ID card modal, print and download
(function(){
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
      if(!window.__medical_last_idcard_staff) return;
      openModal();
      // trigger modal print button after showing
      setTimeout(()=>{
        const modalPrint = document.getElementById('idcard-print-btn');
        if(modalPrint) modalPrint.click();
      }, 60);
      return;
    }

    if (el.closest('#btn-download-id') || el.closest('#idcard-download-btn')){
      if (window.downloadIdCardJpeg) {
        window.downloadIdCardJpeg();
      }
      return;
    }

    if (el.closest('#idcard-close-btn')){
      closeModal();
      return;
    }

    if (el.closest('#idcard-print-btn')){
      if (window.printIdCard) {
        window.printIdCard();
      }
      return;
    }
  });

})();
