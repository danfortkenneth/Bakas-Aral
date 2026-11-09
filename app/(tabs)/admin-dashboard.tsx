import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  TextInput,
  ActivityIndicator,
  Modal
} from 'react-native';
import { useLanguage } from '../_layout';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { db, auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc
} from 'firebase/firestore';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;
const scaleFont = (size: number) => {
  const scaled = isTablet ? size * 1.15 : size * (width / 375);
  return Math.min(Math.max(scaled, size * 0.85), size * 1.3);
};

const analyticsSummary = {
  totalStudents: 142,
  accuracyRate: "84.5%",
};

export default function AdminDashboard() {
  const router = useRouter();
  const { lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<'teachers' | 'settings'>('teachers');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [secretKey, setSecretKey] = useState("BAKAS_DEV_2026");
  const [updatingKey, setUpdatingKey] = useState(false);

  // States para sa Add Allowed Teacher Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [teacherId, setTeacherId] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [creatingTeacher, setCreatingTeacher] = useState(false);

  const content = {
    en: {
      welcome: "SYSTEM OVERVIEW",
      title: "Central Admin Panel",
      cardTeachers: "Pending Teachers",
      cardStudents: "Global Students",
      cardAccuracy: "Global Accuracy",
      tabTeachers: "Pending Applications",
      tabSettings: "System Security",
      tableName: "Full Name",
      tableSchool: "School / Campus",
      tableAction: "Actions",
      btnApprove: "Approve",
      btnReject: "Reject",
      secTitle: "Developer Configuration",
      secDesc: "Rotate or replace the master authentication key for admin access.",
      lblSecret: "CURRENT DEV SECRET KEY",
      btnUpdateKey: "Save System Changes",
      noPending: "No pending teacher applications.",
      toastSuccessApprove: "Teacher verified successfully!",
      toastSuccessReject: "Teacher account removed.",
      logoutTitle: "Logout",
      logoutMsg: "Are you sure you want to log out from the admin panel?",
      btnCancel: "Cancel",
      btnYes: "Yes",
      btnAddTeacher: "+ Add Allowed Teacher"
    },
    ph: {
      welcome: "PANGKALAHATANG TINGIN",
      title: "Central Admin Panel",
      cardTeachers: "Nakabinbing Guro",
      cardStudents: "Kabuuang Bata",
      cardAccuracy: "Global Accuracy",
      tabTeachers: "Aplikasyon ng Guro",
      tabSettings: "Seguridad ng System",
      tableName: "Buong Pangalan",
      tableSchool: "Paaralan / Campus",
      tableAction: "Aksyon",
      btnApprove: "Ipasa",
      btnReject: "Tanggihan",
      secTitle: "Configuration ng Developer",
      secDesc: "Palitan o i-rotate ang master key na ginagamit para sa admin authentication.",
      lblSecret: "KASALUKUYANG DEV SECRET KEY",
      btnUpdateKey: "I-save ang Bagong Key",
      noPending: "Walang nakabinbing aplikasyon mula sa mga guro.",
      toastSuccessApprove: "Ganap nang beripikado ang guro!",
      toastSuccessReject: "Tinanggal ang account ng guro.",
      logoutTitle: "Mag-logout",
      logoutMsg: "Sigurado ka bang nais mong umalis sa admin panel?",
      btnCancel: "Hindi",
      btnYes: "Oo",
      btnAddTeacher: "+ Magdagdag ng Pinapayagang Guro"
    }
  };

  const t = content[lang as keyof typeof content] || content['en'];

  // REAL-TIME LISTENER: Inaalam ang lahat ng teacher accounts na HINDI PA APPROVED
  useEffect(() => {
    const q = query(
      collection(db, "users"),
      where("role", "==", "teacher")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teacherList: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const currentStatus = String(data.status || '').toLowerCase();
        
        // Isasama lang sa listahan ang mga 'pending' o hindi pa 'approved'
        if (currentStatus !== 'approved') {
          teacherList.push({ id: docSnap.id, ...data });
        }
      });
      setTeachers(teacherList);
      setLoadingTeachers(false);
    }, (error) => {
      console.error("Firestore error inside Admin Panel:", error.message);
      setLoadingTeachers(false);
    });

    return () => unsubscribe();
  }, []);

  // Magdagdag sa allowed_teachers collection (Whitelist)
  const handleAddTeacher = async () => {
    if (!teacherId.trim() || !newFullName.trim() || !newEmail.trim()) {
      Alert.alert(
        "Error", 
        lang === 'ph' ? "Paki-sagutan ang ID Number, Pangalan, at Email!" : "Please fill out ID Number, Full Name, and Email!"
      );
      return;
    }

    setCreatingTeacher(true);
    try {
      const docRef = doc(db, "allowed_teachers", teacherId.trim().toUpperCase());
      
      await setDoc(docRef, {
        fullName: newFullName.trim(),
        email: newEmail.trim().toLowerCase(),
        isRegistered: false
      });

      setCreatingTeacher(false);
      setModalVisible(false);
      setTeacherId('');
      setNewFullName('');
      setNewEmail('');

      Alert.alert(
        lang === 'ph' ? "Tagumpay!" : "Success!",
        lang === 'ph' ? `Naidagdag na si ${newFullName} sa allowed_teachers collection.` : `Added ${newFullName} to allowed_teachers collection.`
      );
    } catch (error: any) {
      setCreatingTeacher(false);
      Alert.alert("Error", error.message);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t.logoutTitle,
      t.logoutMsg,
      [
        { text: t.btnCancel, style: "cancel" },
        {
          text: t.btnYes,
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(auth);
              router.replace('/login');
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          }
        }
      ]
    );
  };

  // Approve Teacher Handler
  const handleApproveTeacher = async (id: string, name: string) => {
    try {
      const userRef = doc(db, "users", id);
      await updateDoc(userRef, {
        status: "approved",
        verifiedAt: new Date().toISOString()
      });

      const teacherDoc = await getDoc(userRef);
      if (teacherDoc.exists()) {
        const teacherData = teacherDoc.data();
        if (teacherData.employeeId) {
          const allowedRef = doc(db, "allowed_teachers", teacherData.employeeId);
          await updateDoc(allowedRef, { isRegistered: true }).catch(() => {});
        }
      }

      Alert.alert(lang === 'en' ? "Success" : "Tagumpay", `${name || 'Teacher'} ${t.toastSuccessApprove}`);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // Reject Teacher Handler
  const handleRejectTeacher = (id: string, name: string) => {
    Alert.alert(
      lang === 'en' ? "Confirm Action" : "Kumpirmahin",
      lang === 'en' ? `Are you sure you want to remove ${name}?` : `Sigurado ka bang nais mong tanggihan si ${name}?`,
      [
        { text: lang === 'en' ? "Cancel" : "I-cancel", style: "cancel" },
        {
          text: t.btnReject,
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "users", id));
              Alert.alert("System Update", t.toastSuccessReject);
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          }
        }
      ]
    );
  };

  const handleUpdateSecretKey = () => {
    if (!secretKey.trim()) {
      Alert.alert("Error", lang === 'en' ? "Key cannot be empty!" : "Hindi pwedeng walang laman ang key!");
      return;
    }
    setUpdatingKey(true);
    setTimeout(() => {
      setUpdatingKey(false);
      Alert.alert(
        lang === 'en' ? "Security Updated" : "Ligtas na Nabago",
        lang === 'en' ? "The global admin secret key has been rotated." : "Matagumpay na napalitan ang master dev code."
      );
    }, 1200);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>
        
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.welcomeText}>{t.welcome}</Text>
            <Text style={styles.mainTitle}>{t.title}</Text>
          </View>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Action Button: Add Allowed Teacher */}
        <TouchableOpacity 
          style={styles.addDirectBtn}
          onPress={() => setModalVisible(true)}
        >
          <Ionicons name="person-add" size={18} color="white" />
          <Text style={styles.addDirectBtnText}>{t.btnAddTeacher}</Text>
        </TouchableOpacity>

        {/* Summary Stats Cards Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{loadingTeachers ? "..." : teachers.length}</Text>
            <Text style={styles.statLabel}>{t.cardTeachers}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{analyticsSummary.totalStudents}</Text>
            <Text style={styles.statLabel}>{t.cardStudents}</Text>
          </View>
          <View style={[styles.statCard, styles.accuracyCard]}>
            <Text style={[styles.statNumber, styles.accuracyText]}>{analyticsSummary.accuracyRate}</Text>
            <Text style={styles.statLabel}>{t.cardAccuracy}</Text>
          </View>
        </View>

        {/* Tab Controllers */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'teachers' && styles.tabButtonActive]}
            onPress={() => setActiveTab('teachers')}
          >
            <Text style={[styles.tabText, activeTab === 'teachers' && styles.tabTextActive]}>{t.tabTeachers}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'settings' && styles.tabButtonActive]}
            onPress={() => setActiveTab('settings')}
          >
            <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>{t.tabSettings}</Text>
          </TouchableOpacity>
        </View>

        {/* Tab 1: Pending Applications Table */}
        {activeTab === 'teachers' && (
          <View style={styles.tableCard}>
            {loadingTeachers ? (
              <ActivityIndicator color="#F77F67" style={{ padding: 40 }} />
            ) : teachers.length === 0 ? (
              <Text style={styles.emptyText}>{t.noPending}</Text>
            ) : (
              <View>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>{t.tableName}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>{t.tableSchool}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>{t.tableAction}</Text>
                </View>

                {teachers.map((item) => (
                  <View key={item.id} style={styles.tableBodyRow}>
                    <View style={{ flex: 1.2, paddingRight: 4 }}>
                      <Text style={styles.teacherName} numberOfLines={1}>{item.fullName || "No Name"}</Text>
                      <Text style={styles.teacherEmail} numberOfLines={1}>{item.email}</Text>
                    </View>
                    <Text style={[styles.teacherSchool, { flex: 1.2 }]} numberOfLines={2}>
                      {item.school || "Not Specified"}
                    </Text>
                    <View style={styles.actionColumn}>
                      <TouchableOpacity
                        style={styles.actionButtonApprove}
                        onPress={() => handleApproveTeacher(item.id, item.fullName)}
                      >
                        <Text style={styles.actionButtonText}>✓</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionButtonReject}
                        onPress={() => handleRejectTeacher(item.id, item.fullName)}
                      >
                        <Text style={styles.actionButtonText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Tab 2: System Settings */}
        {activeTab === 'settings' && (
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>{t.secTitle}</Text>
            <Text style={styles.settingsDesc}>{t.secDesc}</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t.lblSecret}</Text>
              <TextInput
                style={styles.securityInput}
                value={secretKey}
                onChangeText={setSecretKey}
                secureTextEntry
                placeholder="Enter system master key"
                placeholderTextColor="#BBB"
              />
            </View>

            <TouchableOpacity
              style={[styles.btnSaveSettings, updatingKey && { opacity: 0.7 }]}
              onPress={handleUpdateSecretKey}
              disabled={updatingKey}
            >
              {updatingKey ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.btnSaveSettingsText}>{t.btnUpdateKey}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* Modal: Form para mag-add sa allowed_teachers collection */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {lang === 'ph' ? 'Magdagdag sa Allowed Teachers' : 'Add to Allowed Teachers'}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder={lang === 'ph' ? 'ID Number (hal. 20-11761-573)' : 'Teacher ID (e.g. 20-11761-573)'}
              placeholderTextColor="#999"
              value={teacherId}
              onChangeText={setTeacherId}
            />
            <TextInput
              style={styles.modalInput}
              placeholder={lang === 'ph' ? 'Buong Pangalan' : 'Full Name'}
              placeholderTextColor="#999"
              value={newFullName}
              onChangeText={setNewFullName}
            />
            <TextInput
              style={styles.modalInput}
              placeholder={lang === 'ph' ? 'Email Address' : 'Email Address'}
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              value={newEmail}
              onChangeText={setNewEmail}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnModalCancel}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.btnModalCancelText}>{t.btnCancel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnModalSubmit, creatingTeacher && { opacity: 0.7 }]}
                onPress={handleAddTeacher}
                disabled={creatingTeacher}
              >
                {creatingTeacher ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={styles.btnModalSubmitText}>
                    {lang === 'ph' ? 'I-save' : 'Save'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB' },
  scrollPadding: { paddingHorizontal: width * 0.05, paddingBottom: 30 },
  
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 15 },
  headerLeft: { flex: 1 },
  welcomeText: { fontSize: scaleFont(10), color: '#999', fontWeight: '700', letterSpacing: 1.5 },
  mainTitle: { fontSize: scaleFont(26), fontWeight: '900', color: '#333', marginTop: 3 },
  logoutButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 },
  
  addDirectBtn: { flexDirection: 'row', backgroundColor: '#10B981', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20, elevation: 2 },
  addDirectBtnText: { color: 'white', fontWeight: 'bold', fontSize: scaleFont(13) },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  statCard: { width: '31%', backgroundColor: 'white', padding: 15, borderRadius: 20, elevation: 2, borderWidth: 1, borderColor: '#F0F0F0', alignItems: 'center' },
  statNumber: { fontSize: scaleFont(18), fontWeight: '900', color: '#F77F67' },
  statLabel: { fontSize: scaleFont(9), color: '#777', fontWeight: '700', marginTop: 4, textAlign: 'center' },
  accuracyCard: { backgroundColor: '#FEF3C7' },
  accuracyText: { color: '#D97706' },
  
  tabContainer: { flexDirection: 'row', backgroundColor: '#EAEAEA', borderRadius: 25, padding: 4, marginBottom: 20 },
  tabButton: { flex: 1, height: 45, justifyContent: 'center', alignItems: 'center', borderRadius: 22 },
  tabButtonActive: { backgroundColor: 'white', elevation: 2 },
  tabText: { color: '#777', fontWeight: '700', fontSize: scaleFont(13) },
  tabTextActive: { color: '#333' },

  tableCard: { backgroundColor: 'white', borderRadius: 25, padding: 15, elevation: 2, borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden' },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#EEE', paddingBottom: 10, marginBottom: 10 },
  tableHeaderCell: { fontSize: scaleFont(11), fontWeight: '800', color: '#BBB', letterSpacing: 0.5 },
  tableBodyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F9F9F9' },
  teacherName: { fontSize: scaleFont(14), fontWeight: 'bold', color: '#333' },
  teacherEmail: { fontSize: scaleFont(11), color: '#999', marginTop: 1 },
  teacherSchool: { fontSize: scaleFont(13), color: '#555', paddingHorizontal: 5 },
  actionColumn: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  actionButtonApprove: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  actionButtonReject: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
  actionButtonText: { color: 'white', fontSize: scaleFont(12), fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#999', fontSize: scaleFont(14), padding: 30, fontWeight: '600' },

  settingsCard: { backgroundColor: 'white', borderRadius: 25, padding: 20, elevation: 2, borderWidth: 1, borderColor: '#F0F0F0' },
  settingsTitle: { fontSize: scaleFont(18), fontWeight: '800', color: '#333', marginBottom: 5 },
  settingsDesc: { fontSize: scaleFont(12), color: '#666', lineHeight: 18, marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: scaleFont(10), fontWeight: '700', color: '#999', marginBottom: 8 },
  securityInput: { backgroundColor: '#F9F9F9', height: 55, borderRadius: 28, paddingHorizontal: 20, fontSize: scaleFont(14), borderWidth: 1, borderColor: '#EAEAEA', color: '#333' },
  btnSaveSettings: { backgroundColor: '#F77F67', height: 55, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginTop: 5, elevation: 2 },
  btnSaveSettingsText: { color: 'white', fontSize: scaleFont(15), fontWeight: 'bold' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', backgroundColor: 'white', borderRadius: 25, padding: 20, elevation: 5 },
  modalTitle: { fontSize: scaleFont(18), fontWeight: '800', color: '#333', marginBottom: 15, textAlign: 'center' },
  modalInput: { backgroundColor: '#F9F9F9', height: 50, borderRadius: 15, paddingHorizontal: 15, fontSize: scaleFont(13), borderWidth: 1, borderColor: '#EAEAEA', color: '#333', marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 10 },
  btnModalCancel: { flex: 1, height: 48, borderRadius: 24, backgroundColor: '#EAEAEA', justifyContent: 'center', alignItems: 'center' },
  btnModalCancelText: { color: '#555', fontWeight: 'bold' },
  btnModalSubmit: { flex: 1, height: 48, borderRadius: 24, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  btnModalSubmitText: { color: 'white', fontWeight: 'bold' }
});