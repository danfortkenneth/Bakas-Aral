import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, PixelRatio, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../_layout'; 
import { db, auth } from '../../lib/firebase';
import { doc, onSnapshot, query, collection, where } from 'firebase/firestore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375;
const normalize = (size: number) => Math.round(PixelRatio.roundToNearestPixel(size * scale));
const isTablet = SCREEN_WIDTH > 550;

interface CharacterStats {
  [key: string]: {
    accuracy: number;
    count: number;
  };
}

export default function DashboardScreen() {
  const router = useRouter();
  const { lang } = useLanguage();

  const [activeStudentName, setActiveStudentName] = useState<string>('---');
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [overallAccuracy, setOverallAccuracy] = useState<number>(0);
  const [timeSpent, setTimeSpent] = useState<string>('0m');
  const [loadingStats, setLoadingStats] = useState(true);
  const [charStats, setCharStats] = useState<CharacterStats>({});

  const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const numbers = ['1', '2', '3'];

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoadingStats(false);
      return;
    }

    const teacherDocRef = doc(db, "users", currentUser.uid);
    const unsubscribeTeacher = onSnapshot(teacherDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentStudentId = data.activeStudentId || null;
        
        setActiveStudentId(currentStudentId);
        setActiveStudentName(data.activeStudentName || '');

        if (currentStudentId) {
          const unsubscribeSessions = listenToRealtimeStats(currentStudentId);
          return () => unsubscribeSessions();
        } else {
          setOverallAccuracy(0);
          setTimeSpent('0m');
          setCharStats({});
          setLoadingStats(false);
        }
      } else {
        setLoadingStats(false);
      }
    });

    return () => unsubscribeTeacher();
  }, [lang]);

  const listenToRealtimeStats = (studentId: string) => {
    const q = query(collection(db, "sessions"), where("userId", "==", studentId));
    return onSnapshot(q, (querySnapshot) => {
      let globalTotalAcc = 0;
      let globalCount = 0;
      const tempCharStats: CharacterStats = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const char = data.letterOrNumber;
        const acc = data.accuracy;

        if (char && typeof acc === 'number') {
          globalTotalAcc += acc;
          globalCount++;

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
      setOverallAccuracy(globalCount > 0 ? Math.round(globalTotalAcc / globalCount) : 100);
      
      const calculatedMinutes = globalCount * 3; 
      if (calculatedMinutes >= 60) {
        setTimeSpent(`${Math.floor(calculatedMinutes / 60)}h ${calculatedMinutes % 60}m`);
      } else {
        setTimeSpent(`${calculatedMinutes}m`);
      }
      setLoadingStats(false);
    }, (error) => {
      console.error(error);
      setLoadingStats(false);
    });
  };

  const startTracing = (char: string) => {
    if (!activeStudentId) {
      Alert.alert(
        lang === 'ph' ? "Paalala" : "Notice",
        lang === 'ph' ? "Paki-set muna ang mag-aaral sa Teacher dashboard!" : "Please set an active student in the Teacher dashboard first!"
      );
      return;
    }
    router.push({ pathname: '/bakas', params: { selectedChar: char, currentStudentId: activeStudentId } });
  };

  const renderItemStatus = (char: string) => {
    if (loadingStats) return null;
    const stat = charStats[char];
    if (stat && stat.count > 0) {
      return (
        <View style={styles.statusBadgeDone}>
          <Text style={styles.statusBadgeTextDone}>{stat.accuracy}%</Text>
        </View>
      );
    }
    return (
      <View style={styles.statusBadgeNew}>
        <Text style={styles.statusBadgeTextNew}>{lang === 'ph' ? 'BAGO' : 'NEW'}</Text>
      </View>
    );
  };

  const numColumns = isTablet ? 6 : 4;
  const itemWidth = (SCREEN_WIDTH * 0.88) / numColumns - normalize(8);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Text style={styles.welcomeText}>{lang === 'ph' ? 'Mag-aaral ngayon:' : 'Active Learner:'}</Text>
            <Text style={styles.userName}>
              {activeStudentId ? activeStudentName : (lang === 'ph' ? 'Walang Napili' : 'None Selected')}
            </Text>
          </View>
          <View style={styles.coinBadge}>
            <Ionicons name="star" size={16} color="#FBBF24" />
            <Text style={styles.coinText}>120</Text>
          </View>
        </View>

        {/* HERO BANNER */}
        <View style={[styles.heroCard, !activeStudentId && styles.heroCardDisabled]}>
          <View style={styles.heroContent}>
            <Text style={styles.heroTag}>
              {activeStudentId ? (lang === 'ph' ? `HALINA, ${activeStudentName.toUpperCase()}!` : `LET'S GO, ${activeStudentName.toUpperCase()}!`) : (lang === 'ph' ? 'KAILANGAN NG GURO' : 'TEACHER SETUP REQUIRED')}
            </Text>
            <Text style={styles.heroTitle}>
              {activeStudentId ? (lang === 'ph' ? 'Handa ka na bang sumulat at mag-trace ngayon?' : 'Ready to trace some letters?') : (lang === 'ph' ? 'Paki-setup muna ang sesyon sa Teacher Dashboard upang magsimula.' : 'Please setup a session in the Teacher Dashboard to start.')}
            </Text>
            <TouchableOpacity style={[styles.startBtn, !activeStudentId && styles.startBtnDisabled]} onPress={() => startTracing('A')} disabled={!activeStudentId}>
              <Ionicons name={activeStudentId ? "play" : "lock-closed"} size={14} color="#333" />
              <Text style={styles.startBtnText}>{lang === 'ph' ? 'Magsimula' : 'Get Started'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* REAL-TIME STATS */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: '#E0F2FE' }]}>
            <Text style={styles.statLabel}>{lang === 'ph' ? 'ORAS NA GINUGOL' : 'TIME SPENT'}</Text>
            {loadingStats ? <ActivityIndicator size="small" color="#0369A1" /> : <Text style={styles.statValue}>{timeSpent}</Text>}
          </View>
          <View style={[styles.statBox, { backgroundColor: '#DCFCE7' }]}>
            <Text style={styles.statLabel}>{lang === 'ph' ? 'KAWASTUHAN' : 'ACCURACY'}</Text>
            {loadingStats ? <ActivityIndicator size="small" color="#22C55E" /> : <Text style={styles.statValue}>{overallAccuracy}%</Text>}
          </View>
        </View>

        {/* LETTERS GRID */}
        <Text style={styles.gridTitle}>{lang === 'ph' ? 'Mga Titik' : 'Letters'}</Text>
        <View style={styles.gridContainer}>
          {letters.map((char) => (
            <TouchableOpacity key={char} style={[styles.gridItem, { width: itemWidth }]} onPress={() => startTracing(char)}>
              <Text style={styles.gridItemText}>{char}</Text>
              {renderItemStatus(char)}
            </TouchableOpacity>
          ))}
        </View>

        {/* NUMBERS GRID */}
        <Text style={[styles.gridTitle, { marginTop: 20 }]}>{lang === 'ph' ? 'Mga Numero' : 'Numbers'}</Text>
        <View style={styles.gridContainer}>
          {numbers.map((num) => (
            <TouchableOpacity key={num} style={[styles.gridItem, styles.numItem, { width: itemWidth }]} onPress={() => startTracing(num)}>
              <Text style={[styles.gridItemText, styles.numItemText]}>{num}</Text>
              {renderItemStatus(num)}
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB' },
  scrollContent: { paddingHorizontal: '6%', paddingTop: 20, paddingBottom: 110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  userInfo: { flex: 1 },
  welcomeText: { fontSize: normalize(11), color: '#777', fontWeight: 'bold' },
  userName: { fontSize: normalize(18), fontWeight: '900', color: '#333', marginTop: 2 },
  coinBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#FDE68A' },
  coinText: { marginLeft: 5, fontWeight: '900', color: '#D97706', fontSize: normalize(11) },
  heroCard: { backgroundColor: '#F7A072', borderRadius: 30, padding: 25, marginBottom: 25, elevation: 4 },
  heroCardDisabled: { backgroundColor: '#9CA3AF' }, 
  heroContent: { flex: 1 },
  heroTag: { color: 'rgba(255,255,255,0.7)', fontSize: normalize(9), fontWeight: '900', letterSpacing: 0.5 },
  heroTitle: { color: 'white', fontSize: normalize(16), fontWeight: '900', marginVertical: 10, lineHeight: 22 },
  startBtn: { backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginTop: 5 },
  startBtnDisabled: { backgroundColor: '#E5E7EB', opacity: 0.7 },
  startBtnText: { marginLeft: 8, fontWeight: 'bold', color: '#333', fontSize: normalize(11) },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  statBox: { width: '48%', borderRadius: 20, padding: 18 },
  statLabel: { fontSize: normalize(9), color: '#555', fontWeight: '900', letterSpacing: 0.5 },
  statValue: { fontSize: normalize(20), fontWeight: '900', color: '#333', marginTop: 5 },
  gridTitle: { fontSize: normalize(16), fontWeight: '900', color: '#333', marginBottom: 15 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start' },
  gridItem: { aspectRatio: 0.82, backgroundColor: 'white', borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: 5, elevation: 2, paddingTop: 8 },
  gridItemText: { fontSize: normalize(22), fontWeight: '900', color: '#F7A072', marginBottom: 4 },
  numItem: { backgroundColor: '#F7A072' },
  numItemText: { color: 'white' },
  statusBadgeNew: { backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusBadgeTextNew: { fontSize: normalize(7.5), fontWeight: '900', color: '#D97706' },
  statusBadgeDone: { backgroundColor: '#DCFCE7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusBadgeTextDone: { fontSize: normalize(8), fontWeight: '900', color: '#15803D' }
});