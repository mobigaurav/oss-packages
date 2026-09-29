import * as forge from 'node-forge';

/**
 * Test-only helpers for building X.509 certificate chains with node-forge.
 *
 * These use RSA keys (forge's well-supported keypair API) rather than the P-256 keys real
 * App Attest uses — that's fine for the tests that use them, because certificate CHAIN
 * verification (signature-chains-to-a-trusted-root) is independent of the leaf's key
 * algorithm. Tests that need a real EC keypair (the assertion-signing path) use Node's
 * built-in `crypto.generateKeyPairSync('ec', ...)` directly instead — see verifyAssertion.test.ts.
 */

export interface GeneratedCert {
  cert: forge.pki.Certificate;
  keys: forge.pki.rsa.KeyPair;
}

export function generateSelfSignedRoot(commonName: string): GeneratedCert {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  const attrs = [{ name: 'commonName', value: commonName }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([{ name: 'basicConstraints', cA: true }]);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert, keys };
}

export function generateSignedCert(
  commonName: string,
  issuer: GeneratedCert,
  isCa: boolean
): GeneratedCert {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '02';
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  cert.setSubject([{ name: 'commonName', value: commonName }]);
  cert.setIssuer(issuer.cert.subject.attributes);
  cert.setExtensions([{ name: 'basicConstraints', cA: isCa }]);
  cert.sign(issuer.keys.privateKey, forge.md.sha256.create());
  return { cert, keys };
}

export function certToDer(cert: forge.pki.Certificate): Buffer {
  const derBinaryString = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  return Buffer.from(derBinaryString, 'binary');
}

export function certToPem(cert: forge.pki.Certificate): string {
  return forge.pki.certificateToPem(cert);
}
