# Changelog

## 1.0.1 — 2026-09-24

- Fixed: the banner is styled on sites with a strict Content-Security-Policy (`style-src 'self'`); it now uses a constructed stylesheet instead of a `<style>` element.
- Docs: the CSP sources Google Analytics needs.

## 1.0.0 — 2026-09-24

- Added: consent banner with Accept / Decline, Czech and English texts, a privacy link and reopen links (`data-tomlabs-consent`).
- Added: Google Analytics 4 in basic Consent Mode v2. Nothing is sent to Google before Accept.
- Added: the choice is remembered for 12 months; declining later removes GA cookies.
- Added: light/dark theme that follows the host page live, a phone layout, keyboard access.
- Added: `Sync-Consent.ps1` copies the script into an app's repository.
