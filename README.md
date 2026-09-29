# OSS Packages — Apple Framework Wrappers for React Native

Three open-source React Native packages targeting Apple frameworks with weak or stale OSS coverage, picked from a survey of Apple's App Services capability list (Sept 2026):

| Package | Wraps | Why it's worth building |
|---|---|---|
| [`react-native-healthkit-modern`](packages/react-native-healthkit-modern) | HealthKit | Existing wrappers are old, poorly typed, and miss newer data types (State of Mind, Cycling FTP). Every fitness/wellness app needs this. |
| [`react-native-app-attest`](packages/react-native-app-attest) | App Attest + DeviceCheck | Near-zero RN coverage. Ships with a Node.js **server-side verification helper** — most attestation libraries only cover the client half. |
| [`react-native-live-activities`](packages/react-native-live-activities) | ActivityKit (Live Activities / Dynamic Island) | RN support is fragile industry-wide. Includes a ready-to-copy Widget Extension template, which is the part most devs get stuck on. |

Each package is:
- **iOS-only** (these are Apple-exclusive frameworks; each README documents Android behavior — no-op or throws a clear "unsupported platform" error).
- Built as a **legacy Native Module** (`NativeModules` bridge via `RCTEventEmitter`/`RCT_EXTERN_MODULE`), which works on both the old and new React Native architectures through RN's interop layer. None of the three are Turbo Modules yet — that's a tracked follow-up per package, not a hidden gap (see each package's README "Architecture" section).
- Shipped with a **runnable example screen** (`example/App.tsx`) demonstrating the full API — not a full scaffolded app, since each package should be droppable into any existing bare RN or Expo (bare workflow / dev client) project.

## Repo layout

```
oss-packages/
  package.json              ← yarn/npm workspaces root
  packages/
    react-native-healthkit-modern/
    react-native-app-attest/
    react-native-live-activities/
```

## Local development

```bash
cd oss-packages
yarn install                # sets up workspace symlinks
cd packages/react-native-healthkit-modern
yarn build                  # compiles src/ → lib/ via react-native-builder-bob
```

To test a package against a real app before publishing, use `yarn link` or point a consumer app's `package.json` at `"react-native-healthkit-modern": "file:../oss-packages/packages/react-native-healthkit-modern"`.

## Publishing checklist (per package)

1. Bump `version` in the package's `package.json` (semver).
2. `yarn build` — verify `lib/` output is clean.
3. `npm publish --access public` from inside the package directory.
4. Tag the release in git: `git tag <package-name>@<version>`.
5. Update the package's own `CHANGELOG.md` (create one on first publish).

## Status

All three are **MVP scaffolds** — the native Swift implementations cover the core API surface described in each README but have not been run through Apple's full review/certification process (App Attest and HealthKit both require entitlements approval per consuming app, not per package). Treat this as a strong starting point, not a `1.0.0`.
