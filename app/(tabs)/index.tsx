import React, { useCallback, useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  Dimensions, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useLanguage } from '../_layout'; 
import { ALL_CHARACTERS, LETTERS, NUMBERS } from '../../constants/characterLibrary';
import { MASTERY_ICONS, MASTERY_LABELS, masteryLevel } from '../../lib/mastery';
import { normalizeFor, useResponsive } from '../../lib/responsive';
import { COLORS, RADIUS } from '../../lib/theme';
import { db, auth } from '../../lib/firebase';
import { doc, onSnapshot, query, collection, where, getDoc } from 'firebase/firestore';

const INITIAL_WIDTH = Dimensions.get('window').width;
const normalize = (size: number) => normalizeFor(INITIAL_WIDTH, size);

interface CharacterStats {
  [key: string]: {
    accuracy: number;
    count: number;
  };
}

export default function DashboardScreen() {
  const router = useRouter();
  const { lang } = useLanguage();
  const { width: windowWidth, isTablet: isTabletDevice } = useResponsive();

  const [activeStudentName, setActiveStudentName] = useState<string>('---');
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [overallAccuracy, setOverallAccuracy] = useState<number>(0);
  const [timeSpent, setTimeSpent] = useState<string>('0m');
  const [loadingStats, setLoadingStats] = useState(() => auth.currentUser !== null);
  const [charStats, setCharStats] = useState<CharacterStats>({});

  const letters = LETTERS;
  const numbers = NUMBERS;

  const listenToRealtimeStats = useCallback((studentId: string) => {
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
  }, []);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return;
    }

    let unsubscribeSessions: (() => void) | null = null;
    let unsubscribeTeacher: (() => void) | null = null;

    const checkRoleAndSubscribe = async () => {
      try {
        // 1. Kukunin muna ang User Doc para suriin ang Role
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // Kapag Admin, diretso agad sa Admin screen
          if (userData?.role === 'admin') {
            router.replace('/admin-dashboard'); 
            return;
          }
        }

        // 2. Kung hindi Admin, itutuloy ang pag-listen sa Teacher/Student setup
        const teacherDocRef = doc(db, "users", currentUser.uid);
        unsubscribeTeacher = onSnapshot(teacherDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const currentStudentId = data.activeStudentId || null;
            
            setActiveStudentId(currentStudentId);
            setActiveStudentName(data.activeStudentName || '');

            if (currentStudentId) {
              if (unsubscribeSessions) unsubscribeSessions();
              unsubscribeSessions = listenToRealtimeStats(currentStudentId);
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

      } catch (err) {
        console.error("Error checking role:", err);
        setLoadingStats(false);
      }
    };

    checkRoleAndSubscribe();

    // Clean-up function para sa listeners kapag nag-unmount ang component
    return () => {
      if (unsubscribeTeacher) unsubscribeTeacher();
      if (unsubscribeSessions) unsubscribeSessions();
    };
  }, [lang, router, listenToRealtimeStats]);

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
    const level = masteryLevel(charStats[char]);
    return (
      <View style={[styles.statusBadgeDone, level === 0 && styles.statusBadgeNew]}>
        <Text style={[styles.statusBadgeTextDone, level === 0 && styles.statusBadgeTextNew]}>
          {level === 0
            ? (lang === 'ph' ? 'BAGO' : 'NEW')
            : `${MASTERY_ICONS[level]} ${MASTERY_LABELS[lang][level]}`}
        </Text>
      </View>
    );
  };

  const totalStars = ALL_CHARACTERS.reduce(
    (sum, character) => sum + masteryLevel(charStats[character]),
    0
  );
  const nextCharacter = ALL_CHARACTERS.find(
    (character) => masteryLevel(charStats[character]) < 3
  );

  const numColumns = isTabletDevice ? 6 : 4;
  const gridGap = 8;
  const itemWidth = (windowWidth * 0.88 - gridGap * (numColumns - 1)) / numColumns;

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
            <Ionicons name="star" size={16} color={COLORS.sunny} />
            <Text style={styles.coinText}>{totalStars}</Text>
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

        {/* JOURNEY / next character */}
        {nextCharacter && (
          <TouchableOpacity style={styles.journeyCard} onPress={() => startTracing(nextCharacter)}>
            <Ionicons name="flag-outline" size={18} color={COLORS.purple} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.journeyTitle}>
                {lang === 'ph' ? 'Ipagpatuloy ang Paglalakbay' : 'Continue Your Journey'}
              </Text>
              <Text style={styles.journeySub}>
                {lang === 'ph' ? `Susunod: ${nextCharacter}` : `Next up: ${nextCharacter}`}
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={COLORS.purple} />
          </TouchableOpacity>
        )}

        {/* REAL-TIME STATS */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: COLORS.skySoft }]}>
            <Text style={styles.statLabel}>{lang === 'ph' ? 'ORAS NA GINUGOL' : 'TIME SPENT'}</Text>
            {loadingStats ? <ActivityIndicator size="small" color="#0369A1" /> : <Text style={styles.statValue}>{timeSpent}</Text>}
          </View>
          <View style={[styles.statBox, { backgroundColor: COLORS.mintSoft }]}>
            <Text style={styles.statLabel}>{lang === 'ph' ? 'KAWASTUHAN' : 'ACCURACY'}</Text>
            {loadingStats ? <ActivityIndicator size="small" color="#22C55E" /> : <Text style={styles.statValue}>{overallAccuracy}%</Text>}
          </View>
        </View>

        {/* LETTERS GRID */}
        <Text style={styles.gridTitle}>{lang === 'ph' ? 'Mga Titik' : 'Letters'}</Text>
        <View style={styles.gridContainer}>
          {letters.map((char) => (
            <TouchableOpacity
              key={char}
              style={[styles.gridItem, { width: itemWidth }, char === nextCharacter && styles.gridItemNext]}
              onPress={() => startTracing(char)}
            >
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
  container: { flex: 1, backgroundColor: COLORS.cream },
  scrollContent: { paddingHorizontal: '6%', paddingTop: 20, paddingBottom: 120 },
  journeyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 20, padding: 14, marginBottom: 20, borderWidth: 2, borderColor: COLORS.purpleSoft, elevation: 2 },
  journeyTitle: { fontSize: normalize(12), fontWeight: '900', color: '#5B21B6' },
  journeySub: { fontSize: normalize(10), color: COLORS.muted, marginTop: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  userInfo: { flex: 1 },
  welcomeText: { fontSize: normalize(11), color: '#777', fontWeight: 'bold' },
  userName: { fontSize: normalize(18), fontWeight: '900', color: '#333', marginTop: 2 },
  coinBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.sunnySoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#FDE68A' },
  coinText: { marginLeft: 5, fontWeight: '900', color: COLORS.primary, fontSize: normalize(11) },
  heroCard: { backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.lg, padding: 25, marginBottom: 25, elevation: 4 },
  heroCardDisabled: { backgroundColor: COLORS.muted }, 
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
  gridItem: { aspectRatio: 0.82, backgroundColor: COLORS.white, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center', marginBottom: 5, elevation: 2, paddingTop: 8 },
  gridItemNext: { borderWidth: 3, borderColor: COLORS.purple },
  gridItemText: { fontSize: normalize(22), fontWeight: '900', color: COLORS.primarySoft, marginBottom: 4 },
  numItem: { backgroundColor: COLORS.primarySoft },
  numItemText: { color: 'white' },
  statusBadgeNew: { backgroundColor: COLORS.sunnySoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusBadgeTextNew: { fontSize: normalize(7.5), fontWeight: '900', color: COLORS.primary },
  statusBadgeDone: { backgroundColor: COLORS.mintSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  statusBadgeTextDone: { fontSize: normalize(8), fontWeight: '900', color: COLORS.success }
});