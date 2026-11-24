/* Roma Hub Demo · Installation experience. Independent of the score viewer. */
(function () {
  'use strict';
  var DISMISS_KEY = 'coro-roma-install-dismissed-v1';
  var SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/i.test(ua);
  var isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
  var installEvent = null;
  var sheet = null;
  var toolbarButton = null;
  var offlineNotice = null;
  var updateNotice = null;
  var installed = false;

  function standalone() {
    return navigator.standalone === true ||
      !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function dismissedRecently() {
    try {
      var last = Number(localStorage.getItem(DISMISS_KEY) || 0);
      return last > 0 && Date.now() - last < SEVEN_DAYS;
    } catch (_) { return false; }
  }
  function rememberDismissal() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (_) {}
  }
  function readerActive() {
    var root = document.getElementById('readerRoot');
    return !!(root && root.children.length > 0);
  }
  function hideSheet(remember) {
    if (sheet) { sheet.hidden = true; }
    if (remember) { rememberDismissal(); }
  }
  function hideInstalled() {
    installed = true;
    hideSheet(false);
    if (toolbarButton) toolbarButton.hidden = true;
  }
  function installationSteps() {
    if (isIOS) {
      if (!isSafari) {
        return 'Abre este enlace en Safari. Toca Compartir (cuadro con flecha hacia arriba), selecciona "Añadir a pantalla de inicio" y confirma con "Añadir".';
      }
      return 'En Safari, toca Compartir (cuadro con flecha hacia arriba), elige "Añadir a pantalla de inicio" y confirma con "Añadir". Abre la app desde su nuevo icono mientras tengas internet para preparar el acceso offline.';
    }
    if (isAndroid) {
      return 'Abre el menú del navegador (⋮) y elige "Instalar aplicación" o "Añadir a pantalla de inicio". Confirma la instalación.';
    }
    if (/Macintosh|Mac OS X/i.test(ua) && isSafari) {
      return 'En Safari para Mac, abre Archivo y elige "Añadir al Dock" cuando esa opción esté disponible.';
    }
    return 'En Chrome o Edge, busca el icono de instalación en la barra de direcciones. También puedes abrir el menú del navegador y elegir instalar la aplicación.';
  }
  function createSheet() {
    if (sheet) return sheet;
    sheet = document.createElement('section');
    sheet.id = 'pwaInstallSheet';
    sheet.className = 'pwa-install-sheet';
    sheet.setAttribute('role', 'region');
    sheet.setAttribute('aria-label', 'Instalar Roma Hub Demo');
    sheet.hidden = true;
    sheet.innerHTML =
      '<button type="button" class="pwa-close" aria-label="Cerrar invitación de instalación">×</button>' +
      '<div class="pwa-head"><img src="/icons/icon-192.png" width="54" height="54" alt="">' +
      '<div><strong>Ten Roma Hub Demo en tu pantalla de inicio</strong>' +
      '<p>Abre tus partituras y tu material de estudio como una app.</p></div></div>' +
      '<p class="pwa-note">' + (window.CoroIOS12 && window.CoroIOS12.isIOS12 ? 'En iOS 12, abre la app instalada con internet una vez. Las partituras se guardan al abrirlas; así evitamos saturar el almacenamiento del dispositivo. Las que no hayas abierto requerirán conexión.' : 'Al instalar, las partituras se guardan automáticamente. El repertorio actual ocupa unos 265 MB. Usa Wi-Fi y mantén la aplicación abierta mientras se prepara; puedes seguir leyendo.') + '</p>' +
      '<div class="pwa-install-actions"><button type="button" class="pwa-primary" id="pwaInstallAction">Instalar aplicación</button>' +
      '<button type="button" class="pwa-secondary" id="pwaInstallLater">Ahora no</button></div>' +
      '<p class="pwa-install-steps" id="pwaInstallSteps" hidden></p>' +
      '<p class="pwa-install-state" id="pwaInstallState" role="status" aria-live="polite"></p>';
    document.body.appendChild(sheet);
    sheet.querySelector('.pwa-close').addEventListener('click', function () { hideSheet(true); });
    sheet.querySelector('#pwaInstallLater').addEventListener('click', function () { hideSheet(true); });
    sheet.querySelector('#pwaInstallAction').addEventListener('click', install);
    return sheet;
  }
  function refreshSheet() {
    if (!sheet) return;
    var action = sheet.querySelector('#pwaInstallAction');
    var steps = sheet.querySelector('#pwaInstallSteps');
    if (installEvent) {
      action.textContent = 'Instalar aplicación';
      steps.hidden = true;
    } else {
      action.textContent = isIOS ? 'Ver pasos para instalar' : 'Cómo instalar';
      steps.textContent = installationSteps();
      steps.hidden = !isIOS;
    }
  }
  function openSheet() {
    if (installed || standalone() || readerActive() || document.fullscreenElement) return;
    createSheet();
    refreshSheet();
    sheet.hidden = false;
  }
  function install() {
    if (standalone()) { hideInstalled(); return; }
    if (!installEvent) {
      var steps = sheet.querySelector('#pwaInstallSteps');
      steps.textContent = installationSteps();
      steps.hidden = false;
      return;
    }
    var evt = installEvent;
    installEvent = null;
    try {
      evt.prompt(); // Must be invoked directly from this user click.
      Promise.resolve(evt.userChoice).then(function (choice) {
        if (choice && choice.outcome === 'accepted') {
          hideSheet(true);
        } else {
          sheet.querySelector('#pwaInstallState').textContent =
            'Puedes instalarla más tarde desde el botón Instalar.';
          refreshSheet();
        }
      }).catch(function () { refreshSheet(); });
    } catch (_) {
      refreshSheet();
      var steps = sheet.querySelector('#pwaInstallSteps');
      steps.textContent = installationSteps();
      steps.hidden = false;
    }
  }
  function createToolbarButton() {
    var tools = document.querySelector('.topbar .tools');
    if (!tools || toolbarButton) return;
    toolbarButton = document.createElement('button');
    toolbarButton.id = 'pwaInstallToolbar';
    toolbarButton.type = 'button';
    toolbarButton.className = 'pwa-install-toolbar';
    toolbarButton.setAttribute('aria-label', 'Instalar Roma Hub Demo');
    toolbarButton.title = 'Instalar Roma Hub Demo';
    toolbarButton.innerHTML = '<span aria-hidden="true">↓</span><span class="pwa-toolbar-label"> Instalar app</span>';
    toolbarButton.addEventListener('click', openSheet);
    tools.insertBefore(toolbarButton, tools.firstChild);
    if (installed || standalone()) toolbarButton.hidden = true;
  }
  function updateOfflineNotice() {
    if (!offlineNotice) return;
    offlineNotice.hidden = navigator.onLine !== false;
  }
  function createOfflineNotice() {
    offlineNotice = document.createElement('div');
    offlineNotice.className = 'pwa-offline-notice';
    offlineNotice.setAttribute('role', 'status');
    offlineNotice.textContent = 'Sin conexión: puedes abrir contenidos guardados. Algunas funciones requieren internet.';
    document.body.appendChild(offlineNotice);
    updateOfflineNotice();
  }
  function offerUpdate() {
    if (updateNotice || readerActive()) return;
    updateNotice = document.createElement('div');
    updateNotice.className = 'pwa-update-notice';
    updateNotice.setAttribute('role', 'status');
    updateNotice.innerHTML = '<span>Nueva versión disponible</span>' +
      '<button type="button">Actualizar</button><button type="button" aria-label="Cerrar aviso">×</button>';
    document.body.appendChild(updateNotice);
    updateNotice.querySelectorAll('button')[0].addEventListener('click', function () {
      window.location.reload();
    });
    updateNotice.querySelectorAll('button')[1].addEventListener('click', function () {
      updateNotice.remove();
      updateNotice = null;
    });
  }
  function registerWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/ios12/sw.js', { scope: '/ios12/' }).then(function (registration) {
      if (registration.waiting && navigator.serviceWorker.controller) offerUpdate();
      registration.addEventListener('updatefound', function () {
        var worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) offerUpdate();
        });
      });
    }).catch(function (error) {
      // A failing worker must never prevent normal online use.
      if (window.console) console.warn('No se pudo habilitar el modo sin conexión', error);
    });
  }
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installEvent = event;
    refreshSheet();
  });
  window.addEventListener('appinstalled', hideInstalled);
  window.addEventListener('online', updateOfflineNotice);
  window.addEventListener('offline', updateOfflineNotice);
  window.addEventListener('fullscreenchange', function () {
    if (sheet && document.fullscreenElement) hideSheet(false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && sheet && !sheet.hidden) hideSheet(true);
  });
  function start() {
    installed = standalone() || !!(window.CoroAuto && CoroAuto.installed());
    createToolbarButton();
    createOfflineNotice();
    var root = document.getElementById('readerRoot');
    if (root && 'MutationObserver' in window) {
      new MutationObserver(function () {
        document.body.classList.toggle('pwa-reader-active', readerActive());
        if (readerActive()) hideSheet(false);
      }).observe(root, {childList:true});
    }
    if (!installed && !dismissedRecently()) openSheet();
    if ('serviceWorker' in navigator) registerWorker();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}());
