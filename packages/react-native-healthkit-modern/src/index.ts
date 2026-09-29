import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type {
  HealthAuthorizationRequest,
  HKQuantitySample,
  HKCategorySample,
  HKQuantityTypeIdentifier,
  HKCategoryTypeIdentifier,
  QueryOptions,
  ObserverCallback,
} from './types';

export * from './types';

const LINKING_ERROR =
  `react-native-healthkit-modern is iOS-only and requires native linking.\n` +
  `Run 'pod install' in your ios/ folder, and rebuild the app (not Fast Refresh).`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NativeHealthKitModern: any = NativeModules.HealthKitModern
  ? NativeModules.HealthKitModern
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

const emitter = Platform.OS === 'ios' ? new NativeEventEmitter(NativeHealthKitModern) : undefined;

/** True on any iOS device/simulator; HealthKit itself may still be unavailable (e.g. iPad without Health app data). */
export function isHealthDataAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return Promise.resolve(false);
  return NativeHealthKitModern.isHealthDataAvailable();
}

/**
 * Prompts the system authorization sheet. Resolves once the user dismisses it — does NOT tell
 * you what they approved for READ types (Apple's design — HealthKit deliberately never reports
 * whether read access was granted, to prevent apps from being able to detect e.g. "the user has
 * no heart rate data" vs. "the user denied access"). Use `getWriteAuthorizationStatus` only for
 * WRITE types, or a read query + empty-result heuristic for read types.
 *
 * Rejects with `UNKNOWN_IDENTIFIER` if any requested identifier is unsupported on the device's
 * OS version (e.g. requesting `stateOfMind` on iOS 16) — fails loudly instead of silently
 * requesting a smaller permission set than you asked for.
 */
export function requestAuthorization(request: HealthAuthorizationRequest): Promise<void> {
  return NativeHealthKitModern.requestAuthorization(request.read, request.write);
}

/**
 * Reports whether the user has granted WRITE (share) access for a type. Not meaningful for
 * READ-only types — see `requestAuthorization`'s doc comment for why.
 */
export function getWriteAuthorizationStatus(
  identifier: HKQuantityTypeIdentifier | HKCategoryTypeIdentifier
): Promise<'notDetermined' | 'denied' | 'authorized'> {
  return NativeHealthKitModern.getWriteAuthorizationStatus(identifier);
}

/** One-shot query for quantity samples (steps, heart rate, etc.) in a date range. */
export function queryQuantitySamples(
  identifier: HKQuantityTypeIdentifier,
  options: QueryOptions
): Promise<HKQuantitySample[]> {
  return NativeHealthKitModern.queryQuantitySamples(
    identifier,
    options.startDate,
    options.endDate,
    options.limit ?? 100,
    options.ascending ?? false
  );
}

/** One-shot query for category samples (State of Mind, mindful sessions, sleep analysis). */
export function queryCategorySamples(
  identifier: HKCategoryTypeIdentifier,
  options: QueryOptions
): Promise<HKCategorySample[]> {
  return NativeHealthKitModern.queryCategorySamples(
    identifier,
    options.startDate,
    options.endDate,
    options.limit ?? 100,
    options.ascending ?? false
  );
}

/**
 * Registers an HKObserverQuery + enables background delivery for the given type.
 * `onUpdate` fires whenever new data of this type lands in the Health store, including
 * while your app is backgrounded (subject to iOS's background execution budget).
 * Returns an unsubscribe function.
 *
 * Safe to call multiple times for the same `identifier` from different components — this
 * module keeps a JS-side subscriber count per identifier and only tears down the underlying
 * native HKObserverQuery once every subscriber for that identifier has unsubscribed.
 */
const subscriberCounts = new Map<HKQuantityTypeIdentifier, number>();

export function observeQuantityType(
  identifier: HKQuantityTypeIdentifier,
  onUpdate: ObserverCallback
): () => void {
  if (!emitter) return () => {};

  const currentCount = subscriberCounts.get(identifier) ?? 0;
  if (currentCount === 0) {
    NativeHealthKitModern.startObserverQuery(identifier);
  }
  subscriberCounts.set(identifier, currentCount + 1);

  const sub = emitter.addListener('HealthKitModern:update', (payload: { identifier: HKQuantityTypeIdentifier }) => {
    if (payload.identifier === identifier) onUpdate(identifier);
  });

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return; // guard against double-invocation, e.g. React StrictMode double-effects
    unsubscribed = true;
    sub.remove();
    const remaining = (subscriberCounts.get(identifier) ?? 1) - 1;
    if (remaining <= 0) {
      subscriberCounts.delete(identifier);
      NativeHealthKitModern.stopObserverQuery(identifier);
    } else {
      subscriberCounts.set(identifier, remaining);
    }
  };
}

/** Enables background delivery updates for a type without an in-JS observer (e.g. to keep syncing while app is killed, combined with a background task). */
export function enableBackgroundDelivery(
  identifier: HKQuantityTypeIdentifier,
  frequency: 'immediate' | 'hourly' | 'daily' = 'immediate'
): Promise<void> {
  return NativeHealthKitModern.enableBackgroundDelivery(identifier, frequency);
}
