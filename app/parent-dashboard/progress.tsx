import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, Dimensions, PixelRatio, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../_layout';
import { db, auth } from '../../lib/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375;
const normalize = (size: number) => Math.round(PixelRatio.roundToNearestPixel(size * scale));

interface CharacterStats {
  [key: string]: { accuracy: number; count: number; };
}

interface DayActivity {
  dayLabel: string;
  count: number;
}

export default function ProgressScreen() {
  const { lang } = useLanguage();
  const dayNames = lang === 'ph' 
    ? ['Lin', 'Lun', 'Mar', 'Miy', 'Huw', 'Biy', 'Sab'] 
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [activeStudentName, setActiveStudentName] = useState<string>('---');
  const [avgAccuracy, setAvgAccuracy] = useState<number>(0);
  const [totalSessions, setTotalSessions] = useState<number>(0);
  const [totalStars, setTotalStars] = useState<number>(0);
  const [totalDurationSeconds, setTotalDurationSeconds] = useState<number>(0);
  const [weeklyData, setWeeklyData] = useState<DayActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [charStats, setCharStats] = useState<CharacterStats>({});

  const availableItems = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'
  ];

  useEffect(() => {
    let unsubscribeTeacher: () => void = () => {};
    let unsubscribeSessions: () => void = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setActiveStudentId(null);
        setActiveStudentName(lang === 'ph' ? 'Walang napiling bata' : 'No student selected');
        setAvgAccuracy(0);
        setTotalSessions(0);
        setTotalStars(0);
        setTotalDurationSeconds(0);
        setCharStats({});
        setWeeklyData(dayNames.map(d => ({ dayLabel: d, count: 0 })));
        setLoading(false);
        return;
      }

      setLoading(true);

      const teacherDocRef = doc(db, "users", currentUser.uid);
      unsubscribeTeacher = onSnapshot(teacherDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const currentStudentId = data.activeStudentId || null;
          
          setActiveStudentId(currentStudentId);
          setActiveStudentName(data.activeStudentName || (lang === 'ph' ? 'Walang napiling bata' : 'No student selected'));

          if (currentStudentId) {
            if (unsubscribeSessions) unsubscribeSessions();
            unsubscribeSessions = listenToStudentProgress(currentStudentId);
          } else {
            setAvgAccuracy(0);
            setTotalSessions(0);
            setTotalStars(0);
            setTotalDurationSeconds(0);
            setCharStats({});
            setWeeklyData(dayNames.map(d => ({ dayLabel: d, count: 0 })));
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      }, (err) => {
        console.warn("Teacher document error:", err.message);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      unsubscribeTeacher();
      unsubscribeSessions();
    };
  }, [lang]);

  const listenToStudentProgress = (studentId: string) => {
    const sessionsQuery = query(collection(db, "sessions"), where("userId", "==", studentId));

    return onSnapshot(sessionsQuery, (querySnapshot) => {
      let totalAcc = 0;
      let count = 0;
      let stars = 0;
      let durationSum = 0;
      const tempCharStats: CharacterStats = {};
      const dayCounts: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const char = data.letterOrNumber;
        const acc = data.accuracy;
        const dur = data.durationSeconds || data.duration || 0;
        const timestamp = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();

        if (typeof acc === 'number') {
          totalAcc += acc;
          count++;
          
          // Bituin / Stars computation
          if (acc >= 85) stars += 3;
          else if (acc >= 70) stars += 2;
          else if (acc >= 50) stars += 1;

          // Duration accumulation (in seconds)
          if (typeof dur === 'number') {
            durationSum += dur;
          } else if (typeof dur === 'string') {
            const parsedDur = parseInt(dur.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(parsedDur)) durationSum += parsedDur;
          }

          // Day of week
          const dayOfWeek = timestamp.getDay();
          dayCounts[dayOfWeek] = (dayCounts[dayOfWeek] || 0) + 1;

          if (char) {
            if (!tempCharStats[char]) {
              tempCharStats[char] = { totalAcc: acc, count: 1 } as any;
            } else {
              (tempCharStats[char] as any).totalAcc += acc;
              tempCharStats[char].count += 1;
            }
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

      const formattedWeekly: DayActivity[] = dayNames.map((name, index) => ({
        dayLabel: name,
        count: dayCounts[index] || 0
      }));

      setWeeklyData(formattedWeekly);
      setCharStats(finalizedStats);
      setAvgAccuracy(count > 0 ? Math.round(totalAcc / count) : 0);
      setTotalSessions(count);
      setTotalStars(stars);
      setTotalDurationSeconds(durationSum);
      setLoading(false);
    }, (error) => {
      console.warn("Student progress error:", error.message);
      setLoading(false);
    });
  };

  // Helper para i-format ang segundo sa mins o hrs
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = (mins / 60).toFixed(1);
    return `${hrs}h`;
  };

  // Helper para sa Color-Coded Mastery Status
  const getMasteryBadge = (accuracy: number, hasPlayed: boolean) => {
    if (!hasPlayed) {
      return {
        label: lang === 'ph' ? 'HINDI PA NASISIMULAN' : 'NOT STARTED',
        bg: '#F3F4F6',
        color: '#6B7280'
      };
    }
    if (accuracy >= 85) {
      return {
        label: lang === 'ph' ? 'NASANAY NA' : 'MASTERED',
        bg: '#DCFCE7',
        color: '#15803D'
      };
    }
    return {
      label: lang === 'ph' ? 'NAGSASANAY' : 'PRACTICING',
      bg: '#FEF3C7',
      color: '#B45309'
    };
  };

  const maxWeeklyCount = Math.max(...weeklyData.map(d => d.count), 1);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.subTitle}>{lang === 'ph' ? 'Ulat sa Pag-unlad' : 'Progress Report'}</Text>
            <Text style={styles.mainTitle}>{activeStudentName}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: normalize(16) }}>
              {activeStudentName.charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* METRICS & BADGES GRID */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="star" size={20} color="#D97706" />
            <Text style={styles.statNumber}>{totalStars}</Text>
            <Text style={styles.statLabel}>{lang === 'ph' ? 'Bituin' : 'Stars'}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#E0F2FE' }]}>
            <Ionicons name="time" size={20} color="#0284C7" />
            <Text style={styles.statNumber}>{formatDuration(totalDurationSeconds)}</Text>
            <Text style={styles.statLabel}>{lang === 'ph' ? 'Oras ng Sanay' : 'Practice Time'}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#F3E8FF' }]}>
            <Ionicons name="pencil" size={20} color="#7E22CE" />
            <Text style={styles.statNumber}>{totalSessions}</Text>
            <Text style={styles.statLabel}>{lang === 'ph' ? 'Naisulat' : 'Traces'}</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: '#DCFCE7' }]}>
            <MaterialCommunityIcons name="target" size={20} color="#16A34A" />
            <Text style={styles.statNumber}>{avgAccuracy}%</Text>
            <Text style={styles.statLabel}>{lang === 'ph' ? 'Katumpakan' : 'Accuracy'}</Text>
          </View>
        </View>

        {/* REAL WEEKLY ACTIVITY CHART */}
        <View style={styles.chartCard}>
          <Text style={styles.sectionTitle}>
            {lang === 'ph' ? 'Aktibidad ngayong Linggo' : 'Weekly Tracing Activity'}
          </Text>
          
          {loading ? (
            <ActivityIndicator size="large" color="#F77F67" style={{ marginVertical: 30 }} />
          ) : (
            <View style={styles.barChartContainer}>
              {weeklyData.map((d, i) => {
                const heightPercent = (d.count / maxWeeklyCount) * 100;
                return (
                  <View key={i} style={styles.barColumn}>
                    <Text style={styles.barValueText}>{d.count > 0 ? d.count : ''}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: `${Math.max(heightPercent, d.count > 0 ? 12 : 4)}%` }]} />
                    </View>
                    <Text style={styles.dayLabel}>{d.dayLabel}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* DETAILED BREAKDOWN WITH COLOR-CODED MASTERY */}
        <View style={styles.sessionList}>
          <Text style={styles.sectionTitle}>
            {lang === 'ph' ? 'Antas ng Pagkakatuto Kada Karakter' : 'Character Mastery Breakdown'}
          </Text>
          
          {loading ? (
            <ActivityIndicator size="large" color="#F77F67" style={{ marginVertical: 20 }} />
          ) : !activeStudentId ? (
            <Text style={styles.emptyText}>{lang === 'ph' ? 'Pumili muna ng mag-aaral.' : 'Please select a student first.'}</Text>
          ) : (
            availableItems.map((item) => {
              const stat = charStats[item];
              const hasPlayed = !!(stat && stat.count > 0);
              const accuracy = hasPlayed ? stat.accuracy : 0;
              const badge = getMasteryBadge(accuracy, hasPlayed);

              return (
                <View key={item} style={styles.charRecordRow}>
                  <View style={styles.charLeft}>
                    <View style={[styles.charBox, hasPlayed ? styles.charBoxPlayed : styles.charBoxNew]}>
                      <Text style={[styles.charText, hasPlayed && { color: 'white' }]}>{item}</Text>
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.charLabelTitle}>
                        {isNaN(item as any) 
                          ? (lang === 'ph' ? `Titik ${item}` : `Letter ${item}`) 
                          : (lang === 'ph' ? `Numero ${item}` : `Number ${item}`)}
                      </Text>
                      <Text style={styles.charSubLabel}>
                        {hasPlayed 
                          ? (lang === 'ph' ? `Naisulat: ${stat.count}x (${accuracy}% acc)` : `Traced: ${stat.count}x (${accuracy}% acc)`) 
                          : (lang === 'ph' ? 'Wala pang record' : 'No records yet')}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.badgeContainer, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.badgeText, { color: badge.color }]}>
                      {badge.label}
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
  scrollContent: { paddingHorizontal: '5%', paddingTop: 20, paddingBottom: 110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  subTitle: { fontSize: normalize(11), color: '#78716C', fontWeight: '700', textTransform: 'uppercase' },
  mainTitle: { fontSize: normalize(18), fontWeight: '900', color: '#1C1917' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F77F67', justifyContent: 'center', alignItems: 'center' },
  
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 15 },
  statBox: { width: '48%', borderRadius: 18, padding: 12, alignItems: 'center', marginBottom: 10, elevation: 1 },
  statNumber: { fontSize: normalize(15), fontWeight: '900', color: '#1C1917', marginVertical: 2 },
  statLabel: { fontSize: normalize(10), color: '#57534E', fontWeight: '700' },

  chartCard: { backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 15, elevation: 1 },
  sectionTitle: { fontSize: normalize(13), fontWeight: '800', color: '#292524', marginBottom: 12 },
  barChartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, paddingTop: 10 },
  barColumn: { alignItems: 'center', flex: 1 },
  barValueText: { fontSize: normalize(9), fontWeight: '700', color: '#78716C', marginBottom: 4 },
  barTrack: { height: 75, width: 14, backgroundColor: '#F5F5F4', borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: '#F77F67', borderRadius: 7 },
  dayLabel: { fontSize: 10, color: '#A8A29E', fontWeight: '700', marginTop: 6 },

  sessionList: { backgroundColor: 'white', borderRadius: 24, padding: 20 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginVertical: 15 },
  charRecordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F4' },
  charLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  charBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  charBoxNew: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  charBoxPlayed: { backgroundColor: '#F77F67' },
  charText: { fontSize: normalize(16), fontWeight: '900', color: '#9CA3AF' },
  charLabelTitle: { fontWeight: 'bold', fontSize: normalize(12), color: '#292524' },
  charSubLabel: { fontSize: normalize(10), color: '#A8A29E', marginTop: 1 },
  badgeContainer: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: normalize(9), fontWeight: '900' }
});