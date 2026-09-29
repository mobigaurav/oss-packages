import { NativeModules, Platform } from 'react-native';

const LINKING_ERROR =
  `react-native-app-attest is iOS-only and requires native linking.\n` +
  `Run 'pod install' in your ios/ folder, and rebuild the app (not Fast Refresh).`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const NativeAppAttest: any = NativeModules.AppAttest
  ? NativeModules.AppAttest
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

/**
 * True on physical devices running iOS 14+ with a Secure Enclave. False on
 * simulators (App Attest cannot be exercised in the simulator — test on device).
 */
export function isSupported(): Promise<boolean> {
  if (Platform.OS !== 'ios') return Promise.resolve(false);
  return NativeAppAttest.isSupported();
}

/**
 * Generates a new hardware-backed attestation key. Store the returned `keyId`
 * (e.g. in Keychain) — you need it for every subsequent `attestKey`/`generateAssertion` call.
 */
export function generateKey(): Promise<string> {
  return NativeAppAttest.generateKey();
}

/**
 * Attests the key with Apple, producing a base64 attestation object to send to
 * your backend for one-time verification. `challengeBase64` must come from your
 * server (a fresh, single-use, unpredictable value — never generate it client-side).
 */
export function attestKey(keyId: string, challengeBase64: string): Promise<string> {
  return NativeAppAttest.attestKey(keyId, challengeBase64);
}

/**
 * Produces a base64 assertion over `clientDataHashBase64` (typically SHA-256 of your
 * request body) proving this specific request came from the attested app instance.
 * Send both the assertion and the original request payload to your server.
 */
export function generateAssertion(keyId: string, clientDataHashBase64: string): Promise<string> {
  return NativeAppAttest.generateAssertion(keyId, clientDataHashBase64);
}
