// "Add to home screen" prompt.
//
// Two different worlds. Chrome/Android fires `beforeinstallprompt`, which we
// hold onto and replay when the reader taps Install. iOS Safari has no such
// event and never will, so there the only honest option is to show the Share →
// Add to Home Screen steps.
//
// Kept deliberately quiet: nothing appears on a first visit, nothing reappears
// for a good while after a dismissal, and nothing shows once installed.

const DISMISSED_KEY = 'field-desk-install-dismissed';
const VISITS_KEY = 'field-desk-visits';
const SNOOZE_DAYS = 30;
const MIN_VISITS = 2; // never on the very first visit

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } },
};

const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const isIOS = () =>
  (/iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS 13+ reports as a Mac; the touch points give it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
  !/crios|fxios|edgios/i.test(navigator.userAgent); // only Safari can install on iOS

function snoozed() {
  const until = Number(store.get(DISMISSED_KEY) || 0);
  return Date.now() < until;
}

function snooze() {
  store.set(DISMISSED_KEY, String(Date.now() + SNOOZE_DAYS * 864e5));
}

function countVisit() {
  const visits = Number(store.get(VISITS_KEY) || 0) + 1;
  store.set(VISITS_KEY, String(visits));
  return visits;
}

function panel({title, body, actions}) {
  const wrap = document.createElement('div');
  wrap.className = 'install-prompt';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-label', 'Install the field desk');
  wrap.innerHTML = `
    <img src="./icons/icon-192.png" alt="" width="44" height="44" />
    <div class="install-copy"><b>${title}</b><span>${body}</span></div>
    <div class="install-actions">${actions}</div>
    <button class="install-close" aria-label="Dismiss">×</button>`;
  document.body.append(wrap);
  requestAnimationFrame(() => wrap.classList.add('open'));

  const close = ({remember = true} = {}) => {
    if (remember) snooze();
    wrap.classList.remove('open');
    setTimeout(() => wrap.remove(), 220);
  };
  wrap.querySelector('.install-close').addEventListener('click', () => close());
  return {wrap, close};
}

export function initInstallPrompt() {
  if (isStandalone()) return;

  // Registering the worker is what makes the app installable at all.
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }

  const visits = countVisit();
  const ready = visits >= MIN_VISITS && !snoozed();

  // --- Android / Chrome ----------------------------------------------------
  let deferred = null;
  addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();       // stop Chrome's own mini-infobar
    deferred = event;
    if (!ready) return;
    const {close} = panel({
      title: 'Install the Field Desk',
      body: 'Keep the map and the research notes one tap away, and readable offline.',
      actions: '<button class="install-go" data-install>Install</button>',
    });
    document.querySelector('[data-install]')?.addEventListener('click', async () => {
      close({remember: false});
      deferred.prompt();
      const {outcome} = await deferred.userChoice;
      if (outcome !== 'accepted') snooze();
      deferred = null;
    });
  });

  addEventListener('appinstalled', () => {
    store.set(DISMISSED_KEY, String(Date.now() + 3650 * 864e5));
    document.querySelector('.install-prompt')?.remove();
  });

  // --- iOS Safari ----------------------------------------------------------
  // No install API exists, so show where the button lives instead.
  if (ready && isIOS()) {
    setTimeout(() => {
      if (isStandalone()) return;
      panel({
        title: 'Add to your Home Screen',
        body: 'Tap <b aria-hidden="true">&#x2191;</b> Share at the bottom of Safari, then choose <b>Add to Home Screen</b>.',
        actions: '',
      });
    }, 1200);
  }
}
