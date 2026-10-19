import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, View, PanResponder, TouchableOpacity, Text, Image, Animated, Dimensions, PixelRatio, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import Svg, { Path, Circle } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { db } from '../../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { useLanguage } from '../_layout';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375;
const normalize = (size: number) => Math.round(PixelRatio.roundToNearestPixel(size * scale));
const isTablet = SCREEN_WIDTH > 550;

const CANVAS_WIDTH = SCREEN_WIDTH * 0.9;
const CANVAS_HEIGHT = SCREEN_HEIGHT * 0.55;

const CHAR_LIBRARY: any = {
  'A': {
    word: 'Atis',
    image: require('../../assets/images/Atis.png'), 
    phoneticSound: require('../../assets/sounds/Atis.mp3'), 
    wordSound: require('../../assets/sounds/Atis_suc.mp3'),     
    path: "M200,100 L100,450 M200,100 L300,450 M145,320 L255,320",
    points: [
      { id: 1, x: 200, y: 100 }, 
      { id: 2, x: 150, y: 275 }, 
      { id: 3, x: 100, y: 450 }, 
      { id: 4, x: 300, y: 450 }, 
      { id: 5, x: 200, y: 320 }
    ],
    segments: [
      { x1: 200, y1: 100, x2: 100, y2: 450 },
      { x1: 200, y1: 100, x2: 300, y2: 450 },
      { x1: 145, y1: 320, x2: 255, y2: 320 }
    ]
  },
  'B': {
    word: 'Bahay', 
    image: require('../../assets/images/Bahay.png'), 
    phoneticSound: require('../../assets/sounds/Bahay.mp3'), 
    wordSound: require('../../assets/sounds/Bahay_suc.mp3'),         
    path: "M150,100 L150,500 M150,100 C270,100 270,300 150,300 C270,300 270,500 150,500",
    points: [
      { id: 1, x: 150, y: 100 }, 
      { id: 2, x: 150, y: 300 }, 
      { id: 3, x: 150, y: 500 }, 
      { id: 4, x: 230, y: 200 }, 
      { id: 5, x: 240, y: 400 }, 
    ],
    segments: [
      { x1: 150, y1: 100, x2: 150, y2: 300 },
      { x1: 150, y1: 300, x2: 150, y2: 500 },
      { x1: 150, y1: 100, x2: 230, y2: 200 },
      { x1: 230, y1: 200, x2: 150, y2: 300 },
      { x1: 150, y1: 300, x2: 240, y2: 400 },
      { x1: 240, y1: 400, x2: 150, y2: 500 }
    ]
  }
};

export default function TracingScreen() {
  const router = useRouter();
  const { lang } = useLanguage();
  const params = useLocalSearchParams();
  
  const selectedChar = (params.selectedChar as string) || 'A';
  const studentId = (params.currentStudentId as string) || null;
  const activeAvatar = (params.activeAvatar as string) || 'lion'; // Default kung walang galing sa dashboard
  const charData = CHAR_LIBRARY[selectedChar] || CHAR_LIBRARY['A'];

  const [paths, setPaths] = useState<string[]>([]);
  const [isOnPath, setIsOnPath] = useState<boolean>(true);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [accuracy, setAccuracy] = useState<number>(100); 
  
  // Feature #7 states para sa multi-sensory modal engine
  const [isAnimalFed, setIsAnimalFed] = useState<boolean>(false);
  const [earnedStars, setEarnedStars] = useState<number>(3);
  
  const hitPoints = useRef<number[]>([]);
  const totalPointsCount = charData.points.length;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Variables para sa kalkulasyon ng dynamic accuracy framework
  const totalMoves = useRef<number>(0);
  const errorMoves = useRef<number>(0);

  const phoneticSoundRef = useRef<Audio.Sound | null>(null);
  const successSoundRef = useRef<Audio.Sound | null>(null);
  const errorSoundRef = useRef<Audio.Sound | null>(null);
  const crunchSoundRef = useRef<Audio.Sound | null>(null);
  const lastErrorSoundTime = useRef<number>(0);

  // Load phonetic loop sound at success sound tuwing magpapalit ng letra
  useEffect(() => {
    async function loadSoundsForChar() {
      try {
        if (phoneticSoundRef.current) {
          await phoneticSoundRef.current.unloadAsync();
          phoneticSoundRef.current = null;
        }
        if (successSoundRef.current) {
          await successSoundRef.current.unloadAsync();
          successSoundRef.current = null;
        }

        // Feature #2: Phonetic Audio Setup (Looping enabled habasg nagto-trace)
        const { sound: pSound } = await Audio.Sound.createAsync(
          charData.phoneticSound,
          { isLooping: true, volume: 0.7 }
        );
        phoneticSoundRef.current = pSound;

        // Feature #2.1: Contextual Anchor Word Sound
        const { sound: wSound } = await Audio.Sound.createAsync(charData.wordSound);
        successSoundRef.current = wSound;
      } catch (e) {
        console.log("Error loading dynamic character sounds:", e);
      }
    }

    loadSoundsForChar();
    handleReset(); 

    return () => {
      if (phoneticSoundRef.current) phoneticSoundRef.current.unloadAsync();
      if (successSoundRef.current) successSoundRef.current.unloadAsync();
    };
  }, [selectedChar]);

  // Load error at interactive crunch feedback sounds minsan lang sa mount life cycle
  useEffect(() => {
    async function loadStaticSounds() {
      try {
        const { sound: errSound } = await Audio.Sound.createAsync(require('../../assets/sounds/error.mp3'));
        errorSoundRef.current = errSound;
      } catch (e) {
        console.log("Error loading static error sound:", e);
      }

      try {
        // Gamitin muna ang error sound asset kung wala pang crunch.mp3 para iwas-crash sa execution
        const { sound: chmpSound } = await Audio.Sound.createAsync(require('../../assets/sounds/error.mp3')); 
        crunchSoundRef.current = chmpSound;
      } catch (e) {
        console.log("Error loading static crunch sound:", e);
      }
    }
    loadStaticSounds();

    return () => {
      if (errorSoundRef.current) errorSoundRef.current.unloadAsync();
      if (crunchSoundRef.current) crunchSoundRef.current.unloadAsync();
    };
  }, []);

  const saveSessionToDatabase = async (finalAccuracy: number) => {
    if (!studentId) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "sessions"), {
        userId: studentId,
        letterOrNumber: selectedChar,
        accuracy: finalAccuracy,
        timestamp: new Date().toISOString(),
        unlockedSticker: selectedChar,
        starsEarned: finalAccuracy >= 90 ? 3 : (finalAccuracy >= 75 ? 2 : 1)
      });
    } catch (error) {
      console.error("Error saving tracing session history:", error);
    } finally {
      setSaving(false);
    }
  };

  const getDistanceToSegment = (x: number, y: number, x1: number, y1: number, x2: number, y2: number) => {
    const A = x - x1; const B = y - y1; const C = x2 - x1; const D = y2 - y1;
    const dot = A * C + B * D; const lenSq = C * C + D * D;
    let param = -1; if (lenSq !== 0) param = dot / lenSq;
    let xx, yy;
    if (param < 0) { xx = x1; yy = y1; }
    else if (param > 1) { xx = x2; yy = y2; }
    else { xx = x1 + param * C; yy = y1 + param * D; }
    return Math.sqrt((x - xx) * (x - xx) + (y - yy) * (y - yy));
  };

  const verifyTracingAccuracy = (x: number, y: number) => {
    totalMoves.current += 1;

    charData.points.forEach((point: any) => {
      const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
      const targetRadius = selectedChar === 'B' ? 45 : 40;
      if (distance < targetRadius) { 
        if (!hitPoints.current.includes(point.id)) {
          hitPoints.current.push(point.id);
        }
      }
    });

    let minDistanceToLetter = 999;
    if (charData.segments) {
      charData.segments.forEach((seg: any) => {
        const dist = getDistanceToSegment(x, y, seg.x1, seg.y1, seg.x2, seg.y2);
        if (dist < minDistanceToLetter) minDistanceToLetter = dist;
      });
    }

    const pathAllowance = selectedChar === 'B' ? 50 : 45;
    if (minDistanceToLetter > pathAllowance) {
      setIsOnPath(false);
      errorMoves.current += 1;
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      const now = Date.now();
      if (now - lastErrorSoundTime.current > 1200) {
        if (errorSoundRef.current) {
          lastErrorSoundTime.current = now;
          errorSoundRef.current.replayAsync().catch(() => {});
        }
      }
    } else {
      setIsOnPath(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !isFinished,
      onMoveShouldSetPanResponder: () => !isFinished,
      
      onPanResponderGrant: async (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const svgX = (locationX / CANVAS_WIDTH) * 400;
        const svgY = (locationY / CANVAS_HEIGHT) * 600;
        setPaths((prev) => [...prev, `M${svgX.toFixed(1)},${svgY.toFixed(1)}`]);
        verifyTracingAccuracy(svgX, svgY);

        // Feature #2: Patutugtugin ang phonetic audio sound kapag dumikit ang daliri
        if (phoneticSoundRef.current) {
          try { await phoneticSoundRef.current.playAsync(); } catch (e) {}
        }
      },

      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        const svgX = (locationX / CANVAS_WIDTH) * 400;
        const svgY = (locationY / CANVAS_HEIGHT) * 600;

        setPaths((prev) => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          updated[updated.length - 1] = `${updated[updated.length - 1]} L${svgX.toFixed(1)},${svgY.toFixed(1)}`;
          return updated;
        });
        verifyTracingAccuracy(svgX, svgY);
      },

      onPanResponderRelease: async () => {
        // Feature #2: I-pause ang audio loop kapag binuhat ang kamay ng bata
        if (phoneticSoundRef.current) {
          try { await phoneticSoundRef.current.pauseAsync(); } catch (e) {}
        }

        if (isFinished) return;

        const uniqueHitsCount = new Set(hitPoints.current).size;
        if (uniqueHitsCount === totalPointsCount) {
          // Dynamic calculation index para sa totoong feedback scores
          const calculatedScore = Math.max(50, Math.round(((totalMoves.current - errorMoves.current) / totalMoves.current) * 100));
          
          let stars = 1;
          if (calculatedScore >= 90) stars = 3;
          else if (calculatedScore >= 75) stars = 2;

          setAccuracy(calculatedScore); 
          setEarnedStars(stars);
          setIsAnimalFed(false); // Mananatiling gutom para lumabas ang interactive button panel ng Feature #7
          setIsFinished(true);
          setIsOnPath(true);
          
          if (phoneticSoundRef.current) {
            try { await phoneticSoundRef.current.stopAsync(); } catch(e){}
          }

          // Feature #2.1: Contextual Anchor Word Sound ("Atis!")
          if (successSoundRef.current) {
            try { await successSoundRef.current.replayAsync(); } catch(e){}
          }
          
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          saveSessionToDatabase(calculatedScore);
          Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        } else {
          setIsOnPath(true); 
        }
      },
    })
  ).current;

  const handleReset = () => {
    setPaths([]);
    setIsOnPath(true);
    setIsFinished(false);
    setIsAnimalFed(false);
    hitPoints.current = [];
    totalMoves.current = 0;
    errorMoves.current = 0;
    fadeAnim.setValue(0);
    setAccuracy(100);
  };

  return (
    <SafeAreaProvider>
      <View style={[styles.container, !isOnPath && styles.errorBg]}>
        
        <SafeAreaView edges={['top']} style={styles.overlay}>
          <View style={styles.topRow}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>

            <View style={[styles.statusBadge, { backgroundColor: isFinished ? '#DCFCE7' : (isOnPath ? '#FEF3C7' : '#FEE2E2') }]}>
              <Text style={styles.statusText}>
                {isFinished ? (lang === 'ph' ? 'ANG GALING!' : 'GREAT JOB!') : (isOnPath ? (lang === 'ph' ? 'BAKASIN MO' : 'TRACE ME') : (lang === 'ph' ? 'LUMAMPAS!' : 'OOPS!'))}
              </Text>
            </View>

            <TouchableOpacity style={styles.backBtn} onPress={handleReset}>
              <Ionicons name="refresh" size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <View style={styles.svgWrapper} {...panResponder.panHandlers}>
          <Svg height={CANVAS_HEIGHT} width={CANVAS_WIDTH} viewBox="0 0 400 600" style={styles.svgBorderContainer}>
            <Path d={charData.path} fill="none" stroke="#EAEAEA" strokeWidth={isTablet ? 95 : 80} strokeLinecap="round" strokeLinejoin="round" />
            <Path 
              d={charData.path} 
              fill="none" 
              stroke={isFinished ? "#4ADE80" : (isOnPath ? "#FED7AA" : "#FCA5A5")} 
              strokeWidth={isTablet ? 80 : 65} 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
            {paths.map((strokePath, index) => (
              <Path 
                key={index}
                d={strokePath} 
                fill="none" 
                stroke={isOnPath ? "#F77F67" : "#EF4444"} 
                strokeWidth={isTablet ? 16 : 12} 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            ))}
            {!isFinished && charData.points.map((pt: any) => (
              <Circle key={pt.id} cx={pt.x} cy={pt.y} r={isTablet ? 14 : 10} fill="#EF4444" />
            ))}
          </Svg>
        </View>

        {/* FEATURE #7: INTERACTIVE MULTI-SENSORY GAMIFIED REWARD MODAL OVERLAY */}
        {isFinished && (
          <Animated.View style={[styles.successContent, { opacity: fadeAnim }]}>
            
            {!isAnimalFed ? (
              // STAGE 1: "FEED THE ANIMAL" INTERACTIVE GRATIFICATION PORTAL
              <View style={{ alignItems: 'center', width: '100%' }}>
                <Text style={styles.rewardTitle}>🎉 TITIK {selectedChar} AY TAPOS NA!</Text>
                <Text style={styles.rewardSubtitle}>
                  {lang === 'ph' ? `Gutom ang iyong avatar! Pindutin ang pagkain para ipakain ito sa kanya:` : `Your avatar is hungry! Tap the food to feed them:`}
                </Text>

                {/* EMOJI GRAPHICS MATRICES */}
                <Text style={styles.animalLargeEmoji}>
                  {activeAvatar === 'lion' ? '🦁' : activeAvatar === 'bear' ? '🐻' : '🐰'}
                </Text>

                {/* FOOD HITBOX SELECTION INTERACTIVE ENGINE */}
                <TouchableOpacity 
                  style={styles.foodActionBtn}
                  onPress={async () => {
                    setIsAnimalFed(true);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    if (crunchSoundRef.current) {
                      try { await crunchSoundRef.current.replayAsync(); } catch(e){}
                    }
                  }}
                >
                  <Text style={{ fontSize: normalize(32) }}>
                    {activeAvatar === 'lion' ? '🥩' : activeAvatar === 'bear' ? '🐟' : '🥕'}
                  </Text>
                  <Text style={styles.foodBtnLabelText}>{lang === 'ph' ? 'IPAKAIN!' : 'FEED NOW!'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              // STAGE 2: STICKER BOOK BADGE UNLOCKED OVERVIEW GRID LOGIC
              <View style={{ alignItems: 'center', width: '100%' }}>
                <Text style={styles.badgeTextHeaderHeader}>🏆 STICKER UNLOCKED!</Text>
                
                {/* CHECKPOINT STARS PROGRESS BAR */}
                <View style={styles.starsRewardRow}>
                  <Ionicons name="star" size={normalize(26)} color="#FBBF24" />
                  <Ionicons name="star" size={normalize(32)} color={earnedStars >= 2 ? "#FBBF24" : "#D1D5DB"} style={{ marginTop: -5 }} />
                  <Ionicons name="star" size={normalize(26)} color={earnedStars === 3 ? "#FBBF24" : "#D1D5DB"} />
                </View>

                {/* STICKER ARCHIVE BRANDING BADGE */}
                <View style={styles.stickerEmblemFrameBox}>
                  <Image source={charData.image} style={styles.anchorImage} resizeMode="contain" />
                  <Text style={styles.stickerBadgePillLabel}>
                    {selectedChar} - {charData.word}
                  </Text>
                </View>
                
                <Text style={styles.anchorTextDescription}>
                  {lang === 'ph' 
                    ? `Busog na si ${activeAvatar === 'lion' ? 'Leon' : activeAvatar === 'bear' ? 'Oso' : 'Kuneho'}! Ligtas na na-save ang sticker sa offline book.` 
                    : `Your animal is full! The sticker has been logged to your offline book.`}
                </Text>

                <Text style={styles.accuracyPillTextBadge}>
                  {lang === 'ph' ? `Katumpakan: ${accuracy}%` : `Accuracy: ${accuracy}%`}
                </Text>
                
                {/* ACTION BUTTON CONTROLS */}
                <View style={styles.btnRow}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnSecondary]} onPress={handleReset}>
                    <Ionicons name="refresh" size={18} color="#555" style={{ marginRight: 4 }} />
                    <Text style={styles.modalBtnTextSec}>{lang === 'ph' ? 'Ulitin' : 'Retry'}</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.modalBtn} onPress={() => router.back()} disabled={saving}>
                    {saving ? (
                      <ActivityIndicator color="white" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.modalBtnText}>{lang === 'ph' ? 'Ipagpatuloy' : 'Continue'}</Text>
                        <Ionicons name="arrow-forward" size={18} color="white" style={{ marginLeft: 4 }} />
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </Animated.View>
        )}

      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB', justifyContent: 'center', alignItems: 'center' },
  errorBg: { backgroundColor: '#FFF0F0' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: '6%', paddingTop: 10, zIndex: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 3 },
  statusBadge: { paddingHorizontal: 22, paddingVertical: 10, borderRadius: 20, elevation: 2 },
  statusText: { fontWeight: '900', fontSize: normalize(12), color: '#333', letterSpacing: 0.5 },
  svgWrapper: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  svgBorderContainer: { backgroundColor: 'white', borderRadius: 30, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
  
  // Feature #7 Layout Graphics Extensions
  successContent: { position: 'absolute', backgroundColor: 'white', padding: 25, borderRadius: 35, alignItems: 'center', elevation: 25, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 15, width: isTablet ? 450 : '88%', zIndex: 30 },
  rewardTitle: { fontSize: normalize(14), fontWeight: '900', color: '#141414', textAlign: 'center' },
  rewardSubtitle: { fontSize: normalize(10), color: '#666', textAlign: 'center', marginTop: 4, paddingHorizontal: 10, lineHeight: 14 },
  animalLargeEmoji: { fontSize: normalize(75), marginVertical: 15, textAlign: 'center' },
  foodActionBtn: { backgroundColor: '#FFFBEB', borderWidth: 2, borderColor: '#FBBF24', borderRadius: 22, paddingVertical: 12, paddingHorizontal: 25, alignItems: 'center', minWidth: '60%', elevation: 1 },
  foodBtnLabelText: { fontSize: normalize(11), fontWeight: '900', color: '#B45309', marginTop: 4, letterSpacing: 0.5 },
  
  badgeTextHeaderHeader: { fontSize: normalize(15), fontWeight: '900', color: '#F77F67', textTransform: 'uppercase', textAlign: 'center' },
  starsRewardRow: { flexDirection: 'row', gap: 4, marginVertical: 8, justifyContent: 'center', alignItems: 'center' },
  stickerEmblemFrameBox: { backgroundColor: '#F0FDF4', borderWidth: 3, borderColor: '#4ADE80', borderRadius: 25, padding: 15, marginVertical: 10, alignItems: 'center', width: '90%' },
  anchorImage: { width: isTablet ? 180 : 130, height: isTablet ? 180 : 130, marginBottom: 8 },
  stickerBadgePillLabel: { backgroundColor: '#4ADE80', color: '#141414', fontWeight: '900', fontSize: normalize(9), paddingHorizontal: 12, paddingVertical: 3, borderRadius: 10, textTransform: 'uppercase' },
  anchorTextDescription: { fontSize: normalize(11), fontWeight: '700', color: '#4B5563', marginBottom: 12, textAlign: 'center', paddingHorizontal: 5, lineHeight: 16 },
  accuracyPillTextBadge: { fontSize: normalize(11), color: '#16A34A', fontWeight: '900', backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: 'center', marginBottom: 18 },

  btnRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', gap: 10 },
  modalBtn: { flex: 1, backgroundColor: '#F77F67', paddingVertical: 14, borderRadius: 20, alignItems: 'center', justifyContent: 'center', elevation: 2, flexDirection: 'row' },
  modalBtnSecondary: { backgroundColor: '#F3F4F6' },
  modalBtnText: { color: 'white', fontWeight: '900', fontSize: normalize(12) },
  modalBtnTextSec: { color: '#555', fontWeight: '900', fontSize: normalize(12) }
});