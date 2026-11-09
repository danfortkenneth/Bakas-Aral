import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  PixelRatio, 
  Dimensions, 
  ActivityIndicator, 
  Alert, 
  Modal, 
  TextInput 
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage } from '../_layout'; 
import { useRouter } from 'expo-router'; 
import { auth, db } from '../../lib/firebase';
import { 
  doc, 
  updateDoc, 
  onSnapshot, 
  collection, 
  addDoc, 
  serverTimestamp
} from 'firebase/firestore';
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

interface Student {
  id: string;
  fullName: string;
  avatar: string;
}

interface PastSession {
  id?: string;
  studentId?: string;
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
  
  const [teacherFirstName, setTeacherFirstName] = useState<string>('');
  const [activeStudentAvatar, setActiveStudentAvatar] = useState<string | null>(null); 
  const [updatingSession, setUpdatingSession] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [isAddingNewStudent, setIsAddingNewStudent] = useState(false);
  const [newFullName, setNewFullName] = useState<string>('');
  const [newSelectedAvatar, setNewSelectedAvatar] = useState<string>('lion');

  const [sessionReportData, setSessionReportData] = useState<string>(''); 
  const [recentSessions, setRecentSessions] = useState<PastSession[]>([]);
  const [selectedPastQR, setSelectedPastQR] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeTeacherDoc: () => void = () => {};
    let unsubscribeStudents: () => void = () => {};
    let unsubscribeCompletedSessions: () => void = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const rawName = user.displayName || user.email?.split('@')[0] || "Guro";
        const initialFirstName = rawName.trim().split(' ')[0];
        setTeacherFirstName(initialFirstName);

        const teacherRef = doc(db, "users", user.uid);
        unsubscribeTeacherDoc = onSnapshot(teacherRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setRole(data.role || 'teacher');
            if (data.fullName) {
              const extractedFirstName = data.fullName.trim().split(' ')[0];
              setTeacherFirstName(extractedFirstName);
            }
            setActiveStudentAvatar(data.activeStudentAvatar || null);
            
            if (data.activeStudentName) {
              setSelectedStudent({
                id: data.activeStudentId || 'N/A',
                fullName: data.activeStudentName,
                avatar: data.activeStudentAvatar || 'lion'
              });
            }
          }
        });

        const studentsColRef = collection(db, "users", user.uid, "students");
        unsubscribeStudents = onSnapshot(studentsColRef, (snapshot) => {
          const loadedStudents: Student[] = snapshot.docs.map(docSnap => ({
            id: docSnap.id,
            fullName: docSnap.data().fullName || '',
            avatar: docSnap.data().avatar || 'lion',
          }));
          setStudents(loadedStudents);
        });

        const historyColRef = collection(db, "users", user.uid, "completed_sessions");
        unsubscribeCompletedSessions = onSnapshot(historyColRef, (snapshot) => {
          const loadedHistory: PastSession[] = snapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              studentId: data.studentId,
              nickname: data.nickname || 'Estudyante',
              avatar: data.avatar || 'lion',
              accuracy: data.accuracy || '0%',
              duration: data.duration || '0s',
              timestamp: data.timestamp || '',
              qrValue: data.qrValue || '',
              rawCreatedAt: data.createdAt ? data.createdAt.toMillis?.() || 0 : 0
            };
          }).sort((a, b) => b.rawCreatedAt - a.rawCreatedAt);

          setRecentSessions(loadedHistory);
        }, (error) => {
          console.warn("Firestore completed_sessions listener error:", error.message);
        });

      } else {
        setTeacherFirstName('');
        setStudents([]);
        setRecentSessions([]);
      }
    });

    return () => { 
      unsubscribeAuth(); 
      unsubscribeTeacherDoc(); 
      unsubscribeStudents();
      unsubscribeCompletedSessions();
    };
  }, []);

  const handleTeacherLogout = () => {
    Alert.alert(
      lang === 'ph' ? 'Mag-logout' : 'Logout',
      lang === 'ph' ? 'Sigurado ka bang aalis ka?' : 'Are you sure you want to log out?',
      [
        { text: lang === 'ph' ? 'Hindi' : 'Cancel', style: 'cancel' },
        { 
          text: lang === 'ph' ? 'Oo' : 'Yes', 
          style: 'destructive',
          onPress: async () => {
            try { 
              await signOut(auth); 
              router.replace('/(auth)/user-selection'); 
            } catch (error: any) { 
              Alert.alert("Error", error.message); 
            }
          }
        }
      ]
    );
  };

  const handleAddNewStudentToFirebase = async () => {
    if (!newFullName.trim()) {
      Alert.alert(
        lang === 'ph' ? "Kailangan ng Buong Pangalan" : "Full Name Required", 
        lang === 'ph' ? "I-type ang tunay na pangalan ng estudyante." : "Please enter the student's full name."
      );
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      setUpdatingSession(true);
      const studentsColRef = collection(db, "users", currentUser.uid, "students");
      
      await addDoc(studentsColRef, {
        fullName: newFullName.trim(),
        avatar: newSelectedAvatar,
        createdAt: serverTimestamp()
      });

      setNewFullName('');
      setIsAddingNewStudent(false);
      Alert.alert(
        lang === 'ph' ? "Naidagdag na!" : "Student Added!", 
        lang === 'ph' ? "Ligtas nang nakatago ang estudyante sa Firebase database." : "Student saved successfully to Firebase."
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Hindi naisave ang estudyante.");
    } finally {
      setUpdatingSession(false);
    }
  };

  const handleStartSessionWithStudent = async (student: Student) => {
    const currentUser = auth.currentUser;
    if (!currentUser || updatingSession) return;

    setUpdatingSession(true);
    try {
      const teacherRef = doc(db, "users", currentUser.uid);
      await updateDoc(teacherRef, { 
        activeStudentAvatar: student.avatar, 
        activeStudentId: student.id,
        activeStudentName: student.fullName,
        sessionStatus: "active" 
      });

      setSelectedStudent(student); 
      setIsAvatarModalOpen(false);
      setSessionReportData(''); 
      setSelectedPastQR(null); 

      Alert.alert(
        lang === 'ph' ? "Sesyon Nagsimula!" : "Session Started!", 
        lang === 'ph' ? `Aktibo na si ${student.fullName} sa Tablet.` : `Session is now active for ${student.fullName} on Tablet.`
      );
    } catch (error) {
      Alert.alert("Error", "Hindi ma-isave ang sesyon.");
    } finally {
      setUpdatingSession(false);
    }
  };

  // 🎯 UPDATE: KUMPLETONG PROGRESS REPORT SCHEME PARA SA QR CODE
  const handleEndSessionAndCompileQR = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !activeStudentAvatar) return;

    Alert.alert(
      lang === 'ph' ? "Tapusin ang Sesyon" : "End Session",
      lang === 'ph' ? "Nais mo bang tapusin ang sesyon at i-compile ang buong Progress Report sa QR Code?" : "Do you want to end session and compile complete progress report to QR Code?",
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
              const activeName = selectedStudent?.fullName || "Estudyante";
              const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              const reportObj = {
                appIdentifier: "BAKAS_ARAL_PARENT_SYNC",
                teacherName: teacherFirstName,
                studentId: selectedStudent?.id || "N/A",
                nickname: activeName,
                avatar: activeStudentAvatar,
                accuracy: `${simulatedAccuracy}%`,
                duration: `${simulatedTime}s`,
                starsEarned: simulatedAccuracy >= 90 ? 3 : (simulatedAccuracy >= 75 ? 2 : 1),
                unlockedStickers: ['A', 'B'],
                charBreakdown: {
                  'A': { accuracy: `${simulatedAccuracy}%`, status: 'DONE' },
                  'B': { accuracy: '88%', status: 'DONE' }
                },
                timestamp: timeString,
                school: "Bakas-Aral Learning Center" 
              };

              const rawJsonString = JSON.stringify(reportObj);
              setSessionReportData(rawJsonString);

              const historyColRef = collection(db, "users", currentUser.uid, "completed_sessions");
              await addDoc(historyColRef, {
                studentId: selectedStudent?.id || "N/A",
                nickname: activeName,
                avatar: activeStudentAvatar,
                accuracy: reportObj.accuracy,
                duration: reportObj.duration,
                timestamp: timeString,
                qrValue: rawJsonString,
                createdAt: serverTimestamp()
              });

              if (selectedStudent?.id) {
                const rootSessionsRef = collection(db, "sessions");
                await addDoc(rootSessionsRef, {
                  userId: selectedStudent.id,
                  teacherId: currentUser.uid,
                  accuracy: simulatedAccuracy,
                  durationSeconds: simulatedTime,
                  letterOrNumber: 'A',
                  createdAt: serverTimestamp()
                });
              }

              const teacherRef = doc(db, "users", currentUser.uid);
              await updateDoc(teacherRef, { 
                activeStudentAvatar: null, 
                activeStudentId: null,
                activeStudentName: null,
                sessionStatus: "completed" 
              });

              Alert.alert(
                lang === 'ph' ? "Sesyon Kumpleto!" : "Session Completed!", 
                lang === 'ph' ? `Handa na ang Buong Progress Report QR Code para kay ${activeName}.` : `Full Progress Report QR Code is ready for ${activeName}.`
              );
            } catch (error: any) {
              Alert.alert("Error", error.message || "Hindi ma-isave ang nakalipas na session.");
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
  let decodedObj: any = null;
  if (activeQRToShow) {
    try {
      decodedObj = JSON.parse(activeQRToShow);
    } catch (e) {
      decodedObj = null;
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <View>
            <Text style={styles.dashboardSubtitle}>
              {isAdmin ? (lang === 'ph' ? 'KONTROL NG SISTEMA' : 'SYSTEM CONTROL') : (lang === 'ph' ? 'KONTROL NG SESYON' : 'SESSION CONTROL')}
            </Text>
            <Text style={styles.userName}>
              {teacherFirstName 
                ? `${lang === 'ph' ? 'Maligayang Pagbabalik,' : 'Welcome back,'} ${teacherFirstName}!`
                : (lang === 'ph' ? 'Maligayang Pagdating, Guro!' : 'Welcome, Teacher!')}
            </Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleTeacherLogout} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            <Text style={styles.logoutText}>{lang === 'ph' ? 'Alis' : 'Logout'}</Text>
          </TouchableOpacity>
        </View>

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
                    `${lang === 'ph' ? '👤 Aktibo:' : '👤 Active:'} ${selectedStudent?.fullName || 'Estudyante'} ${ANIMAL_AVATARS.find(a => a.id === activeStudentAvatar)?.emoji || ''}`
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

        <View style={styles.netflixContainerCard}>
          <Text style={styles.netflixTitle}>{lang === 'ph' ? 'Pumili sa Nakatagong Estudyante' : 'Select Registered Student'}</Text>
          <Text style={styles.netflixSubtitle}>
            {lang === 'ph' ? 'Pumili sa listahan sa Firebase o magdagdag ng bagong tunay na estudyante.' : 'Choose from Firebase list or register a new student record.'}
          </Text>
          <TouchableOpacity 
            style={styles.launchSessionBigBtn} 
            onPress={() => setIsAvatarModalOpen(true)}
            disabled={!!activeStudentAvatar}
          >
            <Ionicons name="people-circle-outline" size={30} color={activeStudentAvatar ? "#666" : "#4ADE80"} />
            <Text style={[styles.launchBtnText, activeStudentAvatar && { color: '#666' }]}>
              {activeStudentAvatar 
                ? (lang === 'ph' ? 'May Kasalukuyang Session' : 'Session In Progress') 
                : (lang === 'ph' ? 'Buksan ang Listahan ng Estudyante' : 'Open Student Directory')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.settingsList}>
          <TouchableOpacity style={styles.settingRow} onPress={() => setLang(lang === 'ph' ? 'en' : 'ph')}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="language-outline" size={18} color="#333" style={{ marginRight: 8 }} />
              <Text style={{ fontWeight: 'bold', fontSize: normalize(12) }}>{lang === 'ph' ? 'Palitan ang Wika' : 'Change Language'}</Text>
            </View>
            <Text style={{ fontWeight: '900', color: '#F77F67', fontSize: normalize(12) }}>{lang === 'ph' ? 'FILIPINO' : 'ENGLISH'}</Text>
          </TouchableOpacity>
        </View>

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
              ? 'I-scan ito ng magulang para awtomatikong mailipat ang buong ulat sa pag-unlad ng estudyante patungo sa parent app.' 
              : 'Let parents scan this code to securely sync full student metrics to the parent app offline.'}
          </Text>

          <View style={styles.qrWrapper}>
            {activeQRToShow && decodedObj ? (
              <View style={{ alignItems: 'center' }}>
                <QRCode value={activeQRToShow} size={normalize(140)} backgroundColor="white" color="black" />
                <Text style={styles.qrGeneratedAlert}>
                  {`✓ Data Compiled for: ${decodedObj.nickname} (${ANIMAL_AVATARS.find(a => a.id === decodedObj.avatar)?.emoji || ''})`}
                </Text>
                <Text style={{ fontSize: normalize(9), color: '#666', marginTop: 2 }}>
                  {`Teacher: ${decodedObj.teacherName || teacherFirstName} | Accuracy: ${decodedObj.accuracy}`}
                </Text>
                {selectedPastQR && (
                  <TouchableOpacity style={styles.resetViewBtn} onPress={() => setSelectedPastQR(null)}>
                    <Text style={styles.resetViewBtnText}>{lang === 'ph' ? 'I-clear at Bumalik' : 'Clear & Return'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={{ alignItems: 'center', padding: 15 }}>
                <MaterialCommunityIcons name="qrcode-scan" size={40} color="#D1D5DB" />
                <Text style={{ color: '#9CA3AF', fontSize: normalize(10), marginTop: 8, textAlign: 'center' }}>
                  {lang === 'ph' 
                    ? 'Tapusin ang kasalukuyang laro sa itaas o pumili ng bata sa history list sa ibaba upang mag-load ng QR code.' 
                    : 'End the live active learning session or tap any past student profile below to load their compiled QR code.'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.historyContainerCard}>
          <Text style={styles.historyTitle}>{lang === 'ph' ? '📋 Katatapos lang na Sessions' : '📋 Recently Completed Sessions'}</Text>
          <Text style={styles.historySubtitle}>
            {lang === 'ph' ? 'Piliin ang nakalipas na estudyante upang muling i-load ang kanilang QR code.' : 'Select past student instances to re-load their offline QR matrices.'}
          </Text>
          
          {recentSessions.length === 0 ? (
            <Text style={styles.emptyHistoryText}>{lang === 'ph' ? 'Walang nakaimbak na nakalipas na session sa Firestore database.' : 'No completed sessions stored in Firestore.'}</Text>
          ) : (
            recentSessions.map((session) => (
              <TouchableOpacity 
                key={session.id} 
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

      <Modal visible={isAvatarModalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isAddingNewStudent 
                  ? (lang === 'ph' ? 'Magrehistro ng Bagong Estudyante' : 'Register New Student') 
                  : (lang === 'ph' ? 'Pumili ng Estudyante mula sa Firebase' : 'Select Student from Firebase')}
              </Text>
              <TouchableOpacity onPress={() => { setIsAvatarModalOpen(false); setIsAddingNewStudent(false); }}>
                <Ionicons name="close-circle" size={26} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            {isAddingNewStudent ? (
              <View>
                <Text style={styles.inputFieldLabel}>{lang === 'ph' ? 'TUNAY NA BUONG PANGALAN NG ESTUDYANTE:' : 'STUDENT FULL NAME:'}</Text>
                <TextInput
                  style={styles.nicknameInput}
                  placeholder={lang === 'ph' ? "Halimbawa: Juan Cruz" : "E.g., Juan Cruz"}
                  placeholderTextColor="#666"
                  value={newFullName}
                  onChangeText={setNewFullName}
                  autoCapitalize="words"
                />

                <Text style={styles.modalSectionLabel}>{lang === 'ph' ? 'PUMILI NG AVATAR ICON:' : 'SELECT AVATAR ICON:'}</Text>
                <ScrollView contentContainerStyle={styles.modalAvatarGrid} style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                  {ANIMAL_AVATARS.map((item) => (
                    <TouchableOpacity 
                      key={item.id} 
                      style={[
                        styles.modalAvatarItem, 
                        newSelectedAvatar === item.id && { borderColor: '#4ADE80', borderWidth: 2 }
                      ]} 
                      onPress={() => setNewSelectedAvatar(item.id)}
                    >
                      <Text style={{ fontSize: normalize(24) }}>{item.emoji}</Text>
                      <Text style={styles.avatarLabelText}>{item.id}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }}>
                  <TouchableOpacity 
                    style={styles.cancelAddBtn} 
                    onPress={() => setIsAddingNewStudent(false)}
                  >
                    <Text style={{ color: '#FFF', fontWeight: 'bold' }}>{lang === 'ph' ? 'Bumalik' : 'Back'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.saveStudentBtn} 
                    onPress={handleAddNewStudentToFirebase}
                    disabled={updatingSession}
                  >
                    {updatingSession ? (
                      <ActivityIndicator color="#000" />
                    ) : (
                      <Text style={{ color: '#000', fontWeight: 'bold' }}>{lang === 'ph' ? 'I-save sa Firebase' : 'Save to Firebase'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <TouchableOpacity 
                  style={styles.addNewStudentHeaderBtn} 
                  onPress={() => setIsAddingNewStudent(true)}
                >
                  <Ionicons name="person-add-outline" size={20} color="#4ADE80" />
                  <Text style={styles.addNewStudentText}>
                    {lang === 'ph' ? '+ Magdagdag ng Bagong Estudyante' : '+ Add New Student to Database'}
                  </Text>
                </TouchableOpacity>

                {students.length === 0 ? (
                  <View style={{ alignItems: 'center', marginVertical: 30 }}>
                    <Text style={{ color: '#9CA3AF', fontSize: normalize(11) }}>
                      {lang === 'ph' ? 'Walang nakaimbak na estudyante sa Firebase.' : 'No stored students in Firebase database.'}
                    </Text>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                    {students.map((student) => (
                      <TouchableOpacity 
                        key={student.id} 
                        style={styles.studentListCard}
                        onPress={() => handleStartSessionWithStudent(student)}
                      >
                        <Text style={{ fontSize: normalize(24), marginRight: 12 }}>
                          {ANIMAL_AVATARS.find(a => a.id === student.avatar)?.emoji || '👤'}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.studentListName}>{student.fullName}</Text>
                          <Text style={styles.studentListSub}>ID: {student.id.substring(0, 8)}...</Text>
                        </View>
                        <Ionicons name="play-circle" size={26} color="#4ADE80" />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

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

  addNewStudentHeaderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2B2B2B', padding: 12, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#4ADE80' },
  addNewStudentText: { color: '#4ADE80', fontWeight: 'bold', fontSize: normalize(11), marginLeft: 8 },
  studentListCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2B2B2B', borderRadius: 12, padding: 12, marginBottom: 10 },
  studentListName: { color: 'white', fontWeight: 'bold', fontSize: normalize(12) },
  studentListSub: { color: '#9CA3AF', fontSize: normalize(9), marginTop: 2 },
  cancelAddBtn: { backgroundColor: '#333', padding: 12, borderRadius: 10, width: '45%', alignItems: 'center' },
  saveStudentBtn: { backgroundColor: '#4ADE80', padding: 12, borderRadius: 10, width: '45%', alignItems: 'center' },

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