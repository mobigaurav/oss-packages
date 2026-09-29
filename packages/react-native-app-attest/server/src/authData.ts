/**
 * Parses the `authData` byte layout common to WebAuthn / App Attest:
 *   rpIdHash        (32 bytes) — SHA-256 of "<teamId>.<bundleId>"
 *   flags           (1 byte)
 *   signCount       (4 bytes, big-endian uint32) — 0 on first attestation, increments per assertion
 *   aaguid          (16 bytes) — "appattest\0\0\0\0\0\0\0" or "appattestdevelop\0" for dev builds
 *   credentialIdLen (2 bytes, big-endian uint16)
 *   credentialId    (credentialIdLen bytes) — equals the key's SHA-256 hash for App Attest
 *   credentialPublicKey (remaining bytes, COSE_Key CBOR — only present in attestation, not assertions)
 */
export interface ParsedAuthData {
  rpIdHash: Buffer;
  flags: number;
  signCount: number;
  aaguid: Buffer;
  credentialId: Buffer;
  credentialPublicKeyCbor: Buffer | null;
}

const AAGUID_PROD = Buffer.from('appattest\0\0\0\0\0\0\0', 'latin1');
const AAGUID_DEV = Buffer.from('appattestdevelop', 'latin1');

export function parseAuthData(authData: Buffer, isAttestation: boolean): ParsedAuthData {
  if (authData.length < 37) {
    throw new Error('authData is too short to be valid.');
  }
  const rpIdHash = authData.subarray(0, 32);
  const flags = authData[32];
  const signCount = authData.readUInt32BE(33);

  if (!isAttestation) {
    return { rpIdHash, flags, signCount, aaguid: Buffer.alloc(0), credentialId: Buffer.alloc(0), credentialPublicKeyCbor: null };
  }

  if (authData.length < 55) {
    throw new Error('authData is too short to contain an attestation aaguid + credentialId length.');
  }
  const aaguid = authData.subarray(37, 53);
  const credentialIdLen = authData.readUInt16BE(53);
  if (authData.length < 55 + credentialIdLen) {
    throw new Error('authData is too short to contain the declared credentialId.');
  }
  const credentialId = authData.subarray(55, 55 + credentialIdLen);
  const credentialPublicKeyCbor = authData.subarray(55 + credentialIdLen);

  return { rpIdHash, flags, signCount, aaguid, credentialId, credentialPublicKeyCbor };
}

export function isKnownAppAttestAaguid(aaguid: Buffer): boolean {
  return aaguid.equals(AAGUID_PROD) || aaguid.equals(AAGUID_DEV);
}

/** True if this attestation was generated in Apple's development App Attest environment (Debug/TestFlight builds). */
export function isDevelopmentAaguid(aaguid: Buffer): boolean {
  return aaguid.equals(AAGUID_DEV);
}
