import React, { useState } from 'react';
import { Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { isSupported, generateKey, attestKey, generateAssertion } from 'react-native-app-attest';

// In a real app, fetch this from your own backend — never generate the challenge on-device.
async function fetchChallengeFromServer(): Promise<string> {
  const res = await fetch('https://your-api.example.com/attest/challenge');
  const { challengeBase64 } = await res.json();
  return challengeBase64;
}

export default function App() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [keyId, setKeyId] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const appendLog = (line: string) => setLog((prev) => [line, ...prev].slice(0, 20));

  const checkSupport = async () => {
    const s = await isSupported();
    setSupported(s);
    appendLog(`isSupported() → ${s}`);
  };

  const runAttestation = async () => {
    const newKeyId = await generateKey();
    setKeyId(newKeyId);
    appendLog(`generateKey() → ${newKeyId}`);

    const challengeBase64 = await fetchChallengeFromServer();
    const attestationBase64 = await attestKey(newKeyId, challengeBase64);
    appendLog(`attestKey() → ${attestationBase64.slice(0, 24)}… (${attestationBase64.length} chars)`);

    // POST { keyId: newKeyId, attestationBase64, challengeBase64 } to your server's
    // /attest/verify endpoint, which calls verifyAttestation() from the server package.
    appendLog('Send keyId + attestationBase64 + challengeBase64 to your backend to verify.');
  };

  const runAssertion = async () => {
    if (!keyId) {
      appendLog('Run attestation first.');
      return;
    }
    // NOTE: `Buffer` is a Node.js global and is NOT available in React Native by default
    // (Hermes/Metro don't polyfill it). In a real app, compute clientDataHash as
    // base64(SHA-256(requestBody)) using a crypto library that actually runs on-device, e.g.
    // `expo-crypto`'s digestStringAsync(), `react-native-quick-crypto`, or `crypto-js`. This
    // demo hardcodes a fixed base64 value purely so the example runs with zero extra dependencies.
    const fakeClientDataHash = 'ZXhhbXBsZS1yZXF1ZXN0LWJvZHktaGFzaA==';
    const assertionBase64 = await generateAssertion(keyId, fakeClientDataHash);
    appendLog(`generateAssertion() → ${assertionBase64.slice(0, 24)}… (${assertionBase64.length} chars)`);
    appendLog('Send this assertion + the original request body to your backend to verify per-request.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>react-native-app-attest</Text>
      <Text>Supported: {String(supported)}</Text>
      <View style={styles.spacer} />
      <Button title="Check isSupported()" onPress={checkSupport} />
      <View style={styles.spacer} />
      <Button title="Run Attestation (generateKey + attestKey)" onPress={runAttestation} />
      <View style={styles.spacer} />
      <Button title="Run Assertion (generateAssertion)" onPress={runAssertion} />
      <View style={styles.spacer} />
      {log.map((line, i) => (
        <Text key={i} style={styles.logLine}>{line}</Text>
      ))}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  spacer: { height: 12 },
  logLine: { fontSize: 12, fontFamily: 'Courier', marginTop: 4 },
});
