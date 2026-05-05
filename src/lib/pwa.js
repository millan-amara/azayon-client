// Tiny PWA helpers — service worker registration + install-prompt plumbing.
//
// We capture `beforeinstallprompt` early (before React mounts) because the
// browser only fires it once per session. The InstallAppButton component
// then calls `triggerInstall()` from a user gesture to surface the native UI.

let deferredInstallPrompt = null;
const installListeners = new Set();
let installAvailable = false;

function notifyInstallListeners() {
  installListeners.forEach((fn) => {
    try { fn(installAvailable); } catch { /* listener crashed; ignore */ }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installAvailable = true;
    notifyInstallListeners();
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installAvailable = false;
    notifyInstallListeners();
  });
}

export function isInstallAvailable() {
  return installAvailable;
}

export function onInstallAvailableChange(listener) {
  installListeners.add(listener);
  // Fire current state immediately so consumers can render correctly on mount
  listener(installAvailable);
  return () => installListeners.delete(listener);
}

export async function triggerInstall() {
  if (!deferredInstallPrompt) return { outcome: 'unavailable' };
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installAvailable = false;
  notifyInstallListeners();
  return choice;
}

// Service worker registration. Call once on app boot in production only.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        // If a new SW is waiting, ask it to take over so users get fresh code
        // without a forced reload.
        if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              sw.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch((err) => console.warn('SW registration failed:', err.message));
  });
}
