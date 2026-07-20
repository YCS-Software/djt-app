# Building the iOS app in the cloud (no Mac required)

You can develop the app on Windows, but the final iOS compile (`xcodebuild`,
CocoaPods, code signing) only runs on macOS. This repo builds iOS on GitHub's
macOS runners instead — see [.github/workflows/ios-build.yml](../.github/workflows/ios-build.yml).

## What runs automatically

Every push to `main` that touches `mobile_app/**` (and every PR, plus manual
runs from the **Actions** tab) triggers the **`simulator-build`** job:

1. `npm ci`
2. `npm run build` (Vite → `out/`)
3. `npx cap sync ios`
4. `pod install`
5. `xcodebuild` for the iOS Simulator (unsigned)
6. Uploads `App-simulator.zip` as a downloadable artifact

This needs **no Apple Developer account and no secrets** — it just proves the
app compiles for iOS and gives you a bundle you can drag into the iOS Simulator
on any Mac.

### To trigger it manually
GitHub → **Actions** tab → **iOS Build** → **Run workflow**.
Download the result under the run's **Artifacts** section.

## Getting a `.ipa` for a real iPhone — WITHOUT an Apple Developer account

The **`unsigned-ipa`** job builds a device `.ipa` that is **not signed**, then
uploads it as the `ios-unsigned-ipa` artifact (`App-unsigned.ipa`). It runs on
every push/manual trigger — no secrets, no paid account.

You can't install an unsigned `.ipa` by just copying it. Install it with a free
sideloading tool that re-signs it using your **ordinary (free) Apple ID**:

- **[Sideloadly](https://sideloadly.io/)** (Windows/macOS) — plug in your
  iPhone, drop in `App-unsigned.ipa`, sign in with your Apple ID, install.
- **[AltStore](https://altstore.io/)** — similar, installs an on-device store.

Caveats of free sideloading: the app **expires after 7 days** (just re-install),
and a free Apple ID allows only 3 sideloaded apps at once. Some native features
that need special entitlements (push, etc.) may not work under a free Apple ID.

## Getting a signed `.ipa` for TestFlight / App Store (paid account)

The second job, **`signed-ipa`**, produces a signed `.ipa`. It only runs on a
manual (`workflow_dispatch`) trigger and **skips itself until you add signing
secrets**, so the workflow stays green in the meantime.

You need an **Apple Developer account ($99/yr)**. Then add these repository
secrets (Settings → Secrets and variables → Actions):

| Secret | What it is |
|--------|------------|
| `IOS_P12_BASE64` | Your Apple **distribution certificate** exported as `.p12`, base64-encoded |
| `IOS_P12_PASSWORD` | The password you set when exporting the `.p12` |
| `IOS_MOBILEPROVISION_BASE64` | The **provisioning profile** (`.mobileprovision`) for `com.djthaika.ev`, base64-encoded |
| `IOS_SIGNING_IDENTITY` | e.g. `Apple Distribution: Your Company (TEAMID)` |
| `IOS_TEAM_ID` | Your 10-char Apple Team ID |
| `IOS_PROVISIONING_PROFILE_NAME` | The provisioning profile's **name** (not filename) |

To base64-encode a file:
- macOS/Linux: `base64 -i cert.p12 | pbcopy`
- Windows PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.p12")) | Set-Clipboard`

The export currently targets `method = app-store` (for TestFlight/App Store).
For ad-hoc device installs, change `<string>app-store</string>` to
`<string>ad-hoc</string>` in the workflow's `ExportOptions.plist` block.

> **Bundle ID:** `com.djthaika.ev` — your provisioning profile must match this
> (set in [capacitor.config.ts](capacitor.config.ts) and the Xcode project).

## Alternatives to GitHub Actions
- **Codemagic** / **Bitrise** / **Ionic Appflow** — Capacitor-friendly CI with
  guided iOS signing (managed certificates), if you prefer a UI over secrets.
- **A borrowed/rented Mac** — clone, `cd mobile_app && npm install && npm run
  ios:build`, then open `ios/App/App.xcworkspace` in Xcode.
