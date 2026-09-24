# TomLabs Consent

A cookie consent banner and Google Analytics 4 loader for TomLabs web applications: one dependency-free
script (~12 KB unminified, ~4 KB gzipped) in
[Consent Mode v2](https://developers.google.com/tag-platform/security/guides/consent), **basic mode**.
Nothing is requested from Google until the visitor clicks **Přijmout / Accept**.

![icon](icon.png)

## Usage

Copy `tomlabs-consent.js` into the app's static web root (see [Sync-Consent.ps1](#keeping-copies-in-sync)) and add:

```html
<script src="/tomlabs-consent.js"
        data-ga-id="G-XXXXXXXXXX"
        data-privacy-url="https://example.com/privacy"
        defer></script>
```

Put a reopen link in the footer. Any element with `data-tomlabs-consent` works:

```html
<a href="#" data-tomlabs-consent>Cookies</a>
```

| Attribute | Meaning |
|---|---|
| `data-ga-id` | GA4 measurement ID. **Empty, missing or a placeholder (`G-XXXX…`, `%VITE_GA_ID%`) → no banner, no tag, reopen links hidden.** Render the tag with the configured value so an app without configuration stays silent. |
| `data-privacy-url` | Link to the privacy page shown in the banner; omitted when empty. |
| `data-lang` | `cs` (default) or `en`; falls back to `<html lang>`. |

## Behaviour

- Consent default is `denied` for `ad_storage`, `ad_user_data`, `ad_personalization` and `analytics_storage`.
  Accept grants **`analytics_storage` only**; Google signals and ad personalisation stay off.
- gtag.js is appended only after Accept (or on a later visit with a stored Accept).
- The choice lives in `localStorage` under `tomlabs.consent.v1` (`choice`, `policy`, `ts`). The banner asks
  again after 12 months, or when `POLICY_VERSION` in the script is raised.
- Declining after an earlier Accept sends `consent update denied` and deletes the `_ga*` cookies.
- The banner lives in a Shadow DOM, so host CSS cannot break it and it cannot leak styles.
- Accept and Decline are equally prominent, at least 44 px high, full width on phones, and keyboard reachable (focus is kept in the banner).
- Theme follows the host live: `html[data-theme]`, `html[data-bs-theme]`, `.dark` / `.light` classes, and
  otherwise `prefers-color-scheme`.
- SPA route changes are counted by GA4 enhanced measurement (history events), no code needed.

JavaScript API: `tomlabsConsent.open()`, `.get()` (`'granted'`, `'denied'` or `null`), `.reset()`, `.version`,
`.enabled`; a `tomlabs-consent` event is dispatched on `document` with `detail.choice`.

## Per stack

| Stack | How the ID gets in |
|---|---|
| ASP.NET Core Razor / MVC | `_Layout.cshtml`: `data-ga-id="@Configuration["Analytics:MeasurementId"]"` |
| Blazor | `App.razor` with `@inject IConfiguration`, same key |
| Vite | `data-ga-id="%VITE_GA_ID%"` in `index.html` |
| Next.js | `<Script src="/tomlabs-consent.js" data-ga-id={process.env.NEXT_PUBLIC_GA_ID} strategy="afterInteractive" />` |
| Static HTML | the deploy script replaces the placeholder in `data-ga-id` |

The value comes from the pipeline (`GA_MEASUREMENT_ID`), never from the source.

## Content-Security-Policy

The script itself needs nothing beyond `script-src 'self'` (styles use a constructed stylesheet, which `style-src`
does not restrict). Google Analytics, once accepted, needs:

```
script-src  'self' https://*.googletagmanager.com
connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com
img-src     'self' https://*.google-analytics.com https://*.googletagmanager.com
```

## Keeping copies in sync

Each app has its own copy (no shared host, no runtime dependency, no CSP exception).

```powershell
./Sync-Consent.ps1 -Repo F:\Root\GIT\MyApp -Destination wwwroot/js   # first time
./Sync-Consent.ps1 -Repo F:\Root\GIT\MyApp                           # update every copy in the repo
```

## Development

```bash
npm install
npm test
```

Open `demo/index.html` in a browser to try the banner (light/dark switch, reset, reopen link).

Releasing: bump the version in `package.json`, in the header comment and in `VERSION` (a test checks that they agree), add a
section to `CHANGELOG.md`, tag `vX.Y.Z`.

## License

MIT
