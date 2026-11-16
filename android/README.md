# Scanify Native Android (Kotlin + Jetpack Compose)

Native Android implementation of **Scanify – PDF Reader & QR Scanner** built with Kotlin, Jetpack Compose, Material 3, CameraX, Google ML Kit Barcode Scanning, Android `PdfRenderer`, Storage Access Framework (SAF), ZXing Core, and Room.

---

## Key Libraries (`gradle/libs.versions.toml`)
- **UI**: Jetpack Compose BOM `2024.12.01`, Material 3, Navigation Compose `2.8.5`
- **Camera & Scanning**: CameraX `1.4.1` (`camera-core`, `camera-camera2`, `camera-lifecycle`, `camera-view`) + Google ML Kit `barcode-scanning:17.3.0`
- **QR Generation**: `com.google.zxing:core:3.5.3`
- **PDF Rendering**: Native `android.graphics.pdf.PdfRenderer` + Storage Access Framework (`ActivityResultContracts.OpenDocument`)
- **Local Persistence**: Room `2.6.1` (`room-runtime`, `room-ktx`, `room-compiler` via KSP) + `SharedPreferences`

---

## Android Studio Setup

1. Install **Android Studio Ladybug (2024.2.1)** or newer with **Android SDK 35** and **JDK 17**.
2. Open Android Studio and choose **File → Open**, then select the `/android` directory in this repository.
3. Wait for Gradle Sync to download dependencies and generate the project index.
4. Note: Because this directory was created outside Android Studio's wizard, run `gradle wrapper` once (or let Android Studio auto-generate the Gradle Wrapper `gradlew`) if `./gradlew` is not yet present.

---

## Running on Emulator or Physical Device

1. Enable **Developer Options → USB Debugging** on an Android 8.0+ (API 26+) phone, or create an API 35 emulator with Camera support.
2. Click **Run ('app')** in Android Studio (`Shift + F10`).
3. Grant the **CAMERA** permission when launching the QR Scanner tab (camera permission is requested at runtime only when needed).

---

## Generating an Installable APK

### Option A: Debug APK (Quick Testing / Sideloading)
Using Android Studio:
- **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- Output path: `android/app/build/outputs/apk/debug/app-debug.apk`

Using CLI (with Gradle wrapper):
```bash
cd android
./gradlew assembleDebug
```

### Option B: Signed Release APK (Distribution)
1. Generate a signing keystore (if you don't already have one):
   ```bash
   keytool -genkey -v -keystore scanify-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias scanify
   ```
2. In Android Studio, open **Build → Generate Signed Bundle / APK...**
3. Select **APK**, choose your `.jks` keystore, select the **release** build variant, and enable **V2 (Full APK Signature)**.
4. Android Studio outputs the minified, resource-shrunk release APK to:
   `android/app/build/outputs/apk/release/app-release.apk`
5. Install directly on any Android device via ADB or file transfer:
   ```bash
   adb install android/app/build/outputs/apk/release/app-release.apk
   ```
