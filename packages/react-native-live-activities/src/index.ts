import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { LiveActivityContentState, EndActivityOptions, PushTokenListener } from './types';

export * from './types';

const LINKING_ERROR =
  `react-native-live-activities is iOS-only and requires native linking.\n` +
  `Run 'pod install' in your ios/ folder, and rebuild the app (not Fast Refresh).\n` +
  `You also need a Widget Extension target — see the package README before calling startActivity().`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NativeLiveActivities: any = NativeModules.LiveActivities
  ? NativeModules.LiveActivities
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

const emitter = Platform.OS === 'ios' ? new NativeEventEmitter(NativeLiveActivities) : undefined;

/** False on iOS < 16.2, on iPad, or if the user disabled Live Activities in Settings. */
export function areActivitiesEnabled(): Promise<boolean> {
  if (Platform.OS !== 'ios') return Promise.resolve(false);
  return NativeLiveActivities.areActivitiesEnabled();
}

/** Starts a new Live Activity. `activityName` should be a stable string identifying the activity type (e.g. "delivery-tracker"). Returns the system-assigned activity ID. */
export function startActivity(activityName: string, initialState: LiveActivityContentState): Promise<string> {
  return NativeLiveActivities.startActivity(
    activityName,
    initialState.title,
    initialState.subtitle ?? null,
    initialState.progress ?? null,
    initialState.endDate ?? null,
    initialState.extraDataJson ?? null
  );
}

/** Pushes a new ContentState to a running activity. Local update only — for remote push updates, use the push token from `addPushTokenListener` with APNs. */
export function updateActivity(activityId: string, state: LiveActivityContentState): Promise<void> {
  return NativeLiveActivities.updateActivity(
    activityId,
    state.title,
    state.subtitle ?? null,
    state.progress ?? null,
    state.endDate ?? null,
    state.extraDataJson ?? null
  );
}

export function endActivity(activityId: string, options: EndActivityOptions = {}): Promise<void> {
  return NativeLiveActivities.endActivity(
    activityId,
    options.policy ?? 'default',
    options.afterDate ?? null,
    options.finalState?.title ?? null,
    options.finalState?.subtitle ?? null,
    options.finalState?.progress ?? null,
    options.finalState?.endDate ?? null,
    options.finalState?.extraDataJson ?? null
  );
}

/**
 * Fires whenever ActivityKit issues (or rotates) a push token for a running activity.
 * Send `pushTokenHex` to your backend so it can push remote ContentState updates via APNs —
 * required if you want the activity to update while your app is backgrounded/killed.
 */
export function addPushTokenListener(listener: PushTokenListener): () => void {
  if (!emitter) return () => {};
  const sub = emitter.addListener(
    'LiveActivities:pushToken',
    (payload: { activityId: string; pushTokenHex: string }) => {
      listener(payload.activityId, payload.pushTokenHex);
    }
  );
  return () => sub.remove();
}
