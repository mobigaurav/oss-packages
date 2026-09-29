import * as crypto from 'crypto';
import { encode as cborEncode } from 'cbor';
import { verifyAssertion } from '../verifyAssertion';

const TEAM_ID = 'TEAM123456';
const BUNDLE_ID = 'com.example.app';

function buildAuthenticatorData(teamId: string, bundleId: string, signCount: number): Buffer {
  const rpIdHash = crypto.createHash('sha256').update(`${teamId}.${bundleId}`).digest();
  const flags = Buffer.from([0x00]);
  const signCountBuf = Buffer.alloc(4);
  signCountBuf.writeUInt32BE(signCount, 0);
  return Buffer.concat([rpIdHash, flags, signCountBuf]);
}

function buildAssertionBase64(privateKey: crypto.KeyObject, authenticatorData: Buffer, clientDataHash: Buffer): string {
  const nonce = crypto.createHash('sha256').update(Buffer.concat([authenticatorData, clientDataHash])).digest();
  const signature = crypto.sign('sha256', nonce, privateKey);
  return cborEncode({ signature, authenticatorData }).toString('base64');
}

describe('verifyAssertion', () => {
  let publicKeyJwk: crypto.JsonWebKey;
  let privateKey: crypto.KeyObject;

  beforeAll(() => {
    const { publicKey, privateKey: priv } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    privateKey = priv;
    publicKeyJwk = publicKey.export({ format: 'jwk' }) as crypto.JsonWebKey;
  });

  test('accepts a validly-signed assertion with an incremented signCount', () => {
    const clientDataHash = crypto.createHash('sha256').update('request-body-v1').digest();
    const authenticatorData = buildAuthenticatorData(TEAM_ID, BUNDLE_ID, 1);
    const assertionBase64 = buildAssertionBase64(privateKey, authenticatorData, clientDataHash);

    const result = verifyAssertion({
      assertionBase64,
      clientDataHashBase64: clientDataHash.toString('base64'),
      storedPublicKeyJwk: publicKeyJwk,
      storedSignCount: 0,
      teamId: TEAM_ID,
      bundleId: BUNDLE_ID,
    });

    expect(result.newSignCount).toBe(1);
  });

  test('rejects a signature produced over a different clientDataHash than the one being verified (tamper/replay-against-different-request attempt)', () => {
    const realClientDataHash = crypto.createHash('sha256').update('real-request-body').digest();
    const differentClientDataHash = crypto.createHash('sha256').update('attacker-substituted-body').digest();
    const authenticatorData = buildAuthenticatorData(TEAM_ID, BUNDLE_ID, 1);
    // Client legitimately signed `differentClientDataHash`, but we (the server) recomputed
    // `realClientDataHash` from the actual request body — these must not match.
    const assertionBase64 = buildAssertionBase64(privateKey, authenticatorData, differentClientDataHash);

    expect(() =>
      verifyAssertion({
        assertionBase64,
        clientDataHashBase64: realClientDataHash.toString('base64'),
        storedPublicKeyJwk: publicKeyJwk,
        storedSignCount: 0,
        teamId: TEAM_ID,
        bundleId: BUNDLE_ID,
      })
    ).toThrow('Assertion signature does not verify against the stored public key.');
  });

  test('rejects a signature made with a different key than the one on file (cloned/substituted key attempt)', () => {
    const { privateKey: attackerKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const clientDataHash = crypto.createHash('sha256').update('request-body').digest();
    const authenticatorData = buildAuthenticatorData(TEAM_ID, BUNDLE_ID, 1);
    const assertionBase64 = buildAssertionBase64(attackerKey, authenticatorData, clientDataHash);

    expect(() =>
      verifyAssertion({
        assertionBase64,
        clientDataHashBase64: clientDataHash.toString('base64'),
        storedPublicKeyJwk: publicKeyJwk, // the legitimate device's key, not the attacker's
        storedSignCount: 0,
        teamId: TEAM_ID,
        bundleId: BUNDLE_ID,
      })
    ).toThrow('Assertion signature does not verify against the stored public key.');
  });

  test('rejects a non-increasing signCount (replay of a previously-used assertion)', () => {
    const clientDataHash = crypto.createHash('sha256').update('request-body').digest();
    const authenticatorData = buildAuthenticatorData(TEAM_ID, BUNDLE_ID, 5);
    const assertionBase64 = buildAssertionBase64(privateKey, authenticatorData, clientDataHash);

    expect(() =>
      verifyAssertion({
        assertionBase64,
        clientDataHashBase64: clientDataHash.toString('base64'),
        storedPublicKeyJwk: publicKeyJwk,
        storedSignCount: 5, // equal, not less than — must still be rejected
        teamId: TEAM_ID,
        bundleId: BUNDLE_ID,
      })
    ).toThrow(/signCount did not increase/);
  });

  test('rejects a mismatched rpIdHash (wrong team/bundle id)', () => {
    const clientDataHash = crypto.createHash('sha256').update('request-body').digest();
    const authenticatorData = buildAuthenticatorData(TEAM_ID, BUNDLE_ID, 1);
    const assertionBase64 = buildAssertionBase64(privateKey, authenticatorData, clientDataHash);

    expect(() =>
      verifyAssertion({
        assertionBase64,
        clientDataHashBase64: clientDataHash.toString('base64'),
        storedPublicKeyJwk: publicKeyJwk,
        storedSignCount: 0,
        teamId: 'SOME-OTHER-TEAM',
        bundleId: BUNDLE_ID,
      })
    ).toThrow('rpIdHash does not match this app.');
  });
});
