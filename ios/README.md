# PokerElevate iOS foundation

Stage 13.7A wraps the accepted web application in a minimal Apple-native host. It does not fork or copy the web implementation.

## Architecture

- SwiftUI owns the application lifecycle.
- `WKWebView` loads `index.html`, `manifest.webmanifest`, `src/`, and `legal/` from the compiled application bundle.
- `WKWebsiteDataStore.default()` preserves WebKit local storage across normal launches.
- The existing `navigator.vibrate` contract is bridged to UIKit impact feedback; the web haptic vocabulary remains unchanged.
- `AVAudioSession` uses the ambient, mix-with-others category. Existing Web Audio assets and preferences remain authoritative.
- In-webview networking is denied. User-activated canonical `https://superrr8.github.io/pokerpilot/legal/` links may open in the system browser.
- No account, analytics, advertising, tracking, payment, cloud-sync, notification, or sensitive-device permission is present.

The Xcode resource references point directly to the repository's accepted web source. Xcode copies those resources into the built `.app`; normal native operation does not load the GitHub Pages application.

## Local build

```sh
xcodebuild \
  -project ios/PokerElevate.xcodeproj \
  -scheme PokerElevate \
  -configuration Debug \
  -sdk iphonesimulator \
  -derivedDataPath /tmp/PokerElevateDerivedData \
  CODE_SIGNING_ALLOWED=NO \
  build
```

`app.pokerelevate.ios` is a provisional local bundle identifier. The final App Store identifier, Apple Developer team, signing, distribution profile, and verified support/operator information remain external release dependencies.

## Simulator validation hook

When the launch environment contains `POKERELEVATE_NATIVE_VALIDATION=1`, the Debug build emits one `POKERELEVATE_NATIVE_VALIDATION` JSON record after the bundled application finishes loading. It checks local-file loading, horizontal overflow, navigation presence, EN/RU switching, canonical legal identities, audio APIs, the native haptic bridge, and a local-storage counter. Launching twice without uninstalling must increase `storagePrevious`/`storageCurrent`, demonstrating relaunch persistence.

The hook does not run during ordinary launches and is not a product feature. Its namespaced validation key is covered by PokerElevate's existing Delete All Local Data prefixes.

## Deferred to later approved stages

- App icon and identity assets
- Launch/loading animation
- Distribution signing, archive, TestFlight, and App Store submission
- Physical-device audio and haptic acceptance
