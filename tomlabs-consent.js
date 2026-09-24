/*! tomlabs-consent v1.0.1 | MIT | https://github.com/TomasBouda/TomLabs.Consent */
/*
 * Cookie consent banner + Google Analytics 4 loader (Consent Mode v2, basic mode).
 *
 * <script src="/tomlabs-consent.js" data-ga-id="G-XXXXXXX" data-privacy-url="/privacy" defer></script>
 *
 * - No measurement ID (empty or an unreplaced placeholder) -> no banner, no tag, nothing.
 * - Nothing is requested from Google until the visitor clicks Accept.
 * - Any element with [data-tomlabs-consent] reopens the banner (e.g. a "Cookies" footer link).
 */
(function () {
  'use strict';

  var VERSION = '1.0.1';
  // Bump when the consent text or purpose changes: every visitor is asked again.
  var POLICY_VERSION = 1;
  var STORAGE_KEY = 'tomlabs.consent.v1';
  var MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;
  var GA_ID_PATTERN = /^G-[A-Z0-9]{4,}$/;

  var TEXTS = {
    cs: {
      title: 'Cookies a měření návštěvnosti',
      body: 'Rádi bychom měřili návštěvnost pomocí Google Analytics, abychom věděli, co na webu funguje. ' +
        'Bez vašeho souhlasu Googlu nic neposíláme.',
      privacy: 'Zásady ochrany soukromí',
      accept: 'Přijmout',
      decline: 'Odmítnout'
    },
    en: {
      title: 'Cookies and analytics',
      body: 'We would like to measure traffic with Google Analytics to learn what works on this site. ' +
        'Nothing is sent to Google without your consent.',
      privacy: 'Privacy policy',
      accept: 'Accept',
      decline: 'Decline'
    }
  };

  var CSS =
    ':host{all:initial}' +
    '.tc{--bg:#ffffff;--fg:#16171d;--muted:#5b5e6b;--line:rgba(0,0,0,.12);--btn:#f0f0f3;--btn-hover:#e4e4e9;' +
    '--primary:#16171d;--primary-fg:#ffffff;--focus:#2563eb;--shadow:0 8px 32px rgba(0,0,0,.18);' +
    'position:fixed;z-index:2147483000;left:16px;right:16px;bottom:16px;margin:0 auto;max-width:640px;' +
    'box-sizing:border-box;padding:18px 20px;border:1px solid var(--line);border-radius:12px;' +
    'background:var(--bg);color:var(--fg);box-shadow:var(--shadow);' +
    'font:14px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
    'animation:tc-in .2s ease-out}' +
    '.tc.dark{--bg:#16171d;--fg:#e6e7eb;--muted:#9a9ca6;--line:rgba(255,255,255,.12);--btn:#23252e;' +
    '--btn-hover:#2d303b;--primary:#e6e7eb;--primary-fg:#16171d;--focus:#60a5fa;--shadow:0 8px 32px rgba(0,0,0,.5)}' +
    '.tc[hidden]{display:none}' +
    'h2{margin:0 0 6px;font-size:15px;font-weight:600;line-height:1.3}' +
    'p{margin:0;color:var(--muted)}' +
    'a{color:inherit;text-decoration:underline;text-underline-offset:2px}' +
    '.actions{display:flex;gap:8px;margin-top:14px;justify-content:flex-end}' +
    'button{min-height:44px;min-width:120px;padding:0 18px;border-radius:8px;border:1px solid var(--line);' +
    'background:var(--btn);color:var(--fg);font:inherit;font-weight:600;cursor:pointer;' +
    'transition:background-color .12s ease-out}' +
    'button:hover{background:var(--btn-hover)}' +
    'button:focus-visible,a:focus-visible{outline:2px solid var(--focus);outline-offset:2px}' +
    '@media (max-width:480px){.tc{left:0;right:0;bottom:0;border-radius:12px 12px 0 0;border-bottom:0;' +
    'padding:16px 16px calc(16px + env(safe-area-inset-bottom))}' +
    '.actions{flex-direction:column-reverse}button{width:100%}}' +
    '@keyframes tc-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}' +
    '@media (prefers-reduced-motion:reduce){.tc{animation:none}}';

  var script = document.currentScript;
  if (!script) return;

  var gaId = (script.getAttribute('data-ga-id') || '').trim();
  var lang = (script.getAttribute('data-lang') || document.documentElement.lang || 'cs').slice(0, 2).toLowerCase();
  var privacyUrl = (script.getAttribute('data-privacy-url') || '').trim();
  var texts = TEXTS[lang] || TEXTS.cs;

  function reopeners() {
    return document.querySelectorAll('[data-tomlabs-consent]');
  }

  if (!GA_ID_PATTERN.test(gaId) || /^G-X+$/.test(gaId)) {
    // Not configured (empty, placeholder such as %VITE_GA_ID% or G-XXXXXXXXXX): stay invisible.
    onReady(function () {
      Array.prototype.forEach.call(reopeners(), function (el) { el.hidden = true; });
    });
    window.tomlabsConsent = { version: VERSION, enabled: false, open: noop, get: function () { return null; }, reset: noop };
    return;
  }

  // ---- storage --------------------------------------------------------------------------------

  function readChoice() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || (data.choice !== 'granted' && data.choice !== 'denied')) return null;
      if (data.policy !== POLICY_VERSION) return null;
      if (typeof data.ts !== 'number' || Date.now() - data.ts > MAX_AGE_MS) return null;
      return data.choice;
    } catch (e) {
      return null;
    }
  }

  function writeChoice(choice) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice: choice, policy: POLICY_VERSION, ts: Date.now() }));
    } catch (e) { /* storage blocked: the banner simply shows again on the next visit */ }
  }

  // ---- Google tag -----------------------------------------------------------------------------

  var tagLoaded = false;

  function gtag() {
    window.dataLayer.push(arguments);
  }

  function loadTag() {
    if (tagLoaded) {
      gtag('consent', 'update', { analytics_storage: 'granted' });
      return;
    }
    tagLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || gtag;
    gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied'
    });
    gtag('consent', 'update', { analytics_storage: 'granted' });
    gtag('js', new Date());
    gtag('config', gaId, { allow_google_signals: false, allow_ad_personalization_signals: false });

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
    document.head.appendChild(s);
  }

  function revoke() {
    if (tagLoaded) gtag('consent', 'update', { analytics_storage: 'denied' });
    // Remove GA cookies (_ga, _ga_<container>) on this host and its parent domains.
    var names = document.cookie.split(';').map(function (c) { return c.split('=')[0].trim(); })
      .filter(function (n) { return n === '_ga' || n.indexOf('_ga_') === 0; });
    var parts = location.hostname.split('.');
    names.forEach(function (name) {
      document.cookie = name + '=; Max-Age=0; path=/';
      for (var i = 0; i < parts.length - 1; i++) {
        document.cookie = name + '=; Max-Age=0; path=/; domain=.' + parts.slice(i).join('.');
      }
    });
  }

  // ---- banner ---------------------------------------------------------------------------------

  var host, root, panel, lastFocus;

  function isDark() {
    var html = document.documentElement;
    var theme = (html.getAttribute('data-theme') || html.getAttribute('data-bs-theme') || '').toLowerCase();
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    if (html.classList.contains('dark') || (document.body && document.body.classList.contains('dark'))) return true;
    if (html.classList.contains('light')) return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function applyTheme() {
    if (panel) panel.classList.toggle('dark', isDark());
  }

  function build() {
    var sheet = null;
    host = document.createElement('div');
    host.setAttribute('data-tomlabs-consent-host', '');
    root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

    // A constructed stylesheet is not subject to CSP style-src, so the banner is styled even on sites
    // with a strict policy (style-src 'self'). A <style> element is the fallback for old browsers.
    if (root !== host && 'adoptedStyleSheets' in root && typeof CSSStyleSheet === 'function') {
      try {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(CSS);
        root.adoptedStyleSheets = [sheet];
      } catch (e) {
        sheet = null;
      }
    }
    if (!sheet) {
      var style = document.createElement('style');
      style.textContent = CSS;
      root.appendChild(style);
    }

    panel = document.createElement('div');
    panel.className = 'tc';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'tc-title');
    panel.setAttribute('aria-describedby', 'tc-body');
    panel.setAttribute('lang', TEXTS[lang] ? lang : 'cs');

    var h = document.createElement('h2');
    h.id = 'tc-title';
    h.textContent = texts.title;

    var p = document.createElement('p');
    p.id = 'tc-body';
    p.textContent = texts.body + ' ';
    if (privacyUrl) {
      var a = document.createElement('a');
      a.href = privacyUrl;
      a.textContent = texts.privacy;
      p.appendChild(a);
    }

    var actions = document.createElement('div');
    actions.className = 'actions';
    var decline = button(texts.decline, 'decline', function () { choose('denied'); });
    var accept = button(texts.accept, 'accept', function () { choose('granted'); });
    actions.appendChild(decline);
    actions.appendChild(accept);

    panel.appendChild(h);
    panel.appendChild(p);
    panel.appendChild(actions);
    root.appendChild(panel);
    panel.addEventListener('keydown', trapFocus);
    document.body.appendChild(host);

    applyTheme();
    if (window.matchMedia) {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.addEventListener) mq.addEventListener('change', applyTheme);
      else if (mq.addListener) mq.addListener(applyTheme);
    }
    if (window.MutationObserver) {
      var observer = new MutationObserver(applyTheme);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-bs-theme'] });
      if (document.body) observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    }
  }

  function button(label, action, handler) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('data-action', action);
    b.addEventListener('click', handler);
    return b;
  }

  function focusables() {
    return Array.prototype.slice.call(panel.querySelectorAll('a[href],button'));
  }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    var items = focusables();
    var first = items[0], last = items[items.length - 1];
    var active = root.activeElement;
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  }

  function show(moveFocus) {
    if (!panel) build();
    panel.hidden = false;
    if (moveFocus) {
      lastFocus = document.activeElement;
      panel.querySelector('[data-action="accept"]').focus();
    }
  }

  function hide() {
    if (panel) panel.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  function choose(choice) {
    writeChoice(choice);
    hide();
    if (choice === 'granted') loadTag();
    else revoke();
    document.dispatchEvent(new CustomEvent('tomlabs-consent', { detail: { choice: choice } }));
  }

  // ---- start ----------------------------------------------------------------------------------

  function onReady(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function noop() {}

  window.tomlabsConsent = {
    version: VERSION,
    enabled: true,
    open: function () { onReady(function () { show(true); }); },
    get: readChoice,
    reset: function () {
      try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
      revoke();
    }
  };

  // Reopen links work for elements added later too (SPA footers).
  document.addEventListener('click', function (e) {
    var target = e.target && e.target.closest ? e.target.closest('[data-tomlabs-consent]') : null;
    if (!target) return;
    e.preventDefault();
    show(true);
  });

  var stored = readChoice();
  if (stored === 'granted') loadTag();
  if (stored === null) onReady(function () { show(false); });
})();
