# Run PokeWorth on an iPhone without a Mac or a paid Apple account

A free Apple ID can sign an app for your own iPhone. The app stops opening after **7 days**
and must be signed again (re-install the same file). Limits: 3 sideloaded apps at a time.

## 1. Build the unsigned app (GitHub, free, no Mac)

1. Open the repo's **Actions** tab, pick **iOS unsigned build**, press **Run workflow**.
2. Wait about 20-40 minutes. When it is green, open the run and download the artifact
   **PokeWorth-unsigned-ipa** (a zip holding `PokeWorth-unsigned.ipa`). Unzip it.

The repo is public, so macOS build minutes are free. The build is a Release build: the
JavaScript is inside the app, no dev server is needed, and the phone's own text reader
(Apple Vision) is included. Auto-scan runs at full speed.

## 2. Sign and install from Windows (you do this part)

1. Install **iTunes** (the desktop version from apple.com, not the Microsoft Store one) so the
   PC can talk to the iPhone, and **Sideloadly** (sideloadly.io).
2. Connect the iPhone with a cable and tap **Trust this computer**.
3. In Sideloadly: drag in `PokeWorth-unsigned.ipa`, type your Apple ID, press **Start**.
   (Use a spare Apple ID if you prefer; Sideloadly sends it to Apple only.)
4. On the iPhone: **Settings > General > VPN & Device Management > your Apple ID > Trust**.
5. On iOS 16 and newer also turn on **Settings > Privacy & Security > Developer Mode**
   (the phone restarts).
6. Open PokeWorth.

## 3. Every 7 days

Run Sideloadly again with the same `.ipa` (no rebuild needed). A new build is only needed when
the app code changes.

## Notes

- Your Apple ID and password are typed into Sideloadly by you. Nobody else needs them.
- AltStore is an alternative to Sideloadly; it can re-sign automatically while the PC is on.
- This is not for publishing. Store release needs the paid Apple Developer account.
