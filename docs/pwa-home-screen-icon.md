# PWA Home Screen Icon Guide

How to make Chrome on Android (and Safari on iOS) use a custom icon when the user taps "Add to Home Screen".

---

## 1. Create the Manifest File

Create `manifest.json` in the project root:

```json
{
  "name": "Your App Name",
  "short_name": "App",
  "description": "A short description of your app",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any"
    }
  ]
}
```

### Key fields

| Field | Purpose |
|---|---|
| `name` | Full app name shown on the splash screen |
| `short_name` | Short label shown under the home screen icon |
| `start_url` | URL opened when the icon is tapped |
| `display: standalone` | Hides the browser UI, making it feel like a native app |
| `background_color` | Background on the splash screen while the app loads |
| `theme_color` | Tints the browser/status bar chrome on Android |

---

## 2. Link the Manifest in HTML

Add these tags to the `<head>` of your `index.html`:

```html
<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-icon" href="/icons/icon-180x180.png" />
<meta name="theme-color" content="#000000" />
```

> **Why three tags?** The `manifest` is read by Chrome/Android. Safari on iOS ignores it entirely and uses `apple-touch-icon` instead. `theme-color` tints the browser address bar on Android.

---

## 3. Prepare the Icon Files

Create an `icons/` folder in the project root and add:

| File | Size | Used by |
|---|---|---|
| `icon-192x192.png` | 192×192 px | Android home screen icon |
| `icon-512x512.png` | 512×512 px | Android splash screen / high-res fallback |
| `icon-180x180.png` | 180×180 px | iOS "Add to Home Screen" (Safari) |

### Maskable icons

Modern Android launchers apply "adaptive icons" — they crop the icon into a circle, squircle, or other shape depending on the device. Setting `"purpose": "maskable"` tells Chrome the icon is safe to crop.

**Rule:** Keep all important content (logo, symbol) within the central **80% safe zone** of the image. The outer 10% on each side may be cropped.

---

## 4. Useful Tools

- **[maskable.app](https://maskable.app/)** — Preview how your icon looks when cropped by different Android launchers. Also lets you add padding to make any icon maskable.
- **[realfavicongenerator.net](https://realfavicongenerator.net/)** — Upload one image and get all sizes generated automatically, including iOS and Android variants.

---

## 5. Verify After Deploying

1. Open the site in **Chrome on desktop**.
2. Open DevTools (`F12`) → **Application** tab → **Manifest** in the left sidebar.
3. Check that icons are listed and the "Maskable icon safe zone" preview looks correct.

---

## Project Example (La Cucina)

```json
{
  "name": "La Cucina",
  "short_name": "La Cucina",
  "description": "La mia collezione personale di ricette",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#faf8f5",
  "theme_color": "#5c3d2e",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
}
```
