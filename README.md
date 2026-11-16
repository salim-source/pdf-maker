# Scanify – PDF Reader & QR Scanner

Scanify is a privacy-first, cross-platform utility suite for reading PDF documents, scanning QR codes and barcodes, and generating shareable QR codes. All document rendering and scan history remain strictly local on the user's device.

This repository delivers **two independent, native-stack implementations** sharing consistent branding and workflows:

1. **Web Application (PWA)** — React, TypeScript, Vite, Tailwind CSS, PDF.js, `@zxing/browser`, `qrcode`, IndexedDB (`idb`), and `vite-plugin-pwa`.
2. **Native Android Application** — Kotlin, Jetpack Compose, Material 3, CameraX, Google ML Kit Barcode Scanning, Android `PdfRenderer`, Storage Access Framework (SAF), ZXing Core, and Room Database (located in `/android`).

---

## Project Structure

```text
/
├── index.html                  # Web entry HTML with PWA & theme initialization
├── metadata.json               # App metadata & camera permission declaration
├── package.json                # Web dependencies & scripts
├── vite.config.ts              # Vite + Tailwind v4 + VitePWA configuration
├── public/                     # Web PWA icons (SVG + 192/512/maskable/Apple PNGs)
├── src/
│   ├── App.tsx                 # React Router & ErrorBoundary shell
│   ├── index.css               # Tailwind v4 + dark variant + typography tokens
│   ├── types/index.ts          # Shared TypeScript domain interfaces
│   ├── context/AppContext.tsx  # Theme, preferences, IndexedDB state, toasts
│   ├── hooks/                  # usePWAInstall, useOnlineStatus
│   ├── services/
│   │   ├── pdfService.ts       # PDF.js local worker, metadata & import
│   │   ├── qrParserService.ts  # Wi-Fi, vCard, Email, Phone, URL parser/builder
│   │   ├── storageService.ts   # IndexedDB + LocalStorage persistence
│   │   └── feedbackService.ts  # Web Audio chime + vibration feedback
│   ├── components/             # AppLayout, ScanResultSheet, ConfirmDialog, PWAInstallButton
│   └── pages/                  # Dashboard, PdfReader, QrScanner, QrGenerator, History, PdfManager, Settings
└── android/                    # Native Android Kotlin + Jetpack Compose project
    ├── build.gradle.kts
    ├── settings.gradle.kts
    ├── gradle/libs.versions.toml
    └── app/
        ├── build.gradle.kts
        └── src/main/
            ├── AndroidManifest.xml
            ├── res/            # Adaptive launcher icons, FileProvider paths, themes
            └── java/com/scanify/app/
                ├── ScanifyApp.kt
                ├── MainActivity.kt
                ├── data/       # Room database, DAO, PreferencesRepository, ScanifyRepository
                ├── util/       # QrPayloadParser, QrBitmapGenerator, PdfHelper, FeedbackHelper
                └── ui/         # Material 3 theme, NavHost, and all 7 Compose screens
```

---

## 1. Web Application Setup & Deployment

### Prerequisites
- Node.js 20+ and npm 10+

### Install & Run Locally
```bash
npm install
npm run dev
```
The development server starts on `http://localhost:3000`. Camera scanning requires `localhost` or HTTPS.

### Typecheck & Production Build
```bash
npm run lint
npm run build
npm run preview
```

### Web Deployment Instructions
1. Run `npm run build` to generate the static bundle + PWA service worker (`dist/sw.js` and `dist/manifest.webmanifest`).
2. Deploy the `dist/` directory to any static HTTPS host (Cloud Run, Firebase Hosting, Cloudflare Pages, Vercel, Netlify, or Nginx).
3. Configure SPA fallback routing so unknown routes rewrite to `/index.html` (ensuring direct visits to `/reader`, `/scanner`, `/generator`, `/documents`, `/history`, and `/settings` load cleanly).
4. Ensure HTTPS is enabled in production so `navigator.mediaDevices.getUserMedia` (camera scanning) and PWA installation work across desktop and mobile browsers.

---

## 2. Native Android Setup & APK Generation

See [`android/README.md`](android/README.md) for full Android Studio setup, Gradle sync, and debug/release APK build instructions.
