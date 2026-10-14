// A PWA installation helper (Android Chrome); no changes to the game's saves.
(()=>{if(!('serviceWorker' in navigator))return;
window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(e=>console.warn('[F1 PWA] SW unavailable:',e)));
let deferred=null;
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;
 if(localStorage.getItem('f1.pwa.install.dismissed'))return;
 const banner=document.createElement('div');banner.id='f1-install-banner';banner.setAttribute('role','region');banner.setAttribute('aria-label','Instalar F1 Universe');
 banner.innerHTML='<span><strong>F1 Universe no celular</strong><br><small>Instalar no Xiaomi para abrir como aplicativo</small></span><button type="button" class="f1-install-now">Instalar</button><button type="button" class="f1-install-close" aria-label="Fechar aviso">×</button>';
 document.body.appendChild(banner);
 banner.querySelector('.f1-install-now').addEventListener('click',async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice;deferred=null;banner.remove()});
 banner.querySelector('.f1-install-close').addEventListener('click',()=>{banner.remove();localStorage.setItem('f1.pwa.install.dismissed','1')});
});
})();
