import React, { useEffect, useState } from 'react';
import { Button, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  isHealthDataAvailable,
  requestAuthorization,
  queryQuantitySamples,
  observeQuantityType,
  type HKQuantitySample,
} from 'react-native-healthkit-modern';

export default function App() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [samples, setSamples] = useState<HKQuantitySample[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('never');

  useEffect(() => {
    isHealthDataAvailable().then(setAvailable);
  }, []);

  useEffect(() => {
    // Live-updates whenever new step data lands in Health, including while backgrounded.
    return observeQuantityType('stepCount', () => {
      setLastUpdate(new Date().toLocaleTimeString());
      loadSteps();
    });
  }, []);

  const requestAccess = async () => {
    await requestAuthorization({
      read: ['stepCount', 'heartRate', 'activeEnergyBurned'],
      write: [],
    });
    loadSteps();
  };

  const loadSteps = async () => {
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const result = await queryQuantitySamples('stepCount', {
      startDate: oneWeekAgo,
      endDate: now,
      limit: 20,
      ascending: false,
    });
    setSamples(result);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>react-native-healthkit-modern</Text>
        <Text>Health data available: {String(available)}</Text>
        <View style={styles.spacer} />
        <Button title="Request HealthKit Authorization" onPress={requestAccess} />
        <View style={styles.spacer} />
        <Button title="Reload Step Samples" onPress={loadSteps} />
        <Text style={styles.subtitle}>Last background update: {lastUpdate}</Text>
        <View style={styles.spacer} />
        <Text style={styles.subtitle}>Recent step samples ({samples.length})</Text>
        {samples.map((s) => (
          <Text key={s.uuid}>
            {new Date(s.startDate).toLocaleString()} — {s.value} steps ({s.sourceName})
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  subtitle: { fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 4 },
  spacer: { height: 12 },
});
