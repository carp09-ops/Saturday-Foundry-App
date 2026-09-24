# Saturday Foundry — iOS App

Native iOS wrapper (Capacitor 7) around the production web app.
Branch: `ios-app`. The app loads the **live production URL**
(`https://carp09-ops.github.io/Saturday-Foundry-App/`), so every push to
`main` updates the app instantly — no rebuild needed for web changes.

- **Bundle ID:** `com.saturdayfoundry.app` (register this in App Store Connect)
- **Display name:** Saturday Foundry
- **Icon / splash:** generated from `assets/saturday-foundry-shield.webp`

## What's done

- Capacitor config (`capacitor.config.ts`) + synced `ios/App/App/capacitor.config.json`
- iOS Xcode project (`ios/App/`) with bundle ID and display name set
- App icon (1024px shield) and launch splash installed
- `package.json` with `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`

## Remaining steps

### 1. Apple Developer Program enrollment (hard blocker)

Nothing can be installed on a real iPhone until this clears. The
in-app camera identity verification keeps failing — don't just retry it.
Instead: go to developer.apple.com → Contact Us → reach Apple Developer
Support by phone or chat and ask for **manual identity verification**.
If you're offered a passport as an alternative document, take it.

### 2. Cloud Mac build (Codemagic — simplest)

1. Sign up at codemagic.io and connect the `Saturday-Foundry-App` repo.
2. Create an iOS workflow pointed at the **`ios-app`** branch.
3. Codemagic's Capacitor preset runs `npm install` → `npx cap sync ios` →
   `pod install` → Xcode archive automatically.
4. Add your Apple Developer credentials in Codemagic for code signing
   (it can generate the signing certificate + provisioning profile for you).
5. Build → download the `.ipa`.

Alternative: GitHub Actions with a `macos-latest` runner, same commands.

### 3. TestFlight

Upload the `.ipa` to App Store Connect (Codemagic can do this automatically).
For a 4–45 person league, TestFlight is the right channel — invite coaches by
email or a public TestFlight link. No full App Store review needed.

## Notes

- iOS 14.0+ (set in `ios/App/Podfile`).
- `limitsNavigationsToAppBoundDomains` is on: the WebView stays inside the app.
- To change the app name or bundle ID later, edit `capacitor.config.ts`,
  `ios/App/App/Info.plist`, and the `PRODUCT_BUNDLE_IDENTIFIER` in
  `ios/App/App.xcodeproj/project.pbxproj`.
