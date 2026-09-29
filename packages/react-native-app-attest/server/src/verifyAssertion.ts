import * as crypto from 'crypto';
import { decode as cborDecode } from 'cbor';
import { parseAuthData } from './authData';

export interface VerifyAssertionInput {
  /** Base64 assertion returned by `generateAssertion()` on the client. */
  assertionBase64: string;
  /** SHA-256 hash (base64) of the exact request payload the client signed — recompute this server-side, never trust a client-sent hash. */
  clientDataHashBase64: string;
  /** The JWK you stored when this device's attestation was originally verified. */
  storedPublicKeyJwk: crypto.JsonWebKey;
  /** The signCount you stored from the last successful attestation/assertion for this device. */
  storedSignCount: number;
  teamId: string;
  bundleId: string;
}

export interface VerifiedAssertion {
  /** Persist this — it must be strictly greater than the previous value on the next call (replay protection). */
  newSignCount: number;
}

/**
 * Verifies a per-request App Attest assertion. Call this on every sensitive API request from
 * a mobile client, using a freshly-hashed request body as `clientDataHashBase64` — this binds
 * the assertion to that exact request, preventing replay against a different payload.
 */
export function verifyAssertion(input: VerifyAssertionInput): VerifiedAssertion {
  const { signature, authenticatorData } = cborDecode(Buffer.from(input.assertionBase64, 'base64')) as {
    signature: Buffer;
    authenticatorData: Buffer;
  };

  const clientDataHash = Buffer.from(input.clientDataHashBase64, 'base64');
  const nonce = crypto.createHash('sha256').update(Buffer.concat([authenticatorData, clientDataHash])).digest();

  const publicKey = crypto.createPublicKey({ key: input.storedPublicKeyJwk, format: 'jwk' });
  const signatureValid = crypto.verify('sha256', nonce, publicKey, signature);
  if (!signatureValid) {
    throw new Error('Assertion signature does not verify against the stored public key.');
  }

  const authData = parseAuthData(authenticatorData, false);

  const expectedRpIdHash = crypto.createHash('sha256').update(`${input.teamId}.${input.bundleId}`).digest();
  if (!authData.rpIdHash.equals(expectedRpIdHash)) {
    throw new Error('rpIdHash does not match this app.');
  }

  if (authData.signCount <= input.storedSignCount) {
    throw new Error(
      `signCount did not increase (stored=${input.storedSignCount}, received=${authData.signCount}) — possible replay attack or cloned key.`
    );
  }

  return { newSignCount: authData.signCount };
}
