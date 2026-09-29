import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { decode as cborDecode } from 'cbor';
import { parseAuthData, isKnownAppAttestAaguid, isDevelopmentAaguid } from './authData';
import { assertRootCertificateConfigured } from './appleRootCertificate';

export interface VerifyAttestationInput {
  /** Base64 attestation object returned by `attestKey()` on the client. */
  attestationBase64: string;
  /** The exact same challenge (base64) your server generated and sent to the client. */
  challengeBase64: string;
  /** The `keyId` returned by `generateKey()` on the client (base64). */
  keyId: string;
  /** Your Apple Developer Team ID, e.g. "ABCDE12345". */
  teamId: string;
  /** Your app's bundle identifier, e.g. "com.yourorg.yourapp". */
  bundleId: string;
  /** Set true while testing against a Debug/TestFlight build (App Attest uses a different AAGUID in dev). */
  isDevelopmentEnvironment?: boolean;
}

export interface VerifiedAttestation {
  /** Store this JWK + keyId together — you need the JWK to verify future assertions from this device. */
  publicKeyJwk: crypto.JsonWebKey;
  keyId: string;
  /** Always 0 immediately after attestation; persist it so verifyAssertion() can enforce monotonic increase. */
  signCount: number;
  /** Apple's receipt blob — opaque; store if you plan to use the separate App Store Server API receipt validation flow. */
  receiptBase64: string;
}

/**
 * Verifies an App Attest attestation object per Apple's documented algorithm:
 * https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server
 *
 * Reference implementation — validated against Apple's documented steps, but has not been run through a
 * production security audit. Review before relying on it for high-value fraud prevention.
 */
export async function verifyAttestation(input: VerifyAttestationInput): Promise<VerifiedAttestation> {
  const rootCaPem = assertRootCertificateConfigured();

  const attestationObject = cborDecode(Buffer.from(input.attestationBase64, 'base64')) as {
    fmt: string;
    attStmt: { x5c: Buffer[]; receipt: Buffer };
    authData: Buffer;
  };

  if (attestationObject.fmt !== 'apple-appattest') {
    throw new Error(`Unexpected attestation format: ${attestationObject.fmt}`);
  }

  const [leafDer, intermediateDer] = attestationObject.attStmt.x5c;
  if (!leafDer || !intermediateDer) {
    throw new Error('Attestation is missing the expected x5c certificate chain (leaf + intermediate).');
  }

  // --- Step 1: verify the certificate chain terminates at Apple's App Attest root CA. ---
  const leafForge = derToForgeCert(leafDer);
  const intermediateForge = derToForgeCert(intermediateDer);
  const caStore = forge.pki.createCaStore([rootCaPem]);
  // IMPORTANT: do not pass a custom verify callback here. node-forge's verifyCertificateChain
  // invokes that callback for every check it performs (signature validity, expiration, basic
  // constraints, ...) and uses ITS RETURN VALUE, not the underlying check result, to decide
  // pass/fail. A callback that unconditionally returns `true` (an earlier version of this file
  // had exactly that bug) silently disables every one of those checks and makes this function
  // accept ANY certificate chain, including a self-signed forgery. Let forge's default (no
  // callback) strict validation run, and treat a thrown error as failure.
  let chainOk: boolean;
  try {
    chainOk = forge.pki.verifyCertificateChain(caStore, [leafForge, intermediateForge]);
  } catch {
    chainOk = false;
  }
  if (!chainOk) {
    throw new Error('Certificate chain did not verify against Apple App Attest root CA.');
  }

  // --- Step 2: verify the nonce extension in the leaf certificate. ---
  const clientDataHash = crypto.createHash('sha256').update(Buffer.from(input.challengeBase64, 'base64')).digest();
  const expectedNonce = crypto
    .createHash('sha256')
    .update(Buffer.concat([attestationObject.authData, clientDataHash]))
    .digest();
  const certNonce = extractNonceExtension(leafForge);
  if (!certNonce.equals(expectedNonce)) {
    throw new Error('Nonce mismatch — attestation does not match the challenge/authData pair (possible replay or tampering).');
  }

  // --- Step 3: verify credentialId == SHA-256(public key), and that it matches the client's keyId. ---
  const publicKeyJwk = extractP256PublicKeyJwk(leafDer);
  const publicKeyRawPoint = jwkToUncompressedPoint(publicKeyJwk);
  const computedKeyId = crypto.createHash('sha256').update(publicKeyRawPoint).digest();

  const authData = parseAuthData(attestationObject.authData, true);
  if (!authData.credentialId.equals(computedKeyId)) {
    throw new Error('credentialId in authData does not match SHA-256(publicKey) — attestation is internally inconsistent.');
  }
  if (!Buffer.from(input.keyId, 'base64').equals(computedKeyId)) {
    throw new Error("Client-supplied keyId does not match this attestation's key — possible key substitution attack.");
  }

  // --- Step 4: verify rpIdHash == SHA-256("<teamId>.<bundleId>"). ---
  const expectedRpIdHash = crypto.createHash('sha256').update(`${input.teamId}.${input.bundleId}`).digest();
  if (!authData.rpIdHash.equals(expectedRpIdHash)) {
    throw new Error('rpIdHash does not match this app — attestation may belong to a different app/team.');
  }

  // --- Step 5: verify the initial counter is 0 (Apple's documented requirement for a fresh attestation). ---
  if (authData.signCount !== 0) {
    throw new Error(`Expected signCount 0 on a fresh attestation, got ${authData.signCount} — possible replay of a previously-used attestation object.`);
  }

  // --- Step 6: verify AAGUID identifies this as an App Attest key, and matches the caller's declared environment. ---
  if (!isKnownAppAttestAaguid(authData.aaguid)) {
    throw new Error('Unrecognized AAGUID — not an App Attest attestation.');
  }
  const isDevAaguid = isDevelopmentAaguid(authData.aaguid);
  const expectDev = input.isDevelopmentEnvironment ?? false;
  if (isDevAaguid !== expectDev) {
    throw new Error(
      expectDev
        ? 'Expected a development-environment attestation (isDevelopmentEnvironment: true) but received a production AAGUID.'
        : 'Received a development-environment attestation AAGUID on what was declared a production verification call. ' +
            'Debug/TestFlight builds use the development App Attest environment — pass isDevelopmentEnvironment: true when ' +
            'verifying those, and make sure this branch is never reachable for real production traffic.'
    );
  }

  // --- Step 7: sanity-check the key is the P-256 curve App Attest actually uses. ---
  if (publicKeyJwk.crv !== 'P-256') {
    throw new Error(`Unexpected EC curve on attestation public key: ${publicKeyJwk.crv} (expected P-256).`);
  }

  return {
    publicKeyJwk,
    keyId: input.keyId,
    signCount: authData.signCount,
    receiptBase64: attestationObject.attStmt.receipt.toString('base64'),
  };
}

function derToForgeCert(der: Buffer): forge.pki.Certificate {
  const asn1 = forge.asn1.fromDer(forge.util.createBuffer(der.toString('binary')));
  return forge.pki.certificateFromAsn1(asn1);
}

/** Apple's nonce extension: OID 1.2.840.113635.100.8.2, value = DER SEQUENCE { [1] OCTET STRING nonce }. */
function extractNonceExtension(cert: forge.pki.Certificate): Buffer {
  const ext = cert.extensions.find((e: any) => e.id === '1.2.840.113635.100.8.2');
  if (!ext) throw new Error('Leaf certificate is missing the App Attest nonce extension.');
  const outer = forge.asn1.fromDer(ext.value as string);
  // outer.value[0] is the context-specific [1] wrapper; its .value[0] is the OCTET STRING.
  const octetStringAsn1 = (outer.value as forge.asn1.Asn1[])[0];
  const inner = (octetStringAsn1.value as forge.asn1.Asn1[])[0];
  return Buffer.from(inner.value as string, 'binary');
}

/** Extracts a P-256 public key from a DER-encoded X.509 certificate as a JWK. */
function extractP256PublicKeyJwk(certDer: Buffer): crypto.JsonWebKey {
  const x509 = new crypto.X509Certificate(certDer);
  return x509.publicKey.export({ format: 'jwk' }) as crypto.JsonWebKey;
}

/** Reconstructs the SEC1 uncompressed point (0x04 || X || Y) that Apple hashes to derive the key identifier. */
function jwkToUncompressedPoint(jwk: crypto.JsonWebKey): Buffer {
  if (!jwk.x || !jwk.y) throw new Error('JWK is missing EC coordinates.');
  const x = Buffer.from(jwk.x, 'base64url');
  const y = Buffer.from(jwk.y, 'base64url');
  return Buffer.concat([Buffer.from([0x04]), x, y]);
}
