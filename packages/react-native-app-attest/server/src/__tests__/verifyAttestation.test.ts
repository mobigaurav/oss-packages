import { encode as cborEncode } from 'cbor';
import { verifyAttestation } from '../verifyAttestation';
import { generateSelfSignedRoot, generateSignedCert, certToDer, certToPem } from './testFixtures';

const ORIGINAL_ROOT_ENV = process.env.APPLE_APP_ATTEST_ROOT_CA_PEM;

afterEach(() => {
  process.env.APPLE_APP_ATTEST_ROOT_CA_PEM = ORIGINAL_ROOT_ENV;
});

function buildAttestationObjectBase64(x5c: Buffer[], authData: Buffer, fmt = 'apple-appattest'): string {
  const attestationObject = {
    fmt,
    attStmt: { x5c, receipt: Buffer.from('fake-receipt') },
    authData,
  };
  return cborEncode(attestationObject).toString('base64');
}

describe('verifyAttestation — root certificate configuration', () => {
  test('throws a clear error when APPLE_APP_ATTEST_ROOT_CA_PEM is not configured', async () => {
    delete process.env.APPLE_APP_ATTEST_ROOT_CA_PEM;
    await expect(
      verifyAttestation({
        attestationBase64: 'irrelevant',
        challengeBase64: 'irrelevant',
        keyId: 'irrelevant',
        teamId: 'TEAM123456',
        bundleId: 'com.example.app',
      })
    ).rejects.toThrow(/APPLE_APP_ATTEST_ROOT_CA_PEM is not configured/);
  });
});

describe('verifyAttestation — certificate chain verification (regression coverage)', () => {
  // This is the regression test for a real bug that shipped once: the chain check called
  // forge.pki.verifyCertificateChain(caStore, chain, () => true), and forge uses the
  // CALLBACK'S RETURN VALUE (not the actual check result) to decide pass/fail — so a
  // callback that always returns true silently accepted ANY chain, including a total
  // forgery unrelated to the configured root. These two tests pin the fixed behavior:
  // a forged/unrelated chain must be rejected, and a chain that genuinely signs up to the
  // configured root must be accepted (i.e. the fix isn't just "reject everything").

  test('rejects a certificate chain that does not terminate at the configured root', async () => {
    const attackerRoot = generateSelfSignedRoot('Attacker Root');
    const attackerIntermediate = generateSignedCert('Attacker Intermediate', attackerRoot, true);
    const attackerLeaf = generateSignedCert('Attacker Leaf', attackerIntermediate, false);

    const legitimateRoot = generateSelfSignedRoot('Legitimate Root (unrelated to attacker chain)');
    process.env.APPLE_APP_ATTEST_ROOT_CA_PEM = certToPem(legitimateRoot.cert);

    const attestationBase64 = buildAttestationObjectBase64(
      [certToDer(attackerLeaf.cert), certToDer(attackerIntermediate.cert)],
      Buffer.alloc(37)
    );

    await expect(
      verifyAttestation({
        attestationBase64,
        challengeBase64: Buffer.from('irrelevant-challenge').toString('base64'),
        keyId: 'irrelevant',
        teamId: 'TEAM123456',
        bundleId: 'com.example.app',
      })
    ).rejects.toThrow('Certificate chain did not verify against Apple App Attest root CA.');
  });

  test('accepts a certificate chain that DOES terminate at the configured root (and proceeds past the chain check to the next validation step)', async () => {
    const root = generateSelfSignedRoot('Test Root');
    const intermediate = generateSignedCert('Test Intermediate', root, true);
    const leaf = generateSignedCert('Test Leaf', intermediate, false);
    process.env.APPLE_APP_ATTEST_ROOT_CA_PEM = certToPem(root.cert);

    const attestationBase64 = buildAttestationObjectBase64(
      [certToDer(leaf.cert), certToDer(intermediate.cert)],
      Buffer.alloc(37)
    );

    // A valid chain should pass Step 1 and fail at Step 2 instead (this test leaf has no
    // App Attest nonce extension, since it isn't a real device-generated attestation) —
    // proving the chain check specifically is not rejecting a legitimately-signed chain.
    await expect(
      verifyAttestation({
        attestationBase64,
        challengeBase64: Buffer.from('irrelevant-challenge').toString('base64'),
        keyId: 'irrelevant',
        teamId: 'TEAM123456',
        bundleId: 'com.example.app',
      })
    ).rejects.toThrow('Leaf certificate is missing the App Attest nonce extension.');
  });
});

describe('verifyAttestation — input shape validation', () => {
  beforeEach(() => {
    process.env.APPLE_APP_ATTEST_ROOT_CA_PEM = certToPem(generateSelfSignedRoot('Unused Root').cert);
  });

  test('rejects an attestation object with the wrong fmt', async () => {
    const attestationBase64 = buildAttestationObjectBase64([Buffer.alloc(1)], Buffer.alloc(37), 'packed');
    await expect(
      verifyAttestation({
        attestationBase64,
        challengeBase64: 'irrelevant',
        keyId: 'irrelevant',
        teamId: 'TEAM123456',
        bundleId: 'com.example.app',
      })
    ).rejects.toThrow('Unexpected attestation format: packed');
  });

  test('rejects an attestation object missing the intermediate certificate in x5c', async () => {
    const leaf = generateSignedCert('Solo Leaf', generateSelfSignedRoot('Some Root'), false);
    const attestationBase64 = buildAttestationObjectBase64([certToDer(leaf.cert)], Buffer.alloc(37));
    await expect(
      verifyAttestation({
        attestationBase64,
        challengeBase64: 'irrelevant',
        keyId: 'irrelevant',
        teamId: 'TEAM123456',
        bundleId: 'com.example.app',
      })
    ).rejects.toThrow('Attestation is missing the expected x5c certificate chain');
  });
});
