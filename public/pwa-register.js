(() => {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const base = new URL('.', document.currentScript.src);
  let requestedUpdate = false;
  let banner;
  function show(message, action) {
    banner?.remove();
    banner = document.createElement('aside');
    banner.setAttribute('role', 'status');
    banner.dir = 'rtl';
    Object.assign(banner.style, {
      position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 12px)', left: '12px', right: '12px',
      maxWidth: '500px', margin: '0 auto', zIndex: '99999', padding: '12px 16px',
      background: '#111016', border: '1px solid #7135A6', borderRadius: '12px',
      color: '#F5F3F7', fontFamily: 'David, serif', display: 'flex', alignItems: 'center', gap: '12px',
    });
    const text = document.createElement('span');
    text.textContent = message;
    text.style.flex = '1';
    banner.append(text);
    function button(label, run) {
      const element = document.createElement('button');
      element.textContent = label;
      element.type = 'button';
      Object.assign(element.style, { background: '#7135A6', color: '#fff', border: 'none', padding: '10px', borderRadius: '8px', font: 'inherit' });
      element.onclick = run;
      banner.append(element);
    }
    if (action) button('עדכון', action);
    button('סגירה', () => banner.remove());
    document.body.append(banner);
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (requestedUpdate) location.reload();
  });
  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type === 'UPDATE_BLOCKED') {
      requestedUpdate = false;
      show('כדי לעדכן, סגור את שאר החלונות של האפליקציה ונסה שוב.');
    }
  });
  navigator.serviceWorker.register(new URL('sw.js', base), { scope: base.pathname, updateViaCache: 'none' }).then(registration => {
    function offerUpdate() {
      if (!registration.waiting) return;
      show('גרסה חדשה זמינה. אפשר לעדכן כשסיימת לערוך.', () => {
        if (!confirm('לעדכן ולפתוח מחדש את האפליקציה? סיים עריכה פתוחה לפני העדכון.')) return;
        requestedUpdate = true;
        registration.waiting?.postMessage({ type: 'ACTIVATE_UPDATE' });
      });
    }
    offerUpdate();
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate();
      });
    });
    navigator.serviceWorker.ready.then(() => {
      if (!sessionStorage.getItem('offline-ready-notified')) {
        show('האפליקציה מוכנה לשימוש גם ללא אינטרנט. הנתונים נשמרים במכשיר.');
        sessionStorage.setItem('offline-ready-notified', '1');
        setTimeout(() => { if (!registration.waiting) banner?.remove(); }, 7000);
      }
    }).catch(() => {});
    window.addEventListener('online', () => registration.update().catch(() => {}));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) registration.update().catch(() => {});
    });
  }).catch(error => {
    console.warn('Offline installation failed', error);
    show('לא ניתן להכין שימוש ללא אינטרנט כרגע. נסה לפתוח שוב כשיש חיבור.');
  });
})();
