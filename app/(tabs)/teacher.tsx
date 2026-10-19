import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, PixelRatio, Dimensions, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../_layout'; 
import { useRouter } from 'expo-router'; 
import { auth, db } from '../../lib/firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import QRCode from 'react-native-qrcode-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375;
const normalize = (size: number) => Math.round(PixelRatio.roundToNearestPixel(size * scale));

const ANIMAL_AVATARS = [
  { id: 'lion', emoji: '🦁' }, { id: 'bear', emoji: '🐻' }, { id: 'rabbit', emoji: '🐰' },
  { id: 'tiger', emoji: '🐯' }, { id: 'koala', emoji: '🐨' }, { id: 'panda', emoji: '🐼' },
  { id: 'monkey', emoji: '🐵' }, { id: 'fox', emoji: '🦊' }, { id: 'cat', emoji: '🐱' },
  { id: 'dog', emoji: '🐶' }, { id: 'pig', emoji: '🐷' }, { id: 'mouse', emoji: '🐭' },
];

interface PastSession {
  nickname: string;
  avatar: string;
  accuracy: string;
  duration: string;
  timestamp: string;
  qrValue: string;
}

export default function TeacherScreen() {
  const router = useRouter(); 
  const { lang, setLang } = useLanguage();
  const [role, setRole] = useState<string | null>(null);
  const isAdmin = role === 'admin';
  
  const [activeStudentAvatar, setActiveStudentAvatar] = useState<string | null>(null); 
  const [updatingSession, setUpdatingSession] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  // --- LOCAL STATES (Zero-Enrollment Compliant) ---
  const [tempNickname, setTempNickname] = useState<string>(''); 
  const [currentSessionNickname, setCurrentSessionNickname] = useState<string>(''); 
  const [sessionReportData, setSessionReportData] = useState<string>(''); 

  // --- RECENT HISTORY MATRIX (RAM Memory Only) ---
  const [recentSessions, setRecentSessions] = useState<PastSession[]>([]);
  const [selectedPastQR, setSelectedPastQR] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeSessions: () => void = () => {};
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const teacherRef = doc(db, "users", user.uid);
        unsubscribeSessions = onSnapshot(teacherRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setRole(data.role || 'teacher');
            setActiveStudentAvatar(data.activeStudentAvatar || null);
          }
        });
      }
    });
    return () => { unsubscribeAuth(); unsubscribeSessions(); };
  }, []);

  const handleTeacherLogout = () => {
    Alert.alert(
      lang === 'ph' ? 'Mag-logout' : 'Logout',
      lang === 'ph' ? 'Sigurado ka bang aalis ka? Mabubura ang temporary sessions list.' : 'Are you sure you want to log out? Temporary session list will clear.',
      [
        { text: lang === 'ph' ? 'Hindi' : 'Cancel', style: 'cancel' },
        { 
          text: lang === 'ph' ? 'Oo' : 'Yes', 
          style: 'destructive',
          onPress: async () => {
            try { await signOut(auth); router.replace('/login'); } catch (error: any) { Alert.alert("Error", error.message); }
          }
        }
      ]
    );
  };

  const handleSelectAvatarSession = async (avatarId: string) => {
    if (!tempNickname.trim()) {
      Alert.alert(
        lang === 'ph' ? "Kailangan ng Nickname" : "Nickname Required", 
        lang === 'ph' ? "Maglagay ng temporary nickname ng bata bago pumili ng avatar." : "Please enter a child nickname before selecting an avatar."
      );
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser || updatingSession) return;

    setUpdatingSession(true);
    try {
      const teacherRef = doc(db, "users", currentUser.uid);
      await updateDoc(teacherRef, { activeStudentAvatar: avatarId, sessionStatus: "active" });

      setCurrentSessionNickname(tempNickname); 
      setIsAvatarModalOpen(false);
      setSessionReportData(''); 
      setSelectedPastQR(null); 

      Alert.alert(
        lang === 'ph' ? "Sesyon Nagsimula!" : "Session Started!", 
        lang === 'ph' ? `Aktibo na si ${tempNickname} sa Tablet.` : `Session is now active for ${tempNickname} on Tablet.`
      );
    } catch (error) {
      Alert.alert("Error", "Hindi ma-isave ang sesyon.");
    } finally {
      setUpdatingSession(false);
    }
  };

  const handleEndSessionAndCompileQR = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !activeStudentAvatar) return;

    Alert.alert(
      lang === 'ph' ? "Tapusin ang Sesyon" : "End Session",
      lang === 'ph' ? "Nais mo bang tapusin ang sesyon at i-compile ang data sa QR Code?" : "Do you want to end the session and compile metrics to QR Code?",
      [
        { text: lang === 'ph' ? "Kanselahin" : "Cancel", style: "cancel" },
        { 
          text: lang === 'ph' ? "Oo, Tapusin" : "Yes, End Session", 
          style: 'destructive',
          onPress: async () => {
            setUpdatingSession(true);
            try {
              const simulatedAccuracy = Math.floor(Math.random() * (100 - 75 + 1)) + 75; 
              const simulatedTime = Math.floor(Math.random() * (120 - 45 + 1)) + 45; 

              const reportObj = {
                appIdentifier: "BAKAS_ARAL_PARENT_SYNC", // Flag para sa parent app scanner portal
                nickname: currentSessionNickname,
                avatar: activeStudentAvatar,
                accuracy: `${simulatedAccuracy}%`,
                duration: `${simulatedTime}s`,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                school: "NEU Pre-K Division" 
              };

              const rawJsonString = JSON.stringify(reportObj);
              setSessionReportData(rawJsonString);

              // Idagdag sa Local RAM History Matrix list
              const newPastSession: PastSession = {
                nickname: currentSessionNickname,
                avatar: activeStudentAvatar,
                accuracy: reportObj.accuracy,
                duration: reportObj.duration,
                timestamp: reportObj.timestamp,
                qrValue: rawJsonString
              };
              setRecentSessions(prev => [newPastSession, ...prev]); 

              const teacherRef = doc(db, "users", currentUser.uid);
              await updateDoc(teacherRef, { activeStudentAvatar: null, sessionStatus: "completed" });

              setTempNickname(''); 
              Alert.alert(
                lang === 'ph' ? "Sesyon Kumpleto!" : "Session Completed!", 
                lang === 'ph' ? "Ang QR Code Progress Matrix ay handa na para ma-scan sa ibaba." : "The QR Code Progress Matrix is ready for scanning below."
              );
            } catch (error) {
              console.error(error);
            } finally {
              setUpdatingSession(false);
            }
          }
        }
      ]
    );
  };

  const handleViewPastQR = (qrString: string) => {
    setSelectedPastQR(qrString);
    setSessionReportData(''); 
  };

  const activeQRToShow = selectedPastQR || sessionReportData;
  const decodedObj = activeQRToShow ? JSON.parse(activeQRToShow) : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* HEADER CONTROLS */}
        <View style={styles.header}>
          <View>
            <Text style={styles.dashboardSubtitle}>
              {isAdmin ? (lang === 'ph' ? 'KONTROL NG SISTEMA' : 'SYSTEM CONTROL') : (lang === 'ph' ? 'KONTROL NG SESYON' : 'SESSION CONTROL')}
            </Text>
            <Text style={styles.userName}>{isAdmin ? (lang === 'ph' ? 'Guro Dashboard (Admin)' : 'Teacher Dashboard (Admin)') : (lang === 'ph' ? 'Guro Dashboard' : 'Teacher Dashboard')}</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleTeacherLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={styles.logoutText}>{lang === 'ph' ? 'Alis' : 'Logout'}</Text>
          </TouchableOpacity>
        </View>

        {/* CURRENT LIVE SESSION CARD */}
        <View style={[styles.classCard, !activeStudentAvatar && styles.classCardInactive]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.classLabel}>{lang === 'ph' ? 'KASALUKUYANG SESYON (MEDIATED LEARNING)' : 'CURRENT SESSION (MEDIATED LEARNING)'}</Text>
              <View style={styles.liveStatus}>
                <View style={[styles.pulseDot, !activeStudentAvatar && { backgroundColor: '#9CA3AF' }]} />
                <Text style={[styles.liveText, !activeStudentAvatar && { color: '#4B5563' }]}>
                  {updatingSession ? (
                    <ActivityIndicator size="small" color="#0369A1" />
                  ) : activeStudentAvatar ? (
                    `${lang === 'ph' ? '👤 Aktibo:' : '👤 Active:'} ${currentSessionNickname} ${ANIMAL_AVATARS.find(a => a.id === activeStudentAvatar)?.emoji || ''}`
                  ) : (
                    lang === 'ph' ? 'Walang Aktibong Estudyante' : 'No Active Learner'
                  )}
                </Text>
              </View>
            </View>
            {activeStudentAvatar && (
              <TouchableOpacity style={styles.stopSessionBtn} onPress={handleEndSessionAndCompileQR} disabled={updatingSession}>
                <MaterialCommunityIcons name="stop-circle" size={30} color="#EF4444" />
                <Text style={styles.stopActionText}>{lang === 'ph' ? 'Tapusin' : 'End & QR'}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* LAUNCH PAD (NETFLIX STYLE) */}
        <View style={styles.netflixContainerCard}>
          <Text style={styles.netflixTitle}>{lang === 'ph' ? 'Simulan ang Pagsasanay' : 'Launch Learning Session'}</Text>
          <Text style={styles.netflixSubtitle}>
            {lang === 'ph' ? 'Mag-assign ng temporaryong avatar at pangalan para sa bagong bata.' : 'Assign a temporary profile setup for the next student session.'}
          </Text>
          <TouchableOpacity 
            style={styles.launchSessionBigBtn} 
            onPress={() => setIsAvatarModalOpen(true)}
            disabled={!!activeStudentAvatar}
          >
            <Ionicons name="play-circle-outline" size={32} color={activeStudentAvatar ? "#666" : "#4ADE80"} />
            <Text style={[styles.launchBtnText, activeStudentAvatar && { color: '#666' }]}>
              {activeStudentAvatar 
                ? (lang === 'ph' ? 'May Kasalukuyang Session' : 'Session In Progress') 
                : (lang === 'ph' ? 'Mag-assign ng Bagong Bata' : 'Select Session Profile')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* --- LANGUAGE SETTINGS CARD (IBINALIK) --- */}
        <View style={styles.settingsList}>
          <TouchableOpacity style={styles.settingRow} onPress={() => setLang(lang === 'ph' ? 'en' : 'ph')}>
            <View style={{flexDirection:'row', alignItems:'center'}}>
              <Ionicons name="language-outline" size={18} color="#333" style={{marginRight:8}} />
              <Text style={{fontWeight:'bold', fontSize: normalize(12)}}>{lang === 'ph' ? 'Palitan ang Wika' : 'Change Language'}</Text>
            </View>
            <Text style={{fontWeight:'900', color:'#F77F67', fontSize: normalize(12)}}>{lang === 'ph' ? 'FILIPINO' : 'ENGLISH'}</Text>
          </TouchableOpacity>
        </View>

        {/* --- DYNAMIC QR MATRIX DISPLAY --- */}
        <View style={styles.qrContainerCard}>
          <View style={styles.qrHeader}>
            <Ionicons name="qr-code-outline" size={18} color="#333" style={{ marginRight: 8 }} />
            <Text style={styles.qrTitle}>
              {selectedPastQR 
                ? (lang === 'ph' ? '📋 Nakalipas na QR Report Area' : '📋 Past QR Report Area') 
                : (lang === 'ph' ? '🎯 Aktibong QR Progress Report' : '🎯 Active QR Progress Report')}
            </Text>
          </View>
          
          <Text style={styles.qrDescription}>
            {lang === 'ph' 
              ? 'I-scan ito ng magulang para awtomatikong maging portal at mailipat ang score metrics at ma-unlock ang practice mode sa bahay offline.' 
              : 'Let parents scan this code to serve as a portal, securely porting matrix data and unlocking local home practice mode.'}
          </Text>

          <View style={styles.qrWrapper}>
            {activeQRToShow && decodedObj ? (
              <View style={{ alignItems: 'center' }}>
                <QRCode value={activeQRToShow} size={normalize(140)} backgroundColor="white" color="black" />
                <Text style={styles.qrGeneratedAlert}>
                  {`✓ Data Compiled for: ${decodedObj.nickname} (${ANIMAL_AVATARS.find(a => a.id === decodedObj.avatar)?.emoji})`}
                </Text>
                <Text style={{ fontSize: normalize(9), color: '#666', marginTop: 2 }}>
                  {`Accuracy: ${decodedObj.accuracy} | Duration: ${decodedObj.duration}`}
                </Text>
                {selectedPastQR && (
                  <TouchableOpacity style={styles.resetViewBtn} onPress={() => setSelectedPastQR(null)}>
                    <Text style={styles.resetViewBtnText}>{lang === 'ph' ? 'I-clear at Bumalik' : 'Clear & Return'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={{ alignItems: 'center', padding: 15 }}>
                <MaterialCommunityIcons name="qr-code-scan" size={40} color="#D1D5DB" />
                <Text style={{ color: '#9CA3AF', fontSize: normalize(10), marginTop: 8, textAlign: 'center' }}>
                  {lang === 'ph' 
                    ? 'Tapusin ang kasalukuyang laro sa itaas o pumili ng bata sa history list sa ibaba upang mag-load ng QR code.' 
                    : 'End the live active learning session or tap any past student profile below to load their compiled QR code.'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* --- PAST HISTORY LOGS CARD --- */}
        <View style={styles.historyContainerCard}>
          <Text style={styles.historyTitle}>{lang === 'ph' ? '📋 Katatapos lang na Sessions (Temporary Matrix)' : '📋 Recently Completed Sessions (Temporary RAM Logs)'}</Text>
          <Text style={styles.historySubtitle}>
            {lang === 'ph' ? 'Piliin muli sina Danfort o Sherlyn para ma-reload ang kanilang QR sa itaas kung sakaling hindi pa na-scan ng magulang.' : 'Select past student instances to re-load their offline QR matrices in case parents need to scan them later.'}
          </Text>
          
          {recentSessions.length === 0 ? (
            <Text style={styles.emptyHistoryText}>{lang === 'ph' ? 'Walang nakalipas na session sa memorya.' : 'No available records in temporary runtime memory.'}</Text>
          ) : (
            recentSessions.map((session, index) => (
              <TouchableOpacity 
                key={index} 
                style={[styles.historyRow, selectedPastQR === session.qrValue && styles.historyRowSelected]}
                onPress={() => handleViewPastQR(session.qrValue)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: normalize(20), marginRight: 10 }}>
                    {ANIMAL_AVATARS.find(a => a.id === session.avatar)?.emoji || '👤'}
                  </Text>
                  <View>
                    <Text style={styles.historyName}>{session.nickname}</Text>
                    <Text style={styles.historyMeta}>{`${lang === 'ph' ? 'Oras' : 'Time'}: ${session.timestamp} | ${lang === 'ph' ? 'Tumpak' : 'Acc'}: ${session.accuracy}`}</Text>
                  </View>
                </View>
                <Ionicons name="eye-outline" size={18} color="#0369A1" />
              </TouchableOpacity>
            ))
          )}
        </View>

      </ScrollView>

      {/* --- AVATAR & NICKNAME PICKER MODAL --- */}
      <Modal visible={isAvatarModalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{lang === 'ph' ? 'Sino ang Susunod na Gagamit?' : 'Who is the Next Student User?'}</Text>
              <TouchableOpacity onPress={() => setIsAvatarModalOpen(false)}>
                <Ionicons name="close-circle" size={26} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputFieldLabel}>{lang === 'ph' ? 'TEMPORARY NICKNAME NG BATA (HAL. DANFORT / SHERLYN):' : 'TEMPORARY CHILD NICKNAME (E.G., DANFORT / SHERLYN):'}</Text>
            <TextInput
              style={styles.nicknameInput}
              placeholder={lang === 'ph' ? "I-type ang pangalan ng bata dito..." : "Type child nickname here..."}
              placeholderTextColor="#666"
              value={tempNickname}
              onChangeText={setTempNickname}
              autoCapitalize="words"
              maxLength={15}
            />

            <Text style={styles.modalSectionLabel}>{lang === 'ph' ? 'PUMILI NG TEMPORARYONG AVATAR ICON:' : 'ASSIGN TEMPORARY ANIMAL AVATAR ICONS:'}</Text>
            <ScrollView contentContainerStyle={styles.modalAvatarGrid} showsVerticalScrollIndicator={false}>
              {ANIMAL_AVATARS.map((item) => (
                <TouchableOpacity key={item.id} style={styles.modalAvatarItem} onPress={() => handleSelectAvatarSession(item.id)}>
                  <Text style={{fontSize: normalize(28)}}>{item.emoji}</Text>
                  <Text style={styles.avatarLabelText}>{item.id}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB' },
  scrollContent: { paddingHorizontal: '5%', paddingTop: 20, paddingBottom: 110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  dashboardSubtitle: { fontSize: normalize(9), color: '#9CA3AF', fontWeight: 'bold', textTransform: 'uppercase' },
  userName: { fontSize: normalize(15), fontWeight: '900', color: '#333', marginTop: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  logoutText: { color: '#EF4444', fontWeight: 'bold', fontSize: normalize(10), marginLeft: 4 },
  classCard: { backgroundColor: '#E0F2FE', borderRadius: 30, padding: 22, marginBottom: 20 },
  classCardInactive: { backgroundColor: '#F3F4F6' },
  classLabel: { color: 'rgba(0,0,0,0.4)', fontSize: 9, fontWeight: 'bold' },
  liveStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80', marginRight: 6 },
  liveText: { color: '#0369A1', fontSize: normalize(13), fontWeight: '900' },
  stopSessionBtn: { alignItems: 'center', justifyContent: 'center' },
  stopActionText: { color: '#EF4444', fontSize: normalize(9), fontWeight: '900' },
  
  netflixContainerCard: { backgroundColor: '#141414', borderRadius: 25, padding: 20, marginBottom: 15, alignItems: 'center' },
  netflixTitle: { color: '#FFFFFF', fontSize: normalize(14), fontWeight: 'bold' },
  netflixSubtitle: { color: '#9CA3AF', fontSize: normalize(9), textAlign: 'center', marginTop: 4, marginBottom: 10, paddingHorizontal: 10 },
  launchSessionBigBtn: { flexDirection: 'row', backgroundColor: '#1F1F1F', width: '100%', borderRadius: 15, padding: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333', marginTop: 10 },
  launchBtnText: { color: '#4ADE80', fontWeight: 'bold', fontSize: normalize(12), marginLeft: 10 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#1F1F1F', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, height: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: 'white', fontSize: normalize(13), fontWeight: 'bold' },
  inputFieldLabel: { color: '#9CA3AF', fontSize: normalize(9), fontWeight: 'bold', marginBottom: 8 },
  nicknameInput: { backgroundColor: '#2B2B2B', borderRadius: 12, padding: 15, color: 'white', fontSize: normalize(12), marginBottom: 20, borderWidth: 1, borderColor: '#444' },
  modalSectionLabel: { color: '#EF4444', fontSize: normalize(9), fontWeight: '900', marginBottom: 15 },
  modalAvatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: 20 },
  modalAvatarItem: { width: '22%', aspectRatio: 0.9, backgroundColor: '#2B2B2B', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarLabelText: { color: '#9CA3AF', fontSize: normalize(8), textTransform: 'uppercase', marginTop: 4, fontWeight: 'bold' },

  settingsList: { backgroundColor: 'white', borderRadius: 25, padding: 15, marginBottom: 15 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },

  qrContainerCard: { backgroundColor: 'white', borderRadius: 25, padding: 20, marginBottom: 15 },
  qrHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  qrTitle: { fontSize: normalize(12), fontWeight: '900', color: '#333' },
  qrDescription: { fontSize: normalize(9), color: '#666', marginBottom: 15, lineHeight: 15 },
  qrWrapper: { alignItems: 'center', justifyContent: 'center', paddingVertical: 15, backgroundColor: '#FAFAFA', borderRadius: 18, borderWidth: 1, borderColor: '#F3F4F6' },
  qrGeneratedAlert: { color: '#16A34A', fontSize: normalize(11), fontWeight: 'bold', marginTop: 12, textAlign: 'center' },
  resetViewBtn: { marginTop: 10, backgroundColor: '#E0F2FE', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  resetViewBtnText: { color: '#0369A1', fontSize: normalize(10), fontWeight: 'bold' },

  historyContainerCard: { backgroundColor: 'white', borderRadius: 25, padding: 20, marginBottom: 15 },
  historyTitle: { fontSize: normalize(12), fontWeight: '900', color: '#333', marginBottom: 4 },
  historySubtitle: { fontSize: normalize(9), color: '#666', marginBottom: 15, lineHeight: 14 },
  emptyHistoryText: { fontSize: normalize(10), color: '#9CA3AF', textAlign: 'center', marginVertical: 15 },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#FAFAFA', borderRadius: 15, marginBottom: 8, borderWidth: 1, borderColor: '#F3F4F6' },
  historyRowSelected: { borderColor: '#0369A1', backgroundColor: '#F0F9FF' },
  historyName: { fontSize: normalize(12), fontWeight: 'bold', color: '#333' },
  historyMeta: { fontSize: normalize(9), color: '#666', marginTop: 2 }
});