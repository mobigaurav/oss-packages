/**
 * Apple's "Apple App Attestation Root CA" certificate, PEM-encoded.
 *
 * SECURITY NOTE: there is no bundled default — do not fabricate or guess this certificate's
 * bytes. Download the real one directly from Apple before deploying:
 *
 *   https://www.apple.com/certificateauthority/private/AppleAppAttestationRootCA.pem
 *   (linked from https://www.apple.com/certificateauthority/)
 *
 * Set it via the APPLE_APP_ATTEST_ROOT_CA_PEM environment variable (or a secrets manager
 * that populates that variable) in production. Read lazily (not cached in a top-level
 * const) so tests can point this at a locally-generated test root without needing to
 * reset the module registry between cases.
 */
export function getAppleAppAttestRootCaPem(): string {
  return process.env.APPLE_APP_ATTEST_ROOT_CA_PEM ?? '';
}

export function assertRootCertificateConfigured(): string {
  const pem = getAppleAppAttestRootCaPem();
  if (!pem.includes('BEGIN CERTIFICATE')) {
    throw new Error(
      'APPLE_APP_ATTEST_ROOT_CA_PEM is not configured. Download the real certificate from ' +
        'https://www.apple.com/certificateauthority/ and set it via the APPLE_APP_ATTEST_ROOT_CA_PEM ' +
        'environment variable before calling verifyAttestation().'
    );
  }
  return pem;
}
