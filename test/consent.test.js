'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'tomlabs-consent.js'), 'utf8');
const PACKAGE = require('../package.json');
const KEY = 'tomlabs.consent.v1';
const YEAR = 365 * 24 * 60 * 60 * 1000;

async function load({ attrs = 'data-ga-id="G-TEST12345"', stored, body = '', html = '<html lang="cs">' } = {}) {
  const dom = new JSDOM(`<!doctype html>${html}<head></head><body>${body}</body></html>`, {
    url: 'https://app.tomlabs.xyz/',
    runScripts: 'dangerously'
  });
  const { window } = dom;
  if (stored !== undefined) window.localStorage.setItem(KEY, JSON.stringify(stored));
  const script = window.document.createElement('script');
  for (const [, name, value] of attrs.matchAll(/([\w-]+)="([^"]*)"/g)) script.setAttribute(name, value);
  script.textContent = SOURCE;
  window.document.body.appendChild(script);
  if (window.document.readyState === 'loading') {
    await new Promise((resolve) => window.document.addEventListener('DOMContentLoaded', resolve));
  }
  return window;
}

const panel = (w) => {
  const host = w.document.querySelector('[data-tomlabs-consent-host]');
  return host ? host.shadowRoot.querySelector('.tc') : null;
};
const isVisible = (w) => { const p = panel(w); return !!p && !p.hidden; };
const gtmLoaded = (w) => !!w.document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]');
const click = (w, action) => panel(w).querySelector(`[data-action="${action}"]`).click();

test('header, VERSION constant and package.json agree', () => {
  const header = SOURCE.match(/^\/\*! tomlabs-consent v(\S+) /)[1];
  const constant = SOURCE.match(/var VERSION = '([^']+)'/)[1];
  assert.equal(header, PACKAGE.version);
  assert.equal(constant, PACKAGE.version);
});

for (const [name, attrs] of [
  ['missing', ''],
  ['empty', 'data-ga-id=""'],
  ['Vite placeholder', 'data-ga-id="%VITE_GA_ID%"'],
  ['sample placeholder', 'data-ga-id="G-XXXXXXXXXX"'],
  ['lower-case garbage', 'data-ga-id="g-abc"']
]) {
  test(`no measurement ID (${name}): no banner, no tag, reopen links hidden`, async () => {
    const w = await load({ attrs, body: '<a href="#" data-tomlabs-consent>Cookies</a>' });
    assert.equal(panel(w), null);
    assert.equal(gtmLoaded(w), false);
    assert.equal(w.document.querySelector('[data-tomlabs-consent]').hidden, true);
    assert.equal(w.tomlabsConsent.enabled, false);
  });
}

test('first visit: banner shown, nothing requested from Google', async () => {
  const w = await load();
  assert.equal(isVisible(w), true);
  assert.equal(gtmLoaded(w), false);
  assert.equal(w.dataLayer, undefined);
});

test('accept: stores choice, loads gtag.js with consent default denied then analytics granted', async () => {
  const w = await load();
  click(w, 'accept');
  assert.equal(isVisible(w), false);
  assert.equal(gtmLoaded(w), true);
  const stored = JSON.parse(w.localStorage.getItem(KEY));
  assert.equal(stored.choice, 'granted');
  const calls = w.dataLayer.map((a) => JSON.parse(JSON.stringify(Array.from(a))));
  assert.deepEqual(calls[0], ['consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'denied'
  }]);
  assert.deepEqual(calls[1], ['consent', 'update', { analytics_storage: 'granted' }]);
  assert.deepEqual(calls[3], ['config', 'G-TEST12345', { allow_google_signals: false, allow_ad_personalization_signals: false }]);
});

test('decline: stores choice, loads nothing', async () => {
  const w = await load();
  click(w, 'decline');
  assert.equal(isVisible(w), false);
  assert.equal(gtmLoaded(w), false);
  assert.equal(JSON.parse(w.localStorage.getItem(KEY)).choice, 'denied');
});

test('stored grant: no banner, tag loaded', async () => {
  const w = await load({ stored: { choice: 'granted', policy: 1, ts: Date.now() } });
  assert.equal(isVisible(w), false);
  assert.equal(gtmLoaded(w), true);
});

test('stored decline: no banner, no tag', async () => {
  const w = await load({ stored: { choice: 'denied', policy: 1, ts: Date.now() } });
  assert.equal(isVisible(w), false);
  assert.equal(gtmLoaded(w), false);
});

test('choice older than 12 months: asked again', async () => {
  const w = await load({ stored: { choice: 'granted', policy: 1, ts: Date.now() - YEAR - 1000 } });
  assert.equal(isVisible(w), true);
  assert.equal(gtmLoaded(w), false);
});

test('policy version changed: asked again', async () => {
  const w = await load({ stored: { choice: 'granted', policy: 0, ts: Date.now() } });
  assert.equal(isVisible(w), true);
});

test('reopen link shows the banner, also for links added later', async () => {
  const w = await load({ stored: { choice: 'denied', policy: 1, ts: Date.now() } });
  const link = w.document.createElement('a');
  link.href = '#';
  link.setAttribute('data-tomlabs-consent', '');
  w.document.body.appendChild(link);
  link.click();
  assert.equal(isVisible(w), true);
});

test('decline after accept revokes consent and removes GA cookies', async () => {
  const w = await load({ stored: { choice: 'granted', policy: 1, ts: Date.now() } });
  w.document.cookie = '_ga=GA1.1.123; path=/';
  w.document.cookie = '_ga_ABC=GS1.1; path=/';
  w.document.cookie = 'other=1; path=/';
  w.tomlabsConsent.open();
  click(w, 'decline');
  assert.deepEqual(JSON.parse(JSON.stringify(Array.from(w.dataLayer.at(-1)))), ['consent', 'update', { analytics_storage: 'denied' }]);
  assert.equal(w.document.cookie, 'other=1');
});

test('English texts via data-lang', async () => {
  const w = await load({ attrs: 'data-ga-id="G-TEST12345" data-lang="en"' });
  assert.equal(panel(w).querySelector('[data-action="accept"]').textContent, 'Accept');
});

test('privacy link only when data-privacy-url is set', async () => {
  assert.equal(panel(await load()).querySelector('a'), null);
  const w = await load({ attrs: 'data-ga-id="G-TEST12345" data-privacy-url="/privacy"' });
  assert.equal(panel(w).querySelector('a').getAttribute('href'), '/privacy');
});

test('follows the host page theme live', async () => {
  const w = await load({ html: '<html lang="cs" data-theme="dark">' });
  assert.equal(panel(w).classList.contains('dark'), true);
  w.document.documentElement.setAttribute('data-theme', 'light');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(panel(w).classList.contains('dark'), false);
  w.document.documentElement.classList.add('dark');
  w.document.documentElement.removeAttribute('data-theme');
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(panel(w).classList.contains('dark'), true);
});

test('both buttons are the same size and style (equal prominence)', async () => {
  const buttons = panel(await load()).querySelectorAll('button');
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0].className, buttons[1].className);
});
