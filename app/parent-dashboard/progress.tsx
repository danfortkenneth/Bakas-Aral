import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ProgressReport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ accuracyScore: number; completionTime: string; activeAvatar: string } | null>(null);

  useEffect(() => {
    loadProgressData();
  }, []);

  const loadProgressData = async () => {
    try {
      const jsonValue = await AsyncStorage.getItem('@classroom_data');
      if (jsonValue != null) {
        setData(JSON.parse(jsonValue));
      }
    } catch (e) {
      console.log("Error loading local sync data.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Progress Report</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#F77F67" style={{ flex: 1 }} />
      ) : data ? (
        <View style={styles.content}>
          <View style={styles.avatarCard}>
            <Text style={{ fontSize: 50 }}>{data.activeAvatar.split(' ')[1] || '👶'}</Text>
            <Text style={styles.avatarTitle}>Active Class Avatar</Text>
            <Text style={styles.avatarName}>{data.activeAvatar}</Text>
          </View>

          <View style={styles.statRow}>
            <View style={[styles.statBox, { backgroundColor: '#E0FDEE' }]}>
              <Text style={styles.statLabel}>Accuracy Score</Text>
              <Text style={[styles.statValue, { color: '#10B981' }]}>{data.accuracyScore}%</Text>
            </View>

            <View style={[styles.statBox, { backgroundColor: '#EEF2FF' }]}>
              <Text style={styles.statLabel}>Completion Time</Text>
              <Text style={[styles.statValue, { color: '#4F46E5', fontSize: 16 }]}>{data.completionTime}</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 40 }}>📊</Text>
          <Text style={styles.emptyText}>No data available yet. Please scan a teacher's QR code first to see your child's progress.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  content: { flex: 1, paddingTop: 30 },
  avatarCard: { backgroundColor: 'white', borderRadius: 25, padding: 25, alignItems: 'center', elevation: 2, marginBottom: 20 },
  avatarTitle: { fontSize: 12, color: '#999', textTransform: 'uppercase', fontWeight: '700', marginTop: 10 },
  avatarName: { fontSize: 22, fontWeight: 'bold', color: '#333', marginTop: 5 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: { flex: 0.48, borderRadius: 22, padding: 20, elevation: 1 },
  statLabel: { fontSize: 12, color: '#666', fontWeight: '600' },
  statValue: { fontSize: 32, fontWeight: '900', marginTop: 10 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyText: { textAlign: 'center', color: '#777', marginTop: 15, lineHeight: 20 }
});