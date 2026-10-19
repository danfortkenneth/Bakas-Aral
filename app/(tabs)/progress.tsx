import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, Dimensions, PixelRatio, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../_layout';
import { db, auth } from '../../lib/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375;
const normalize = (size: number) => Math.round(PixelRatio.roundToNearestPixel(size * scale));
const isTablet = SCREEN_WIDTH > 550;

interface CharacterStats {
  [key: string]: { accuracy: number; count: number; };
}

export default function ProgressScreen() {
  const { lang } = useLanguage();
  const days = lang === 'ph' ? ['Lin', 'Lun', 'Mar', 'Miy', 'Huw', 'Biy', 'Sab'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [activeStudentName, setActiveStudentName] = useState<string>('---');
  const [avgAccuracy, setAvgAccuracy] = useState<number>(0);
  const [totalSessions, setTotalSessions] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [charStats, setCharStats] = useState<CharacterStats>({});

  const availableItems = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', '1', '2', '3'];

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const teacherDocRef = doc(db, "users", currentUser.uid);
    const unsubscribeTeacher = onSnapshot(teacherDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentStudentId = data.activeStudentId || null;
        
        setActiveStudentId(currentStudentId);
        setActiveStudentName(data.activeStudentName || (lang === 'ph' ? 'Walang napiling bata' : 'No student selected'));

        if (currentStudentId) {
          const unsubscribeSessions = listenToStudentProgress(currentStudentId);
          return () => unsubscribeSessions();
        } else {
          setAvgAccuracy(0);
          setTotalSessions(0);
          setCharStats({});
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribeTeacher();
  }, [lang]);

  const listenToStudentProgress = (studentId: string) => {
    const sessionsQuery = query(collection(db, "sessions"), where("userId", "==", studentId));

    return onSnapshot(sessionsQuery, (querySnapshot) => {
      let totalAcc = 0;
      let count = 0;
      const tempCharStats: CharacterStats = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const char = data.letterOrNumber;
        const acc = data.accuracy;

        if (typeof acc === 'number') {
          totalAcc += acc;
          count++;

          if (!tempCharStats[char]) {
            tempCharStats[char] = { totalAcc: acc, count: 1 } as any;
          } else {
            (tempCharStats[char] as any).totalAcc += acc;
            tempCharStats[char].count += 1;
          }
        }
      });

      const finalizedStats: CharacterStats = {};
      Object.keys(tempCharStats).forEach((key) => {
        const item = tempCharStats[key] as any;
        finalizedStats[key] = {
          accuracy: Math.round(item.totalAcc / item.count),
          count: item.count
        };
      });

      setCharStats(finalizedStats);
      setAvgAccuracy(count > 0 ? Math.round(totalAcc / count) : 100);
      setTotalSessions(count);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.mainTitle}>
            {lang === 'ph' ? `Pag-unlad ni ${activeStudentName}` : `${activeStudentName}'s Progress`}
          </Text>
          <View style={styles.avatar}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: normalize(14) }}>
              {activeStudentName.charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* PERFORMANCE GRAPH CARD */}
        <View style={styles.chartCard}>
          <View style={styles.chartPlaceholder}>
            {loading ? <ActivityIndicator size="large" color="#F77F67" /> : (
              <View style={{ alignItems: 'center' }}>
                <Ionicons name="trending-up" size={normalize(35)} color="#4ADE80" />
                <Text style={styles.sessionCountText}>
                  {lang === 'ph' ? `${totalSessions} (na) sulat ang natapos` : `${totalSessions} tracing sessions completed`}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.chartDays}>
             {days.map((d, i) => <Text key={i} style={styles.dayLabel}>{d}</Text>)}
          </View>
        </View>

        {/* OVERALL STATUS CARD */}
        <View style={styles.sessionList}>
          <Text style={styles.sessionTitle}>{lang === 'ph' ? 'Pangkalahatang Estado' : 'Overall Status'}</Text>
          <View style={styles.sessionRow}>
            <View style={styles.sessionLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
                <MaterialCommunityIcons name="target" size={20} color="#22C55E" />
              </View>
              <View style={styles.sessionMeta}>
                <Text style={styles.sessionName}>{lang === 'ph' ? 'Katumpakan ng Pagsulat' : 'Tracing Accuracy'}</Text>
                <Text style={styles.sessionTime}>{lang === 'ph' ? 'Pangkalahatang average' : 'Overall running average'}</Text>
              </View>
            </View>
            {loading ? <ActivityIndicator size="small" color="#22C55E" /> : <Text style={styles.pointsText}>{avgAccuracy}%</Text>}
          </View>
        </View>

        {/* DETAILED BREAKDOWN LIST */}
        <View style={[styles.sessionList, { marginTop: 20 }]}>
          <Text style={styles.sessionTitle}>{lang === 'ph' ? 'Estado Kada Titik at Numero' : 'Per Letter & Number Status'}</Text>
          {loading ? <ActivityIndicator size="large" color="#F77F67" style={{ marginVertical: 20 }} /> : !activeStudentId ? (
            <Text style={styles.emptyText}>{lang === 'ph' ? 'Walang datos.' : 'No data available.'}</Text>
          ) : (
            availableItems.map((item) => {
              const stat = charStats[item];
              const hasPlayed = stat && stat.count > 0;
              return (
                <View key={item} style={styles.charRecordRow}>
                  <View style={styles.charLeft}>
                    <View style={[styles.charBox, hasPlayed ? styles.charBoxPlayed : styles.charBoxNew]}>
                      <Text style={[styles.charText, hasPlayed && { color: 'white' }]}>{item}</Text>
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.charLabelTitle}>{isNaN(item as any) ? (lang === 'ph' ? `Titik ${item}` : `Letter ${item}`) : (lang === 'ph' ? `Numero ${item}` : `Number ${item}`)}</Text>
                      <Text style={styles.charSubLabel}>{hasPlayed ? (lang === 'ph' ? `Nasubukan nang ${stat.count} beses` : `Attempted ${stat.count} times`) : (lang === 'ph' ? 'Hindi pa nasusubukan' : 'Not yet traced')}</Text>
                    </View>
                  </View>
                  <View style={[styles.badgeContainer, hasPlayed ? styles.badgeDone : styles.badgeLocked]}>
                    <Text style={[styles.badgeText, hasPlayed ? styles.badgeTextDone : styles.badgeTextLocked]}>
                      {hasPlayed ? `${stat.accuracy}%` : (lang === 'ph' ? 'BAGO' : 'NEW')}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB' },
  scrollContent: { paddingHorizontal: '6%', paddingTop: 20, paddingBottom: 110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  mainTitle: { fontSize: normalize(16), fontWeight: '900', color: '#333', flex: 1, marginRight: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F77F67', justifyContent: 'center', alignItems: 'center' },
  chartCard: { backgroundColor: 'white', borderRadius: 30, padding: 25, height: 210, marginBottom: 20, elevation: 2 },
  chartPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sessionCountText: { fontSize: normalize(12), fontWeight: '700', color: '#555', marginTop: 10, textAlign: 'center' },
  chartDays: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  dayLabel: { fontSize: 10, color: '#AAA', fontWeight: 'bold' },
  sessionList: { backgroundColor: 'white', borderRadius: 30, padding: 20 },
  sessionTitle: { fontSize: normalize(14), fontWeight: '900', color: '#333', marginBottom: 15 },
  sessionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  sessionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  sessionMeta: { flex: 1 },
  sessionName: { fontWeight: 'bold', fontSize: normalize(12), color: '#333' },
  sessionTime: { fontSize: normalize(10), color: '#AAA', marginTop: 2 },
  pointsText: { fontWeight: '900', fontSize: normalize(16), color: '#22C55E' },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginVertical: 10 },
  charRecordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  charLeft: { flexDirection: 'row', alignItems: 'center' },
  charBox: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  charBoxNew: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' },
  charBoxPlayed: { backgroundColor: '#F77F67' },
  charText: { fontSize: normalize(18), fontWeight: '900', color: '#D97706' },
  charLabelTitle: { fontWeight: 'bold', fontSize: normalize(13), color: '#333' },
  charSubLabel: { fontSize: normalize(10), color: '#9CA3AF', marginTop: 2 },
  badgeContainer: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeLocked: { backgroundColor: '#FEF3C7' },
  badgeDone: { backgroundColor: '#DCFCE7' },
  badgeText: { fontSize: normalize(10), fontWeight: '900' },
  badgeTextLocked: { color: '#B45309' },
  badgeTextDone: { color: '#16A34A' }
});