# react-native-live-activities

React Native bindings for [ActivityKit](https://developer.apple.com/documentation/activitykit) — Live Activities and the Dynamic Island — with a ready-to-copy Widget Extension UI template. The package installs into apps targeting iOS 15.1+, while Live Activity APIs are available only at runtime on iOS 16.2+.

RN support for Live Activities is fragile industry-wide because the hard part isn't the JS↔native bridge — it's that ActivityKit **requires a real Widget Extension Xcode target**, which no npm/CocoaPods install can create for you. This package ships the bridge *and* the template files so you're not staring at Apple's SwiftUI sample code trying to reverse-engineer what's reusable.

**Why 16.2 and not 16.1** (ActivityKit technically shipped in 16.1): the native module uses the `ActivityContent<State>`-wrapped `request`/`update`/`end` APIs and the `pushTokenUpdates` async stream, all of which Apple introduced in iOS 16.2, not 16.1. An earlier draft of this package incorrectly claimed 16.1 support while calling 16.2-only APIs — fixed, and called out here so nobody re-introduces a 16.1 guard by copying an old snippet.

## What you get

- A JS API to start/update/end an activity, and listen for push tokens (needed for remote/background updates).
- A common `ContentState` shape (title, subtitle, progress, endDate, JSON escape hatch) covering timers, progress bars, delivery/ETA banners, and live scores — the large majority of real Live Activity use cases.
- A copy-paste-ready `LiveActivityWidgetTemplate.swift` implementing the lock-screen banner *and* all four Dynamic Island presentations (expanded, compact leading/trailing, minimal).

## Installation

```bash
yarn add react-native-live-activities
cd ios && pod install
```

This installs the **native module only** (JS↔Swift bridge for starting/updating/ending activities). You still need to do the one-time Widget Extension setup below — there's no way around it, ActivityKit requires it.

### Widget Extension setup (one-time, ~10 minutes)

1. In Xcode: **File → New → Target… → Widget Extension**. Name it e.g. `LiveActivityWidget`. When prompted, check **"Include Live Activity"**.
2. Delete the boilerplate Swift file Xcode generated in the new target.
3. Add the pod to **both** targets in your Podfile, then run `pod install`:
   ```ruby
   target 'YourApp' do
     pod 'react-native-live-activities', :path => '../node_modules/react-native-live-activities'
   end

   target 'YourWidgetExtension' do
     pod 'react-native-live-activities', :path => '../node_modules/react-native-live-activities'
   end
   ```
   The pod exports the shared `LiveActivityAttributes` type as the stable `RNLiveActivities` module, so both targets compile against the exact same ActivityKit contract.
4. Copy [`widget-template/LiveActivityWidgetTemplate.swift`](widget-template/LiveActivityWidgetTemplate.swift) into the widget extension target only. It already imports `RNLiveActivities`; adjust the SwiftUI layout to your design — this file is a starting point, not something you're meant to ship unmodified.
5. In your widget extension's `@main` bundle file, make sure `LiveActivityWidgetTemplate()` is included in the `WidgetBundle`.
6. Build & run on a **physical device**. Live Activities can be visually tested in the simulator, but ActivityKit push-token delivery for remote updates must be validated on-device.

## JS usage

```ts
import { areActivitiesEnabled, startActivity, updateActivity, endActivity, addPushTokenListener } from 'react-native-live-activities';

const enabled = await areActivitiesEnabled();

const activityId = await startActivity('delivery-tracker', {
  title: 'Order #4471',
  subtitle: 'Preparing your order…',
  progress: 0.1,
  endDate: Date.now() + 30 * 60 * 1000,
});

await updateActivity(activityId, { title: 'Order #4471', subtitle: 'On its way…', progress: 0.6, endDate: Date.now() + 12 * 60 * 1000 });

await endActivity(activityId, { policy: 'default', finalState: { title: 'Order #4471', subtitle: 'Delivered!', progress: 1 } });

// For remote (backgrounded/killed app) updates, forward the push token to your backend:
addPushTokenListener((id, tokenHex) => sendToBackend({ activityId: id, pushTokenHex: tokenHex }));
```

See [`example/App.tsx`](example/App.tsx) for a runnable delivery-tracker demo screen. It's a single screen, not a scaffolded app — drop it in as the root component of any bare RN project (`npx @react-native-community/cli init`) after completing the Widget Extension setup above.

## Remote (push) updates

`addPushTokenListener` gives you a per-activity APNs push token (as hex). To update the activity while your app isn't running:
1. Send that token, plus your usual push credentials, to your server.
2. POST to APNs with `apns-push-type: liveactivity` and a payload matching ActivityKit's [content-state push format](https://developer.apple.com/documentation/activitykit/updating-live-activities-with-activitykit-push-notifications). Field names must match `LiveActivityAttributes.ContentState`'s Codable keys exactly (`title`, `subtitle`, `progress`, `endDate`, `extraDataJson`).
3. This package does not include a push-sending helper — reuse your existing APNs infra, or open an issue if there's appetite for a small helper package.

## Known limitations (MVP)

- Activity handles do not survive an app relaunch. If your app is killed and relaunched while an activity is still running, `updateActivity`/`endActivity` will fail with `NOT_FOUND` until you re-fetch and re-register the handle via `Activity<LiveActivityAttributes>.activities` (not yet exposed in the JS API — contribution welcome).
- `endActivity({ policy: 'after' })` requires `afterDate` — the native module rejects with `MISSING_AFTER_DATE` if you omit it, rather than silently dismissing immediately.
- `ContentState` is fixed to the 5 fields above. Extend `LiveActivityAttributes.ContentState` in your own copy of the file if you need more, and update `LiveActivitiesModule.swift`'s method signatures to match (or use `extraDataJson` for anything ad hoc).
- No Android equivalent — Android's closest concept (ongoing notifications / Live Updates in Android 16) is out of scope for this MVP.

## License

MIT
