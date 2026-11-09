import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, SafeAreaView, Dimensions, PixelRatio, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../_layout';
import { db, auth } from '../../lib/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { loadParentSync } from '../../lib/parentSync';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375;
const normalize = (size: number) => Math.round(PixelRatio.roundToNearestPixel(size * scale));

interface CharacterStats {
  [key: string]: { accuracy: number; count: number; totalDuration: number; };
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
  const [totalDurationSeconds, setTotalDurationSeconds] = useState<number>(0);
  const [totalStars, setTotalStars] = useState<number>(0);
  const [unlockedStickersList, setUnlockedStickersList] = useState<string[]>([]);
  const [weeklyData, setWeeklyData] = useState<DayActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [charStats, setCharStats] = useState<CharacterStats>({});

  // Smart Analytics States
  const [bestChar, setBestChar] = useState<{ char: string; acc: number } | null>(null);
  const [weakChar, setWeakChar] = useState<{ char: string; acc: number } | null>(null);
  const [nextRecommended, setNextRecommended] = useState<string | null>(null);

  const availableItems = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'
  ];

  const totalMaxStickers = 10;

  useEffect(() => {
    let unsubscribeTeacher: () => void = () => {};
    let unsubscribeSessions: () => void = () => {};

    // 🎨 Load Offline Stickers synced via QR Scanner
    async function fetchLocalStickers() {
      try {
        const localData = await loadParentSync();
        if (localData.stickers) {
          setUnlockedStickersList(localData.stickers);
        }
      } catch (e) {
        console.warn("Error loading local stickers:", e);
      }
    }
    fetchLocalStickers();

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        setActiveStudentId(null);
        setActiveStudentName(lang === 'ph' ? 'Walang napiling bata' : 'No student selected');
        setAvgAccuracy(0);
        setTotalSessions(0);
        setTotalDurationSeconds(0);
        setTotalStars(0);
        setCharStats({});
        setBestChar(null);
        setWeakChar(null);
        setNextRecommended(null);
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
            setTotalDurationSeconds(0);
            setTotalStars(0);
            setCharStats({});
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
      let totalSecondsSum = 0;
      let computedStars = 0;
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

          if (acc >= 85) computedStars += 3;
          else if (acc >= 70) computedStars += 2;
          else if (acc >= 50) computedStars += 1;

          let parsedSec = 0;
          if (typeof dur === 'number') {
            parsedSec = dur;
          } else if (typeof dur === 'string') {
            parsedSec = parseInt(dur.replace(/[^0-9]/g, ''), 10) || 0;
          }
          totalSecondsSum += parsedSec;

          const dayOfWeek = timestamp.getDay();
          dayCounts[dayOfWeek] = (dayCounts[dayOfWeek] || 0) + 1;

          if (char) {
            if (!tempCharStats[char]) {
              tempCharStats[char] = { totalAcc: acc, count: 1, totalDuration: parsedSec };
            } else {
              tempCharStats[char].totalAcc += acc;
              tempCharStats[char].count += 1;
              tempCharStats[char].totalDuration += parsedSec;
            }
          }
        }
      });

      const finalizedStats: CharacterStats = {};
      let highestAcc = -1;
      let lowestAcc = 101;
      let topItem: { char: string; acc: number } | null = null;
      let bottomItem: { char: string; acc: number } | null = null;

      Object.keys(tempCharStats).forEach((key) => {
        const item = tempCharStats[key];
        const calcAcc = Math.round(item.totalAcc / item.count);
        finalizedStats[key] = {
          accuracy: calcAcc,
          count: item.count,
          totalDuration: item.totalDuration
        };

        if (calcAcc > highestAcc) {
          highestAcc = calcAcc;
          topItem = { char: key, acc: calcAcc };
        }
        if (calcAcc < lowestAcc) {
          lowestAcc = calcAcc;
          bottomItem = { char: key, acc: calcAcc };
        }
      });

      const unattempted = availableItems.find(item => !finalizedStats[item]);

      const formattedWeekly: DayActivity[] = dayNames.map((name, index) => ({
        dayLabel: name,
        count: dayCounts[index] || 0
      }));

      setWeeklyData(formattedWeekly);
      setCharStats(finalizedStats);
      setBestChar(topItem);
      setWeakChar(bottomItem);
      setNextRecommended(unattempted || null);
      setAvgAccuracy(count > 0 ? Math.round(totalAcc / count) : 100);
      setTotalSessions(count);
      setTotalDurationSeconds(totalSecondsSum);
      setTotalStars(computedStars);
      setLoading(false);
    }, (error) => {
      console.warn("Student progress error:", error.message);
      setLoading(false);
    });
  };

  const formatTime = (totalSec: number) => {
    if (totalSec <= 0) return '0s';
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const maxWeeklyCount = Math.max(...weeklyData.map(d => d.count), 1);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={styles.subTitle}>{lang === 'ph' ? 'Ulat sa Pag-unlad' : 'Progress Report'}</Text>
            <Text style={styles.mainTitle}>
              {lang === 'ph' ? `Mag-aaral: ${activeStudentName}` : `${activeStudentName}'s Dashboard`}
            </Text>
          </View>
          <View style={styles.avatar}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: normalize(14) }}>
              {activeStudentName.charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>

        {/* 🎁 FEATURE 3: REWARD SUMMARY BANNER */}
        {activeStudentId && !loading && (
          <View style={styles.rewardCard}>
            <View style={styles.rewardRow}>
              <View style={styles.rewardItem}>
                <Ionicons name="star" size={26} color="#F59E0B" />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.rewardCount}>{totalStars}</Text>
                  <Text style={styles.rewardLabel}>{lang === 'ph' ? 'Bituin na Nakuha' : 'Stars Earned'}</Text>
                </View>
              </View>

              <View style={styles.rewardDivider} />

              <View style={styles.rewardItem}>
                <MaterialCommunityIcons name="sticker-emoji" size={26} color="#8B5CF6" />
                <View style={{ marginLeft: 8 }}>
                  <Text style={styles.rewardCount}>{unlockedStickersList.length}</Text>
                  <Text style={styles.rewardLabel}>{lang === 'ph' ? 'Sticker Na-collect' : 'Stickers Collected'}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 🎨 STICKER COLLECTION DISPLAY IN DASHBOARD */}
        {activeStudentId && !loading && (
          <View style={styles.stickerGalleryCard}>
            <Text style={styles.cardHeaderTitle}>
              {lang === 'ph' ? `Koleksyon ng Sticker ni ${activeStudentName}` : `${activeStudentName}'s Sticker Collection`}
            </Text>
            
            {unlockedStickersList.length === 0 ? (
              <View style={styles.emptyStickerBox}>
                <Text style={{ fontSize: 30 }}>🎨</Text>
                <Text style={styles.emptyStickerText}>
                  {lang === 'ph' 
                    ? 'Wala pang na-sync na sticker. I-scan ang QR code mula sa app ng bata!' 
                    : 'No stickers synced yet. Scan the QR code from child\'s app!'}
                </Text>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {unlockedStickersList.map((stickerName, idx) => (
                  <View key={idx} style={styles.stickerItem}>
                    <View style={styles.stickerIconCircle}>
                      <Text style={{ fontSize: 26 }}>🏅</Text>
                    </View>
                    <Text numberOfLines={1} style={styles.stickerNameText}>{stickerName}</Text>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        )}

        {/* 💡 FEATURE 1: SMART LEARNING INSIGHTS & RECOMMENDATIONS */}
        {activeStudentId && !loading && (
          <View style={styles.insightsCard}>
            <View style={styles.insightsHeader}>
              <Ionicons name="sparkles" size={20} color="#F59E0B" />
              <Text style={styles.insightsTitle}>
                {lang === 'ph' ? 'Smart Recomendasyon & Analytics' : 'Smart Learning Insights'}
              </Text>
            </View>

            {nextRecommended && (
              <View style={[styles.insightRow, { backgroundColor: '#EFF6FF' }]}>
                <Ionicons name="arrow-forward-circle" size={22} color="#3B82F6" />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.insightLabel}>
                    {lang === 'ph' ? 'Susunod na Aralin' : 'Suggested Next Lesson'}
                  </Text>
                  <Text style={styles.insightValue}>
                    {lang === 'ph' ? `Subukang i-trace ang Karakter ${nextRecommended}` : `Try tracing Item ${nextRecommended} next`}
                  </Text>
                </View>
              </View>
            )}

            {weakChar && weakChar.acc < 85 && (
              <View style={[styles.insightRow, { backgroundColor: '#FEF2F2', marginTop: 8 }]}>
                <Ionicons name="warning" size={22} color="#EF4444" />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={[styles.insightLabel, { color: '#B91C1C' }]}>
                    {lang === 'ph' ? 'Kailangan ng Pagsasanay' : 'Needs Practice'}
                  </Text>
                  <Text style={styles.insightValue}>
                    {lang === 'ph' ? `Ulitin ang Karakter ${weakChar.char} (${weakChar.acc}% accuracy)` : `Re-trace Item ${weakChar.char} (${weakChar.acc}% accuracy)`}
                  </Text>
                </View>
              </View>
            )}

            {bestChar && (
              <View style={[styles.insightRow, { backgroundColor: '#ECFDF5', marginTop: 8 }]}>
                <Ionicons name="trophy" size={22} color="#10B981" />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={[styles.insightLabel, { color: '#047857' }]}>
                    {lang === 'ph' ? 'Pinakamahusay' : 'Top Mastered'}
                  </Text>
                  <Text style={styles.insightValue}>
                    {lang === 'ph' ? `Magaling sa Karakter ${bestChar.char} (${bestChar.acc}% accuracy)` : `Excellent in Item ${bestChar.char} (${bestChar.acc}% accuracy)`}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* ⏱️ FEATURE 2: DURATION & OVERALL METRICS CARDS */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="time" size={22} color="#3B82F6" />
            <Text style={styles.metricValue}>{formatTime(totalDurationSeconds)}</Text>
            <Text style={styles.metricLabel}>{lang === 'ph' ? 'Oras ng Pagsasanay' : 'Total Practice Time'}</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: '#ECFDF5' }]}>
            <MaterialCommunityIcons name="target" size={22} color="#10B981" />
            <Text style={styles.metricValue}>{avgAccuracy}%</Text>
            <Text style={styles.metricLabel}>{lang === 'ph' ? 'Katumpakan' : 'Overall Accuracy'}</Text>
          </View>
        </View>

        {/* WEEKLY ACTIVITY GRAPH CARD */}
        <View style={styles.chartCard}>
          <Text style={styles.cardHeaderTitle}>
            {lang === 'ph' ? 'Aktibidad sa Pagsulat' : 'Weekly Tracing Activity'}
          </Text>
          {loading ? <ActivityIndicator size="large" color="#F77F67" /> : (
            <View style={styles.barChartContainer}>
              {weeklyData.map((d, i) => {
                const heightPercent = (d.count / maxWeeklyCount) * 100;
                return (
                  <View key={i} style={styles.barColumn}>
                    <Text style={styles.barValueText}>{d.count > 0 ? d.count : ''}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { height: `${Math.max(heightPercent, d.count > 0 ? 12 : 6)}%` }]} />
                    </View>
                    <Text style={styles.dayLabel}>{d.dayLabel}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* DETAILED BREAKDOWN LIST */}
        <View style={styles.sessionList}>
          <Text style={styles.sessionTitle}>{lang === 'ph' ? 'Estado Kada Titik at Numero' : 'Per Letter & Number Status'}</Text>
          {loading ? <ActivityIndicator size="large" color="#F77F67" style={{ marginVertical: 20 }} /> : !activeStudentId ? (
            <Text style={styles.emptyText}>{lang === 'ph' ? 'Walang datos.' : 'No data available.'}</Text>
          ) : (
            availableItems.map((item) => {
              const stat = charStats[item];
              const hasPlayed = stat && stat.count > 0;
              const avgCharTime = hasPlayed ? Math.round(stat.totalDuration / stat.count) : 0;

              return (
                <View key={item} style={styles.charRecordRow}>
                  <View style={styles.charLeft}>
                    <View style={[styles.charBox, hasPlayed ? styles.charBoxPlayed : styles.charBoxNew]}>
                      <Text style={[styles.charText, hasPlayed && { color: 'white' }]}>{item}</Text>
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.charLabelTitle}>
                        {isNaN(item as any) ? (lang === 'ph' ? `Titik ${item}` : `Letter ${item}`) : (lang === 'ph' ? `Numero ${item}` : `Number ${item}`)}
                      </Text>
                      <Text style={styles.charSubLabel}>
                        {hasPlayed 
                          ? (lang === 'ph' ? `${stat.count}x nasubukan • ~${formatTime(avgCharTime)}/session` : `${stat.count} attempts • ~${formatTime(avgCharTime)}/session`) 
                          : (lang === 'ph' ? 'Hindi pa nasusubukan' : 'Not yet traced')}
                      </Text>
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
  scrollContent: { paddingHorizontal: '5%', paddingTop: 20, paddingBottom: 110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  subTitle: { fontSize: normalize(10), color: '#78716C', fontWeight: '700', textTransform: 'uppercase' },
  mainTitle: { fontSize: normalize(16), fontWeight: '900', color: '#1C1917' },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F77F67', justifyContent: 'center', alignItems: 'center' },

  // REWARD BANNER STYLES
  rewardCard: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1.5, borderRadius: 24, padding: 16, marginBottom: 15, elevation: 1 },
  rewardRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  rewardItem: { flexDirection: 'row', alignItems: 'center' },
  rewardCount: { fontSize: normalize(15), fontWeight: '900', color: '#1F2937' },
  rewardLabel: { fontSize: normalize(9), fontWeight: '700', color: '#78716C' },
  rewardDivider: { width: 1, height: 30, backgroundColor: '#FDE68A' },
  
  // STICKER GALLERY STYLES
  stickerGalleryCard: { backgroundColor: 'white', borderRadius: 24, padding: 16, marginBottom: 15, elevation: 2 },
  emptyStickerBox: { padding: 15, alignItems: 'center' },
  emptyStickerText: { fontSize: normalize(10), color: '#9CA3AF', textAlign: 'center', marginTop: 6 },
  stickerItem: { width: 75, alignItems: 'center', marginRight: 12 },
  stickerIconCircle: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#F3E8FF', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DDD6FE' },
  stickerNameText: { fontSize: normalize(9), fontWeight: '700', color: '#4B5563', marginTop: 4, textAlign: 'center' },

  // INSIGHTS CARD STYLES
  insightsCard: { backgroundColor: 'white', borderRadius: 24, padding: 16, marginBottom: 15, elevation: 2 },
  insightsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  insightsTitle: { fontSize: normalize(12), fontWeight: '800', color: '#1F2937', marginLeft: 6 },
  insightRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 14 },
  insightLabel: { fontSize: normalize(10), fontWeight: '800', color: '#374151' },
  insightValue: { fontSize: normalize(11), fontWeight: '600', color: '#4B5563', marginTop: 1 },

  // METRICS GRID STYLES
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  metricCard: { width: '48%', borderRadius: 20, padding: 15, alignItems: 'center', elevation: 1 },
  metricValue: { fontSize: normalize(16), fontWeight: '900', color: '#1F2937', marginVertical: 4 },
  metricLabel: { fontSize: normalize(10), fontWeight: '700', color: '#6B7280' },

  chartCard: { backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 15, elevation: 2 },
  cardHeaderTitle: { fontSize: normalize(13), fontWeight: '800', color: '#292524', marginBottom: 12 },
  barChartContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 110, paddingTop: 10 },
  barColumn: { alignItems: 'center', flex: 1 },
  barValueText: { fontSize: 9, fontWeight: '700', color: '#9CA3AF', marginBottom: 4 },
  barTrack: { height: 75, width: 14, backgroundColor: '#F5F5F4', borderRadius: 7, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: '#F77F67', borderRadius: 7 },
  dayLabel: { fontSize: 10, color: '#A8A29E', fontWeight: '700', marginTop: 6 },

  sessionList: { backgroundColor: 'white', borderRadius: 24, padding: 20 },
  sessionTitle: { fontSize: normalize(13), fontWeight: '800', color: '#292524', marginBottom: 15 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginVertical: 10 },
  charRecordRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  charLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  charBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  charBoxNew: { backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A' },
  charBoxPlayed: { backgroundColor: '#F77F67' },
  charText: { fontSize: normalize(16), fontWeight: '900', color: '#D97706' },
  charLabelTitle: { fontWeight: 'bold', fontSize: normalize(12), color: '#333' },
  charSubLabel: { fontSize: normalize(10), color: '#9CA3AF', marginTop: 2 },
  badgeContainer: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeLocked: { backgroundColor: '#FEF3C7' },
  badgeDone: { backgroundColor: '#DCFCE7' },
  badgeText: { fontSize: normalize(10), fontWeight: '900' },
  badgeTextLocked: { color: '#B45309' },
  badgeTextDone: { color: '#16A34A' }
});