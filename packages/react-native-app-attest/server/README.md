# @react-native-app-attest/server-verify

Node.js server-side verifier for Apple App Attest attestations and assertions. Pairs with the `react-native-app-attest` client SDK ([../README.md](../README.md)).

Implements Apple's documented algorithm: [Validating apps that connect to your server](https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server).

## Installation

```bash
npm install @react-native-app-attest/server-verify
```

## Required setup

1. Download Apple's **Apple App Attestation Root CA** certificate from <https://www.apple.com/certificateauthority/> and set it as an environment variable:
   ```bash
   export APPLE_APP_ATTEST_ROOT_CA_PEM="$(cat AppleAppAttestationRootCA.pem)"
   ```
   The library refuses to run (`assertRootCertificateConfigured()`) until this is set — this is deliberate so you can't accidentally ship without it.
2. Know your **Team ID** and **bundle ID** — both are required inputs to `verifyAttestation()`/`verifyAssertion()`, since App Attest binds keys to `"<teamId>.<bundleId>"`.
3. Generate a fresh, unpredictable, single-use **challenge** server-side for every attestation request (e.g. `crypto.randomBytes(32).toString('base64')`) — never let the client generate it.

## Usage

### Step 1 — attestation (once per app install)

```ts
import { verifyAttestation } from '@react-native-app-attest/server-verify';

const result = await verifyAttestation({
  attestationBase64,      // from the client's attestKey()
  challengeBase64,        // the challenge YOU generated and sent to the client
  keyId,                  // from the client's generateKey()
  teamId: 'ABCDE12345',
  bundleId: 'com.yourorg.yourapp',
  // true for Debug/TestFlight builds (App Attest uses a different AAGUID in dev), false/omit
  // for App Store production builds. Verification throws if this doesn't match the AAGUID
  // actually present in the attestation — don't hardcode `false` in an environment that also
  // serves TestFlight traffic.
  isDevelopmentEnvironment: process.env.NODE_ENV !== 'production',
});

// Persist result.publicKeyJwk, result.keyId, result.signCount against this device/user.
```

### Step 2 — assertion (every subsequent sensitive request)

```ts
import { verifyAssertion } from '@react-native-app-attest/server-verify';
import crypto from 'crypto';

const clientDataHashBase64 = crypto.createHash('sha256').update(rawRequestBody).digest('base64');

const { newSignCount } = verifyAssertion({
  assertionBase64,          // from the client's generateAssertion()
  clientDataHashBase64,     // recomputed server-side from the actual request body — never trust a client-sent hash
  storedPublicKeyJwk,       // from the attestation you persisted earlier
  storedSignCount,          // from the attestation/last assertion you persisted
  teamId: 'ABCDE12345',
  bundleId: 'com.yourorg.yourapp',
});

// Persist newSignCount, replacing the old value — verifyAssertion() throws if it doesn't strictly increase
// (that check is your replay-attack / cloned-key protection).
```

## Data you must persist per device

| Field | From | Purpose |
|---|---|---|
| `keyId` | attestation | Primary lookup key |
| `publicKeyJwk` | attestation | Verifies every future assertion signature |
| `signCount` | attestation (initially `0`), then every assertion | Replay protection — must strictly increase |

## Security notes

- This is a **reference implementation** validated against Apple's documented steps, not a production-audited library. Review the code, especially [`verifyAttestation.ts`](src/verifyAttestation.ts)'s certificate chain and nonce-extension parsing, before relying on it for high-value fraud prevention.
- **A prior version of this file had a critical bug**: the certificate chain check called `forge.pki.verifyCertificateChain(caStore, chain, () => true)`. node-forge uses a supplied verify callback's *return value*, not the underlying pass/fail result, to decide whether each check in the chain (signature, expiry, basic constraints) succeeded — so a callback that always returns `true` silently accepted **any** certificate chain, including a self-signed forgery. This has been fixed (no callback, default strict verification, failures caught and treated as rejection), and there's now a regression test ([`src/__tests__/verifyAttestation.test.ts`](src/__tests__/verifyAttestation.test.ts)) that builds a forged/unrelated certificate chain and asserts `verifyAttestation` rejects it — confirmed to fail loudly if the bug is reintroduced (verified by temporarily restoring the buggy callback and watching the test fail with the exact expected diagnostic, then reverting).
- `verifyAttestation` now enforces Apple's full documented checklist: certificate chain, nonce match, credentialId/keyId consistency, rpIdHash, **initial signCount === 0**, AAGUID recognized, and **AAGUID matches the caller's declared `isDevelopmentEnvironment`** (a production server that doesn't pass this flag will now correctly reject development/TestFlight attestations instead of silently trusting them).
- Rate-limit your challenge-issuing endpoint — an attacker who can request unlimited challenges can attempt (slow, expensive) offline analysis.
- `verifyAssertion()`'s `signCount` check is your primary defense against a stolen/cloned attestation being replayed from a different device — do not skip persisting and checking it.

## Running the tests

```bash
cd server
npm install
npm test        # jest — 18 tests covering authData parsing, the certificate-chain regression, and full
                # signature-verification round trips for verifyAssertion using real EC keypairs
npm run typecheck
```

Coverage notes: `verifyAssertion` is tested end-to-end with real `crypto.generateKeyPairSync('ec', ...)` keys and real ECDSA signatures (no mocking) — valid signature, tampered clientDataHash, wrong signing key, replayed signCount, and mismatched rpIdHash are all exercised. `verifyAttestation`'s certificate-chain step is tested with real RSA-based forge certificate chains (RSA rather than the real P-256 App Attest uses, since chain-of-trust verification is independent of the leaf's key algorithm) — it does **not** yet include a full positive-path test with a real EC leaf certificate carrying the custom App Attest nonce X.509 extension, since hand-building that extension via raw ASN.1 is significant additional effort. That remains the highest-value follow-up if you want full line coverage of `verifyAttestation`'s happy path; the current suite already covers the bug class that mattered most (the chain-verification bypass) plus every rejection branch.

## License

MIT
