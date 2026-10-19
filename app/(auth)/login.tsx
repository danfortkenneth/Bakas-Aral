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

// 1. IMPORT FIREBASE (Added db, doc, getDoc, setDoc, and signOut)
import { auth, db } from '../../lib/firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
  
  // States
  const [role, setRole] = useState<'teacher' | 'admin'>('teacher');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const DEV_SECRET_KEY = "BAKAS_DEV_2026"; 

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(
        lang === 'en' ? "Missing Info" : "Kulang sa Detalye", 
        lang === 'en' ? "Please enter both email and password." : "Paki-lagay ang email at password."
      );
      return;
    }

    // --- NEU EMAIL VALIDATION SA LOGIN FOR TEACHERS ---
    if (role === 'teacher' && !email.toLowerCase().endsWith('@neu.edu.ph')) {
      Alert.alert(
        lang === 'en' ? "Access Denied" : "Hindi Pinayagan",
        lang === 'en' ? "Only @neu.edu.ph emails are allowed to login as teacher." : "Tanging @neu.edu.ph na mga email lamang ang pwedeng mag-login bilang guro."
      );
      return;
    }

    // Admin Key Check
    if (role === 'admin' && adminKey !== DEV_SECRET_KEY) {
      Alert.alert("Error", lang === 'en' ? "Invalid Admin Secret Key!" : "Maling Secret Key para sa Admin!");
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // --- BAGONG IMPLEMENTASYON: CHECK USER ROLE AT APPROVAL STATUS MULA SA FIRESTORE ---
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();

        // Siguraduhin na tugma ang role na pinili sa database role
        if (userData.role !== role) {
          await signOut(auth);
          Alert.alert(
            lang === 'en' ? "Role Mismatch" : "Maling Role",
            lang === 'en' ? `This account is registered as a ${userData.role}.` : `Ang account na ito ay rehistrado bilang ${userData.role === 'teacher' ? 'Guro' : 'Admin'}.`
          );
          setLoading(false);
          return;
        }

        // Kung guro, siguraduhing approved na ng admin
        if (userData.role === 'teacher' && userData.status === 'pending') {
          await signOut(auth);
          Alert.alert(
            lang === 'en' ? "Account Pending" : "Naka-pending ang Account",
            lang === 'en' ? "Your account is waiting for admin approval." : "Ang iyong account ay naghihintay pa ng pag-apruba mula sa Admin."
          );
          setLoading(false);
          return;
        }

        // --- DITO MAGAGANAP ANG RESET SA DASHBOARD SESSIONS NG PARTIKULAR NA GURO ---
        if (userData.role === 'teacher') {
          try {
            // Gumagamit na ng account-specific document id para maiwasan ang overlap sa ibang guro
            const activeSessionRef = doc(db, 'sessions', `active_student_${user.uid}`);
            await setDoc(activeSessionRef, {
              studentId: null,
              studentName: '---',
              teacherId: user.uid,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          } catch (sessionError) {
            console.log("Error handling personal session document initialization:", sessionError);
          }
        }

      } else {
        // Kung walang record sa Firestore ngunit may auth record (safety fallback)
        if (role === 'teacher') {
          await signOut(auth);
          Alert.alert("Error", lang === 'en' ? "User profile record not found." : "Hindi mahanap ang record ng iyong profile.");
          setLoading(false);
          return;
        }
      }

      // Direstong pasok sa tabs kapag pumasa sa validations
      router.replace('/(tabs)');
    } catch (error: any) {
      let errorMessage = error.message;
      if (error.code === 'auth/invalid-credential') {
        errorMessage = lang === 'en' ? "Invalid email or password." : "Maling email o password.";
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = lang === 'en' ? "Account not found." : "Hindi mahanap ang account.";
      }
      
      Alert.alert(lang === 'en' ? "Login Failed" : "Mali ang Login", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const content = {
    en: {
      welcome: "WELCOME BACK",
      title: "Log-in to NEU-Bakás",
      teacher: "Teacher",
      admin: "Admin",
      labelEmail: "EMAIL",
      labelPass: "PASSWORD",
      labelKey: "SECRET ADMIN KEY",
      placeholderEmail: "name@neu.edu.ph",
      placeholderKey: "Enter dev code",
      remember: "Remember me",
      forgot: "Forgot?",
      btn: "Enter",
      or: "OR USE",
      noAccount: "Don't have an account? Sign-up"
    },
    ph: {
      welcome: "MALIGAYANG PAGBABALIK",
      title: "Mag-login sa NEU-Bakás",
      teacher: "Guro",
      admin: "Admin",
      labelEmail: "EMAIL",
      labelPass: "PASSWORD",
      labelKey: "SECRET ADMIN KEY",
      placeholderEmail: "pangalan@neu.edu.ph",
      placeholderKey: "Ilagay ang dev code",
      remember: "Tandaan ako",
      forgot: "Nakalimutan?",
      btn: "Pumasok",
      or: "O GAMITIN",
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

              {/* Role Switcher */}
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

              {/* Email Input */}
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

              {/* Password Input */}
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

              {/* Conditional Admin Key Input */}
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
                <TouchableOpacity>
                  <Text style={styles.forgotText}>{t.forgot}</Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity 
                style={[styles.btnLogin, loading && { opacity: 0.7 }]} 
                activeOpacity={0.8}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.btnLoginText}>{t.btn}</Text>
                )}
              </TouchableOpacity>

              <View style={styles.dividerContainer}>
                <View style={styles.line} />
                <Text style={styles.orText}>{t.or}</Text>
                <View style={styles.line} />
              </View>

              {/* Social Buttons */}
              <View style={styles.socialRow}>
                <TouchableOpacity style={styles.socialBtn}>
                  <Text style={styles.socialBtnText}>G  Google</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.socialBtn}>
                  <Text style={styles.socialBtnText}>Apple</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={() => router.push({ pathname: '/signup', params: { role } })}>
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
  mainTitle: { fontSize: normalize(26), fontWeight: '900', color: '#333', marginTop: 5, marginBottom: 25 },
  roleContainer: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 30, padding: 5, marginBottom: 25, borderWidth: 1, borderColor: '#EEE' },
  roleTab: { flex: 1, height: 45, justifyContent: 'center', alignItems: 'center', borderRadius: 25 },
  roleActive: { backgroundColor: '#F77F67' },
  roleText: { color: '#999', fontWeight: '700', fontSize: normalize(14) },
  roleTextActive: { color: 'white' },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: normalize(11), fontWeight: '700', color: '#999', marginBottom: 8 },
  input: { backgroundColor: 'white', height: isTablet ? 60 : SCREEN_HEIGHT * 0.07, minHeight: 50, borderRadius: 30, paddingHorizontal: 20, fontSize: normalize(15), borderWidth: 1, borderColor: '#F0F0F0' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#F77F67', marginRight: 8, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#F77F67' },
  rememberText: { fontSize: normalize(13), color: '#666' },
  forgotText: { fontSize: normalize(13), color: '#F77F67', fontWeight: '700' },
  btnLogin: { backgroundColor: '#F77F67', height: isTablet ? 65 : SCREEN_HEIGHT * 0.075, minHeight: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginTop: 20, elevation: 4 },
  btnLoginText: { color: 'white', fontSize: normalize(18), fontWeight: 'bold' },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 30 },
  line: { flex: 1, height: 1, backgroundColor: '#EEE' },
  orText: { marginHorizontal: 10, fontSize: normalize(10), color: '#BBB', fontWeight: '700' },
  socialRow: { flexDirection: 'row', justifyContent: 'space-between' },
  socialBtn: { width: '48%', height: 55, backgroundColor: 'white', borderRadius: 30, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#EEE' },
  socialBtnText: { fontWeight: '700', color: '#333', fontSize: normalize(14) },
  signupFooter: { textAlign: 'center', marginTop: 30, color: '#777', fontSize: normalize(14), marginBottom: 40 },
  signupLink: { color: '#F77F67', fontWeight: 'bold' }
});