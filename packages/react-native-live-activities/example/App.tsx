import React, { useEffect, useState } from 'react';
import { Button, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import {
  areActivitiesEnabled,
  startActivity,
  updateActivity,
  endActivity,
  addPushTokenListener,
} from 'react-native-live-activities';

export default function App() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [activityId, setActivityId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0.1);

  useEffect(() => {
    areActivitiesEnabled().then(setEnabled);
    return addPushTokenListener((id, tokenHex) => {
      console.log(`Activity ${id} push token:`, tokenHex);
      // Send { activityId: id, pushTokenHex: tokenHex } to your backend so it can push
      // remote ContentState updates via APNs while the app is backgrounded/killed.
    });
  }, []);

  const start = async () => {
    const id = await startActivity('delivery-tracker', {
      title: 'Order #4471',
      subtitle: 'Preparing your order…',
      progress: 0.1,
      endDate: Date.now() + 30 * 60 * 1000, // 30-minute ETA
    });
    setActivityId(id);
  };

  const bumpProgress = async () => {
    if (!activityId) return;
    const next = Math.min(progress + 0.25, 1);
    setProgress(next);
    await updateActivity(activityId, {
      title: 'Order #4471',
      subtitle: next >= 1 ? 'Delivered!' : 'On its way…',
      progress: next,
      endDate: Date.now() + 30 * 60 * 1000,
    });
  };

  const finish = async () => {
    if (!activityId) return;
    await endActivity(activityId, {
      policy: 'default',
      finalState: { title: 'Order #4471', subtitle: 'Delivered!', progress: 1 },
    });
    setActivityId(null);
    setProgress(0.1);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>react-native-live-activities</Text>
      <Text>Live Activities enabled: {String(enabled)}</Text>
      <Text>Active activity: {activityId ?? 'none'}</Text>
      <View style={styles.spacer} />
      <Button title="Start Live Activity" onPress={start} disabled={!!activityId} />
      <View style={styles.spacer} />
      <Button title="Bump Progress" onPress={bumpProgress} disabled={!activityId} />
      <View style={styles.spacer} />
      <Button title="End Activity" onPress={finish} disabled={!activityId} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  spacer: { height: 12 },
});
