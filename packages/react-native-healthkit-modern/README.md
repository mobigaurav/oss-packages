# react-native-healthkit-modern

Modern, TypeScript-first HealthKit bindings for React Native. iOS only.

Built because the existing HealthKit wrappers in the RN ecosystem are years stale, loosely typed, and don't cover newer data types (Cycling FTP, State of Mind) or background observer queries in a clean way.

## Features

- Fully typed quantity + category sample queries (steps, heart rate, HRV, oxygen saturation, body mass, cycling FTP, sleep analysis, mindful sessions, state of mind).
- Background delivery + `HKObserverQuery` wired to a single `observeQuantityType()` call — no manual native event wiring required. Safe to call from multiple components for the same identifier (JS-side subscriber ref-counting keeps the underlying native query alive until the last subscriber unsubscribes).
- Legacy Native Module (`NativeModules` bridge via `RCTEventEmitter`/`RCT_EXTERN_MODULE`), which works on both the old and new React Native architectures through RN's built-in interop layer. **Not yet a Turbo Module** — see "Architecture" below if you're wondering why.

## Installation

```bash
yarn add react-native-healthkit-modern
cd ios && pod install
```

### Required Xcode setup (cannot be automated by npm)

1. In Xcode, select your app target → **Signing & Capabilities** → **+ Capability** → add **HealthKit**.
2. Add to `Info.plist`:
   ```xml
   <key>NSHealthShareUsageDescription</key>
   <string>We use Health data to show your activity trends.</string>
   <key>NSHealthUpdateUsageDescription</key>
   <string>We write workout data back to Health so it stays in sync.</string>
   ```
3. If you use `enableBackgroundDelivery`, also add the **Background Modes** capability and check **Background fetch** / **Remote notifications** (HealthKit background delivery relies on background app refresh being enabled by the user in Settings — you cannot force this).

## Usage

```ts
import {
  isHealthDataAvailable,
  requestAuthorization,
  queryQuantitySamples,
  observeQuantityType,
} from 'react-native-healthkit-modern';

await requestAuthorization({ read: ['stepCount', 'heartRate'], write: [] });

const steps = await queryQuantitySamples('stepCount', {
  startDate: Date.now() - 7 * 24 * 60 * 60 * 1000,
  endDate: Date.now(),
});

const unsubscribe = observeQuantityType('stepCount', () => {
  console.log('New step data arrived, refetch as needed.');
});
```

See [`example/App.tsx`](example/App.tsx) for a runnable screen covering authorization, querying, and observers. It's a single screen, not a scaffolded app — drop it in as the root component of any bare RN project (`npx @react-native-community/cli init` or an Expo bare/dev-client project) after installing this package.

## Architecture

This package uses a **legacy Native Module** (`RCTEventEmitter` + `RCT_EXTERN_MODULE`), not a Turbo Module. This is a deliberate scope decision for the MVP, not an oversight: Turbo Modules require a codegen spec file, a `codegenConfig` entry, and per-RN-version compatibility testing that add real maintenance surface. The legacy bridge works correctly on both the old and new architectures via RN's interop layer, so there's no functional gap for consumers today. Migrating to a real Turbo Module (with a `NativeHealthKitModern.ts` spec) is a tracked follow-up — contributions welcome.

## Unit & value reference

### Quantity samples (`queryQuantitySamples`)

| Identifier | Unit returned |
|---|---|
| `stepCount` | count |
| `heartRate`, `restingHeartRate` | beats per minute |
| `activeEnergyBurned` | kilocalories |
| `heartRateVariabilitySDNN` | milliseconds |
| `oxygenSaturation` | fraction 0–1 |
| `bodyMass` | kilograms |
| `cyclingFunctionalThresholdPower` | watts (iOS 17+) |

### Category samples (`queryCategorySamples`)

`value` is HealthKit's raw enum integer, not a physical quantity — this package does not re-model every enum on the JS side.

| Identifier | `value` meaning |
|---|---|
| `sleepAnalysis` | `HKCategoryValueSleepAnalysis`: 0 inBed, 1 asleepUnspecified, 2 awake, 3 asleepCore, 4 asleepDeep, 5 asleepREM |
| `mindfulSession` | always `0` (presence-only; use `startDate`/`endDate` for duration) |
| `stateOfMind` (iOS 17+) | `HKCategoryValueStateOfMindValence` — see [Apple's docs](https://developer.apple.com/documentation/healthkit/hkcategoryvaluestateofmindvalence) |

## Android

All exported functions resolve to `false`/throw a clear "unsupported platform" error via the `NativeModules` proxy. There is no HealthKit equivalent shim — pair this package with a separate Health Connect (Android) package if you need cross-platform parity.

## Known limitations (MVP)

- `requestAuthorization` follows Apple's own privacy design: it resolves once the sheet is dismissed but does **not** tell you which individual READ permissions were granted. Use `getWriteAuthorizationStatus` for write types, or a read query + empty-result heuristic for read types.
- No write path yet (`saveQuantitySample`/`saveCategorySample`) — read-only in this MVP.
- Not a Turbo Module yet — see "Architecture" above.

## License

MIT
