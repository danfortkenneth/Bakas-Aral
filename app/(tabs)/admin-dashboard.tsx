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
  ActivityIndicator
} from 'react-native';
import { useLanguage } from '../_layout';
import { Ionicons } from '@expo/vector-icons'; // Inimport para sa Logout Icon
import { useRouter } from 'expo-router';      // Inimport para sa Navigation Redirect
import { db, auth } from '../../lib/firebase'; // Idinagdag ang auth mula sa firebase config
import { signOut } from 'firebase/auth';        // Inimport ang Firebase SignOut function
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;
const scaleFont = (size: number) => isTablet ? size * 1.15 : size * (width / 375);

// Mock Data para sa System Analytics summary cards
const analyticsSummary = {
  totalStudents: 142,
  accuracyRate: "84.5%",
  activeToday: 38
};

export default function AdminDashboard() {
  const router = useRouter(); // Initialize router para sa pagbalik sa login screen
  const { lang } = useLanguage();
  const [activeTab, setActiveTab] = useState<'teachers' | 'settings'>('teachers');
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(true);
  const [secretKey, setSecretKey] = useState("BAKAS_DEV_2026");
  const [updatingKey, setUpdatingKey] = useState(false);

  // Dictionary para sa Multi-language support ng Admin Panel
  const content = {
    en: {
      welcome: "SYSTEM OVERVIEW",
      title: "Central Admin Panel",
      cardTeachers: "Total Teachers",
      cardStudents: "Global Students",
      cardAccuracy: "Global Accuracy",
      tabTeachers: "Pending Teachers",
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
      btnYes: "Yes"
    },
    ph: {
      welcome: "PANGKALAHATANG TINGIN",
      title: "Central Admin Panel",
      cardTeachers: "Mga Guro",
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
      btnYes: "Oo"
    }
  };

  const t = content[lang] || content['en'];

  // REAL-TIME LISTENER: Sinala upang kumpirmahing mga "pending" na guro lamang ang lilitaw sa listahan
  useEffect(() => {
    const q = query(
      collection(db, "users"), 
      where("role", "==", "teacher"),
      where("status", "==", "pending") 
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const teacherList: any[] = [];
      snapshot.forEach((doc) => {
        teacherList.push({ id: doc.id, ...doc.data() });
      });
      setTeachers(teacherList);
      setLoadingTeachers(false);
    }, (error) => {
      console.log("Firestore error inside Admin Panel:", error.message);
      setLoadingTeachers(false);
    });

    return () => unsubscribe();
  }, []);

  // 🔥 BAGONG FUNKSYON: LOGOUT HANDLER
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
              await signOut(auth); // Inaalis ang authentication token sa Firebase
              router.replace('/login'); // Nililinis ang stack at ibinabalik sa login screen
            } catch (error: any) {
              Alert.alert("Error", error.message);
            }
          }
        }
      ]
    );
  };

  // AKSYON: Pag-approve sa rehistradong guro (Ina-update ang status sa "approved")
  const handleApproveTeacher = async (id: string, name: string) => {
    try {
      const userRef = doc(db, "users", id);
      await updateDoc(userRef, {
        status: "approved",
        verifiedAt: new Date().toISOString()
      });
      Alert.alert(lang === 'en' ? "Success" : "Tagumpay", `${name} ${t.toastSuccessApprove}`);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  // AKSYON: Pag-reject o pagbura sa hindi valid na guro sa system
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

  // AKSYON: Pagpapalit ng Master Secret Admin Key sa System Configuration
  const handleUpdateSecretKey = () => {
    if (!secretKey.trim()) {
      Alert.alert("Error", lang === 'en' ? "Key cannot be empty!" : "Hindi pwedeng walang laman ang key!");
      return;
    }
    setUpdatingKey(true);
    
    // Naka-simulate na timeout para sa cloud save operation
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
        
        {/* HEADER SECTION WITH LOGOUT BUTTON */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.welcomeText}>{t.welcome}</Text>
            <Text style={styles.mainTitle}>{t.title}</Text>
          </View>
          {/* 🔥 LOGOUT INTERACTIVE BUTTON (Katulad ng nasa mockup/screenshot mo) */}
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* SUMMARY STATS CARDS ROW */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{loadingTeachers ? "..." : teachers.length}</Text>
            <Text style={styles.statLabel}>{t.cardTeachers}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{analyticsSummary.totalStudents}</Text>
            <Text style={styles.statLabel}>{t.cardStudents}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#FEF3C7' }]}>
            <Text style={[styles.statNumber, { color: '#D97706' }]}>{analyticsSummary.accuracyRate}</Text>
            <Text style={styles.statLabel}>{t.cardAccuracy}</Text>
          </View>
        </View>

        {/* TAB CONTROLLERS */}
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

        {/* TAB CONTENT 1: TEACHER LIST / APPROVALS TABLE */}
        {activeTab === 'teachers' && (
          <View style={styles.tableCard}>
            {loadingTeachers ? (
              <ActivityIndicator color="#F77F67" style={{ padding: 40 }} />
            ) : teachers.length === 0 ? (
              <Text style={styles.emptyText}>{t.noPending}</Text>
            ) : (
              <View>
                {/* Custom Table Header */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>{t.tableName}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>{t.tableSchool}</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>{t.tableAction}</Text>
                </View>

                {/* Table Data Rows */}
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

        {/* TAB CONTENT 2: SYSTEM SECURITY & DEVELOPER KEYS */}
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
                color="#333"
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB' },
  scrollPadding: { paddingHorizontal: width * 0.05, paddingBottom: 110 }, // Dinagdagan ang padding bottom para hindi matakpan ng floating single tab bar mo
  
  // Flex layout para sa Header at Logout Row
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 25, marginBottom: 20 },
  headerLeft: { flex: 1 },
  welcomeText: { fontSize: scaleFont(10), color: '#999', fontWeight: '700', letterSpacing: 1.5 },
  mainTitle: { fontSize: scaleFont(26), fontWeight: '900', color: '#333', marginTop: 3 },
  
  // Logout Button Box Styling (Premium Bordered Circle)
  logoutButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3 },
  
  // Stats Row & Cards Styling
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
  statCard: { width: '31%', backgroundColor: 'white', padding: 15, borderRadius: 20, elevation: 2, borderWidth: 1, borderColor: '#F0F0F0', alignItems: 'center' },
  statNumber: { fontSize: scaleFont(18), fontWeight: '900', color: '#F77F67' },
  statCardText: { fontSize: scaleFont(9), color: '#777', fontWeight: '700', marginTop: 4, textAlign: 'center' },
  statLabel: { fontSize: scaleFont(9), color: '#777', fontWeight: '700', marginTop: 4, textAlign: 'center' },
  
  // Custom Tabs Layout
  tabContainer: { flexDirection: 'row', backgroundColor: '#EAEAEA', borderRadius: 25, padding: 4, marginBottom: 20 },
  tabButton: { flex: 1, height: 45, justifyContent: 'center', alignItems: 'center', borderRadius: 22 },
  tabButtonActive: { backgroundColor: 'white', elevation: 2 },
  tabText: { color: '#777', fontWeight: '700', fontSize: scaleFont(13) },
  tabTextActive: { color: '#333' },

  // Table Structure
  tableCard: { backgroundColor: 'white', borderRadius: 25, padding: 15, elevation: 2, borderWidth: 1, borderColor: '#F0F0F0', overflow: 'hidden' },
  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#EEE', paddingBottom: 10, marginBottom: 10 },
  tableHeaderCell: { fontSize: scaleFont(11), fontWeight: '800', color: '#BBB', letterSpacing: 0.5 },
  tableBodyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F9F9F9' },
  teacherName: { fontSize: scaleFont(14), fontWeight: 'bold', color: '#333' },
  teacherEmail: { fontSize: scaleFont(11), color: '#999', marginTop: 1 },
  teacherSchool: { fontSize: scaleFont(13), color: '#555', paddingHorizontal: 5 },
  
  // Action Buttons inside Table
  actionColumn: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 },
  actionButtonApprove: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  actionButtonReject: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },
  actionButtonText: { color: 'white', fontSize: scaleFont(12), fontWeight: 'bold' },
  emptyText: { textAlign: 'center', color: '#999', fontSize: scaleFont(14), padding: 30, fontWeight: '600' },

  // Security Panel Layout
  settingsCard: { backgroundColor: 'white', borderRadius: 25, padding: 20, elevation: 2, borderWidth: 1, borderColor: '#F0F0F0' },
  settingsTitle: { fontSize: scaleFont(18), fontWeight: '800', color: '#333', marginBottom: 5 },
  settingsDesc: { fontSize: scaleFont(12), color: '#666', lineHeight: 18, marginBottom: 20 },
  inputGroup: { marginBottom: 20 },
  inputLabel: { fontSize: scaleFont(10), fontWeight: '700', color: '#999', marginBottom: 8 },
  securityInput: { backgroundColor: '#F9F9F9', height: 55, borderRadius: 28, paddingHorizontal: 20, fontSize: scaleFont(14), borderWidth: 1, borderColor: '#EAEAEA' },
  btnSaveSettings: { backgroundColor: '#F77F67', height: 55, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginTop: 5, elevation: 2 },
  btnSaveSettingsText: { color: 'white', fontSize: scaleFont(15), fontWeight: 'bold' }
})