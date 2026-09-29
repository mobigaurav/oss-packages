# react-native-app-attest

React Native bindings for [Apple App Attest](https://developer.apple.com/documentation/devicecheck), paired with a **Node.js server-side verifier** ([`server/`](server)) — most App Attest OSS packages only cover the client half, leaving the (harder) verification logic for you to build from scratch.

App Attest lets your server cryptographically confirm that a request really came from an unmodified copy of your app running on genuine Apple hardware — the modern replacement for weaker approaches like custom device fingerprinting.

## Packages in this folder

| Path | What it is |
|---|---|
| `src/`, `ios/` | The React Native client SDK (this package, `react-native-app-attest`) |
| `server/` | A separate, independently-publishable package: `@react-native-app-attest/server-verify` — Node.js attestation/assertion verification |

## Installation (client)

```bash
yarn add react-native-app-attest
cd ios && pod install
```

No extra Xcode capability is required — App Attest is available to any app with a valid provisioning profile on iOS 14+. **It does not work in the iOS Simulator** — `isSupported()` will return `false` there; test on a physical device.

## Client usage

```ts
import { isSupported, generateKey, attestKey, generateAssertion } from 'react-native-app-attest';

// 1. One-time setup per install:
const keyId = await generateKey();                       // store keyId (Keychain) — you'll reuse it
const challengeBase64 = await fetchChallengeFromServer(); // server-generated, single-use, unpredictable
const attestationBase64 = await attestKey(keyId, challengeBase64);
// POST { keyId, attestationBase64, challengeBase64 } to your backend → verifyAttestation()

// 2. Per sensitive request thereafter:
const clientDataHash = sha256Base64(JSON.stringify(requestBody)); // your own hashing, matching server-side
const assertionBase64 = await generateAssertion(keyId, clientDataHash);
// Send { assertionBase64, requestBody } to your backend → verifyAssertion()
```

`sha256Base64` above is a placeholder for whatever crypto library you already use — **React Native has no built-in SHA-256** (it's not a Node.js runtime). Reach for `expo-crypto`'s `digestStringAsync()`, `react-native-quick-crypto`, or `crypto-js`. Whatever you pick, use the exact same hashing on the server when recomputing `clientDataHashBase64` for `verifyAssertion()`, or every assertion will fail to verify.

See [`example/App.tsx`](example/App.tsx) for a runnable screen (the example hardcodes a fixed base64 string in place of real hashing, to keep it dependency-free — see the comment there before copying it into a real app).

## Server usage

See [`server/README.md`](server/README.md) for the verification API, which implements Apple's documented [attestation validation algorithm](https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server).

## Why this matters (and what it doesn't replace)

- App Attest proves *"this request came from a real copy of my app on real Apple hardware, and this specific request wasn't tampered with."*
- It does **not** replace authentication (you still need to know *which user* is calling) or authorization.
- It's most valuable on endpoints that are otherwise abusable by bots/scripts/jailbroken re-signed apps: account creation, promo code redemption, in-app purchase validation, anti-cheat, rate-limit bypass prevention.

## Known limitations (MVP)

- The bundled `verifyAttestation()` does not embed Apple's root CA certificate (by design — see [`server/src/appleRootCertificate.ts`](server/src/appleRootCertificate.ts)); you must supply it via an environment variable before deploying.
- No built-in receipt exchange with the App Store Server API — the raw `receiptBase64` is returned for you to process separately if you need it.
- No persistence layer included — you must store `{ keyId, publicKeyJwk, signCount }` per device yourself (any DB works; this is a handful of columns).
- The server package has a regression test suite (`server/`, `npm test` — 18 tests) covering the certificate-chain verification bug class, all rejection branches, and full round-trip signature verification with real EC keypairs. It does not yet include a full positive-path test for `verifyAttestation` using a real EC leaf certificate with the custom App Attest nonce extension (would require hand-built ASN.1 — tracked as a follow-up in `server/README.md`).

## License

MIT
