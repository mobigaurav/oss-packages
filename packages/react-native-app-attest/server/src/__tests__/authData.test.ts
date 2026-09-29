import { parseAuthData, isKnownAppAttestAaguid, isDevelopmentAaguid } from '../authData';

const AAGUID_PROD = Buffer.from('appattest\0\0\0\0\0\0\0', 'latin1');
const AAGUID_DEV = Buffer.from('appattestdevelop', 'latin1');

function buildAssertionShapedAuthData(signCount = 1): Buffer {
  const rpIdHash = Buffer.alloc(32, 0xab);
  const flags = Buffer.from([0x00]);
  const signCountBuf = Buffer.alloc(4);
  signCountBuf.writeUInt32BE(signCount, 0);
  return Buffer.concat([rpIdHash, flags, signCountBuf]);
}

function buildAttestationShapedAuthData(credentialId = Buffer.alloc(32, 0xcd), aaguid = AAGUID_PROD): Buffer {
  const base = buildAssertionShapedAuthData(0);
  const credentialIdLen = Buffer.alloc(2);
  credentialIdLen.writeUInt16BE(credentialId.length, 0);
  return Buffer.concat([base, aaguid, credentialIdLen, credentialId]);
}

describe('parseAuthData', () => {
  test('throws on a buffer shorter than the 37-byte minimum', () => {
    expect(() => parseAuthData(Buffer.alloc(36), false)).toThrow('authData is too short to be valid.');
  });

  test('parses assertion-shaped (37-byte) authData correctly', () => {
    const authData = buildAssertionShapedAuthData(42);
    const parsed = parseAuthData(authData, false);
    expect(parsed.signCount).toBe(42);
    expect(parsed.rpIdHash).toHaveLength(32);
    expect(parsed.credentialId).toHaveLength(0);
  });

  test('throws when attestation-shaped authData is shorter than 55 bytes', () => {
    const tooShort = buildAssertionShapedAuthData(0); // only 37 bytes, no aaguid/credentialIdLen
    expect(() => parseAuthData(tooShort, true)).toThrow(
      'authData is too short to contain an attestation aaguid + credentialId length.'
    );
  });

  test('throws when the declared credentialId length exceeds the remaining buffer', () => {
    const authData = buildAttestationShapedAuthData(Buffer.alloc(32));
    const truncated = authData.subarray(0, authData.length - 10); // chop off part of the declared credentialId
    expect(() => parseAuthData(truncated, true)).toThrow(
      'authData is too short to contain the declared credentialId.'
    );
  });

  test('parses a well-formed attestation authData, including credentialId slicing', () => {
    const credentialId = Buffer.alloc(32, 0xef);
    const authData = buildAttestationShapedAuthData(credentialId);
    const parsed = parseAuthData(authData, true);
    expect(parsed.credentialId.equals(credentialId)).toBe(true);
    expect(parsed.aaguid.equals(AAGUID_PROD)).toBe(true);
    expect(parsed.credentialPublicKeyCbor).toHaveLength(0); // nothing appended after credentialId in this fixture
  });
});

describe('isKnownAppAttestAaguid / isDevelopmentAaguid', () => {
  test('recognizes the production AAGUID', () => {
    expect(isKnownAppAttestAaguid(AAGUID_PROD)).toBe(true);
    expect(isDevelopmentAaguid(AAGUID_PROD)).toBe(false);
  });

  test('recognizes the development AAGUID', () => {
    expect(isKnownAppAttestAaguid(AAGUID_DEV)).toBe(true);
    expect(isDevelopmentAaguid(AAGUID_DEV)).toBe(true);
  });

  test('rejects an unrelated 16-byte buffer', () => {
    const bogus = Buffer.alloc(16, 0x99);
    expect(isKnownAppAttestAaguid(bogus)).toBe(false);
    expect(isDevelopmentAaguid(bogus)).toBe(false);
  });
});
