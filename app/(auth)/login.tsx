import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  Dimensions, 
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  PixelRatio,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '../_layout'; 

import { auth, db } from '../../lib/firebase';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const isTablet = SCREEN_WIDTH >= 768;
const scale = SCREEN_WIDTH / 375;
const normalize = (size: number) => {
  if (isTablet) return Math.round(PixelRatio.roundToNearestPixel(size * 1.2));
  const newSize = size * scale;
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

export default function LoginPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  
  const [role, setRole] = useState<'teacher' | 'admin'>('teacher');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const DEV_SECRET_KEY = process.env.EXPO_PUBLIC_ADMIN_KEY || "BAKAS_DEV_2026"; 

  const handleLogin = async () => {
    // 1. INPUT VALIDATIONS
    if (role === 'teacher' && (!employeeId.trim() || !password)) {
      Alert.alert(
        lang === 'en' ? "Missing Info" : "Kulang sa Detalye", 
        lang === 'en' ? "Please enter both Employee ID and password." : "Pakilagay ang iyong Employee ID at password."
      );
      return;
    }

    if (role === 'admin' && (!email.trim() || !password)) {
      Alert.alert(
        lang === 'en' ? "Missing Info" : "Kulang sa Detalye", 
        lang === 'en' ? "Please enter both Admin email and password." : "Pakilagay ang Admin email at password."
      );
      return;
    }

    if (role === 'admin' && adminKey !== DEV_SECRET_KEY) {
      Alert.alert("Error", lang === 'en' ? "Invalid Admin Secret Key!" : "Maling Secret Key para sa Admin!");
      return;
    }

    setLoading(true);
    try {
      let targetEmail = email.trim();

      // 2. TEACHER LOGIN logic VIA EMPLOYEE ID + WHITELIST VERIFICATION
      if (role === 'teacher') {
        const cleanEmployeeId = employeeId.trim().toUpperCase();

        // A. I-verify kung nasa allowed_teachers whitelist ang ID
        const allowedDocRef = doc(db, 'allowed_teachers', cleanEmployeeId);
        const allowedSnap = await getDoc(allowedDocRef);

        if (!allowedSnap.exists()) {
          Alert.alert(
            lang === 'en' ? "Access Denied" : "Hindi Pinayagan",
            lang === 'en' ? "Your Employee ID is not on the official NEU faculty whitelist." : "Ang iyong Employee ID ay wala sa opisyal na talaan ng mga guro ng NEU."
          );
          setLoading(false);
          return;
        }

        // B. Hanapin ang registered user account gamit ang Employee ID
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("employeeId", "==", cleanEmployeeId));
        const querySnap = await getDocs(q);

        if (querySnap.empty) {
          Alert.alert(
            lang === 'en' ? "Account Not Found" : "Hindi Nahanap",
            lang === 'en' ? "No account registered with this Employee ID. Please sign-up first." : "Walang account na nakarehistro sa Employee ID na ito. Mag-register muna."
          );
          setLoading(false);
          return;
        }

        const teacherUserDoc = querySnap.docs[0].data();
        targetEmail = teacherUserDoc.email;

        // C. Institutional Domain Security Check
        if (!targetEmail.toLowerCase().endsWith('@neu.edu.ph')) {
          Alert.alert(
            lang === 'en' ? "Access Denied" : "Hindi Pinayagan",
            lang === 'en' ? "Only @neu.edu.ph institutional accounts are allowed." : "Tanging @neu.edu.ph na mga email lamang ang pwedeng gamitin."
          );
          setLoading(false);
          return;
        }
      }

      // 3. FIREBASE AUTHENTICATION LOGIN
      const userCredential = await signInWithEmailAndPassword(auth, targetEmail, password);
      const user = userCredential.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();

        if (userData.role !== role) {
          await signOut(auth);
          Alert.alert(
            lang === 'en' ? "Role Mismatch" : "Maling Role",
            lang === 'en' ? `This account is registered as a ${userData.role}.` : `Ang account na ito ay rehistrado bilang ${userData.role === 'teacher' ? 'Guro' : 'Admin'}.`
          );
          setLoading(false);
          return;
        }

        if (userData.role === 'teacher' && userData.status === 'pending') {
          await signOut(auth);
          Alert.alert(
            lang === 'en' ? "Account Pending" : "Naka-pending ang Account",
            lang === 'en' ? "Your account is waiting for admin approval." : "Ang iyong account ay naghihintay pa ng pag-apruba mula sa Admin."
          );
          setLoading(false);
          return;
        }
      }

      router.replace('/(tabs)');
    } catch (error: any) {
      let errorMessage = error.message;
      if (error.code === 'auth/invalid-credential') {
        errorMessage = lang === 'en' ? "Invalid credentials or password." : "Maling Employee ID o password.";
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = lang === 'en' ? "Account not found." : "Hindi mahanap ang account.";
      }
      
      Alert.alert(lang === 'en' ? "Login Failed" : "Mali ang Login", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (role === 'teacher' && !employeeId.trim()) {
      Alert.alert("Info", lang === 'en' ? "Please enter your Employee ID first." : "Pakilagay muna ang iyong Employee ID.");
      return;
    }

    try {
      let targetEmail = email.trim();

      if (role === 'teacher') {
        const cleanEmployeeId = employeeId.trim().toUpperCase();
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("employeeId", "==", cleanEmployeeId));
        const querySnap = await getDocs(q);

        if (querySnap.empty) {
          Alert.alert("Error", lang === 'en' ? "Employee ID not found." : "Hindi mahanap ang Employee ID.");
          return;
        }
        targetEmail = querySnap.docs[0].data().email;
      }

      await sendPasswordResetEmail(auth, targetEmail);
      Alert.alert("Success", lang === 'en' ? `Password reset link sent to registered email (${targetEmail})!` : `Naipadala na ang password reset link sa nakarehistrong email (${targetEmail})!`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const content = {
    en: {
      welcome: "FACULTY & ADMIN PORTAL",
      title: "Sign in with Institutional Account",
      teacher: "Teacher",
      admin: "Admin",
      labelEmpId: "EMPLOYEE / FACULTY ID",
      labelEmail: "ADMIN EMAIL",
      labelPass: "PASSWORD",
      labelKey: "SECRET ADMIN KEY",
      placeholderEmpId: "e.g. NEU-2026-001",
      placeholderEmail: "admin@neu.edu.ph",
      placeholderKey: "Enter dev code",
      remember: "Remember me",
      forgot: "Forgot Password?",
      btn: "Sign-in to Portal",
      noAccount: "Don't have an account? Sign-up"
    },
    ph: {
      welcome: "FACULTY & ADMIN PORTAL",
      title: "Mag-login sa Institutional Account",
      teacher: "Guro",
      admin: "Admin",
      labelEmpId: "EMPLOYEE / FACULTY ID",
      labelEmail: "ADMIN EMAIL",
      labelPass: "PASSWORD",
      labelKey: "SECRET ADMIN KEY",
      placeholderEmpId: "Hal: NEU-2026-001",
      placeholderEmail: "admin@neu.edu.ph",
      placeholderKey: "Ilagay ang dev code",
      remember: "Tandaan ako",
      forgot: "Nakalimutan?",
      btn: "Pumasok sa Portal",
      noAccount: "Wala pang account? Sign-up"
    }
  };

  const t = content[lang];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
          <View style={styles.responsiveWrapper}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={{ fontSize: 20 }}>←</Text>
            </TouchableOpacity>

            <View style={styles.content}>
              <Text style={styles.welcomeText}>{t.welcome}</Text>
              <Text style={styles.mainTitle}>{t.title}</Text>

              {/* ROLE SWITCHER */}
              <View style={styles.roleContainer}>
                <TouchableOpacity 
                  style={[styles.roleTab, role === 'teacher' && styles.roleActive]} 
                  onPress={() => {
                    setRole('teacher');
                    setAdminKey('');
                  }}
                >
                  <Text style={[styles.roleText, role === 'teacher' && styles.roleTextActive]}>{t.teacher}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.roleTab, role === 'admin' && styles.roleActive]} 
                  onPress={() => setRole('admin')}
                >
                  <Text style={[styles.roleText, role === 'admin' && styles.roleTextActive]}>{t.admin}</Text>
                </TouchableOpacity>
              </View>

              {/* INPUT FIELDS BASED ON ROLE */}
              {role === 'teacher' ? (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t.labelEmpId}</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder={t.placeholderEmpId} 
                    value={employeeId}
                    onChangeText={setEmployeeId}
                    autoCapitalize="characters"
                  />
                </View>
              ) : (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t.labelEmail}</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder={t.placeholderEmail} 
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t.labelPass}</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="••••••••" 
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              {role === 'admin' && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, {color: '#F77F67'}]}>{t.labelKey}</Text>
                  <TextInput 
                    style={[styles.input, {borderColor: '#F77F67'}]} 
                    placeholder={t.placeholderKey}
                    secureTextEntry
                    value={adminKey}
                    onChangeText={setAdminKey}
                  />
                </View>
              )}

              <View style={styles.rowBetween}>
                <TouchableOpacity style={styles.checkboxRow} onPress={() => setRememberMe(!rememberMe)}>
                  <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                    {rememberMe && <Text style={{color:'white', fontSize:10}}>✓</Text>}
                  </View>
                  <Text style={styles.rememberText}>{t.remember}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleForgotPassword}>
                  <Text style={styles.forgotText}>{t.forgot}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                style={[styles.btnLogin, loading && { opacity: 0.7 }]} 
                activeOpacity={0.8}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.btnLoginText}>💼 {t.btn}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push({ pathname: '/(auth)/signup', params: { role } })}>
                <Text style={styles.signupFooter}>
                  {t.noAccount.split('?')[0]}? <Text style={styles.signupLink}>{t.noAccount.split('?')[1]}</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB' },
  scrollContainer: { paddingBottom: 40, alignItems: 'center' },
  responsiveWrapper: { width: '100%', maxWidth: 550, paddingHorizontal: SCREEN_WIDTH * 0.08 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', marginTop: 20, elevation: 2 },
  content: { marginTop: 30 },
  welcomeText: { fontSize: normalize(10), color: '#999', fontWeight: '700', letterSpacing: 1.5 },
  mainTitle: { fontSize: normalize(22), fontWeight: '900', color: '#333', marginTop: 5, marginBottom: 25 },
  roleContainer: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 30, padding: 5, marginBottom: 25, borderWidth: 1, borderColor: '#EEE' },
  roleTab: { flex: 1, height: 45, justifyContent: 'center', alignItems: 'center', borderRadius: 25 },
  roleActive: { backgroundColor: '#1E3A8A' },
  roleText: { color: '#999', fontWeight: '700', fontSize: normalize(14) },
  roleTextActive: { color: 'white' },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: normalize(11), fontWeight: '700', color: '#999', marginBottom: 8 },
  input: { backgroundColor: 'white', height: isTablet ? 60 : SCREEN_HEIGHT * 0.07, minHeight: 50, borderRadius: 30, paddingHorizontal: 20, fontSize: normalize(15), borderWidth: 1, borderColor: '#F0F0F0' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#1E3A8A', marginRight: 8, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#1E3A8A' },
  rememberText: { fontSize: normalize(13), color: '#666' },
  forgotText: { fontSize: normalize(13), color: '#1E3A8A', fontWeight: '700' },
  btnLogin: { backgroundColor: '#1E3A8A', height: isTablet ? 65 : SCREEN_HEIGHT * 0.075, minHeight: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginTop: 20, elevation: 4 },
  btnLoginText: { color: 'white', fontSize: normalize(16), fontWeight: 'bold' },
  signupFooter: { textAlign: 'center', marginTop: 30, color: '#777', fontSize: normalize(14), marginBottom: 40 },
  signupLink: { color: '#1E3A8A', fontWeight: 'bold' }
});