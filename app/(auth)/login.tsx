import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import { auth, db } from '../../lib/firebase';
import { normalizeFor } from '../../lib/responsive';
import { useLanguage } from '../_layout';
import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Original visual baseline restored; live layout comes from useResponsive.
const normalize = (size: number) => normalizeFor(375, size);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const { lang } = useLanguage();

  const [role, setRole] = useState<'teacher' | 'admin'>('teacher');
  const [employeeId, setEmployeeId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  // No hardcoded fallback — production must supply the key via environment.
  const ADMIN_KEY = process.env.EXPO_PUBLIC_ADMIN_KEY;
  const adminKeyConfigured = !!ADMIN_KEY;

  useEffect(() => {
    AsyncStorage.getItem('@bakas_remember')
      .then((value) => {
        if (!value) return;
        setRememberMe(true);
        setEmployeeId(value.toUpperCase());
        setEmail(value);
      })
      .catch(() => {});
  }, []);

  const content = {
    en: {
      welcome: 'FACULTY & ADMIN PORTAL',
      title: 'Sign in with your institutional account',
      teacher: 'Teacher',
      admin: 'Admin',
      labelEmpId: 'EMPLOYEE / FACULTY ID',
      labelEmail: 'ADMIN EMAIL',
      labelPass: 'PASSWORD',
      labelKey: 'SECRET ADMIN KEY',
      placeholderEmpId: 'Enter Employee ID',
      placeholderEmail: 'name@neu.edu.ph',
      placeholderKey: 'Enter Admin Key',
      remember: 'Remember me',
      forgot: 'Forgot password?',
      btn: 'Sign in to Portal',
      noAccount: "Don't have an account? Sign up",
      needEmp: 'Enter your Employee ID and password.',
      needAdmin: 'Enter your admin email and password.',
      badKey: 'Invalid admin secret key.',
      badEmail: 'Enter a valid institutional email address.',
    },
    ph: {
      welcome: 'PORTAL NG GURO AT ADMIN',
      title: 'Mag-sign in gamit ang institutional account',
      teacher: 'Guro',
      admin: 'Admin',
      labelEmpId: 'EMPLOYEE / FACULTY ID',
      labelEmail: 'ADMIN EMAIL',
      labelPass: 'PASSWORD',
      labelKey: 'SECRET ADMIN KEY',
      placeholderEmpId: 'Ipasok ang Employee ID',
      placeholderEmail: 'name@neu.edu.ph',
      placeholderKey: 'Ipasok ang Admin Key',
      remember: 'Tandaan ako',
      forgot: 'Nakalimutan ang password?',
      btn: 'Mag-sign in sa Portal',
      noAccount: 'Walang account? Mag-sign up',
      needEmp: 'Ipasok ang Employee ID at password.',
      needAdmin: 'Ipasok ang admin email at password.',
      badKey: 'Maling admin secret key.',
      badEmail: 'Magpasok ng wastong institutional email.',
    },
  };
  const t = content[lang];

  const safeBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const change = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setError('');
  };

  const handleLogin = async () => {
    setError('');

    if (role === 'teacher' && (!employeeId.trim() || !password)) {
      setError(t.needEmp);
      return;
    }
    if (role === 'admin' && (!email.trim() || !password)) {
      setError(t.needAdmin);
      return;
    }
    if (role === 'admin' && !EMAIL_RE.test(email.trim())) {
      setError(t.badEmail);
      return;
    }
    if (role === 'admin' && !adminKeyConfigured) {
      setError(lang === 'ph'
        ? 'Hindi naka-configure ang admin access.'
        : 'Admin access is not configured.');
      return;
    }
    if (role === 'admin' && adminKey !== ADMIN_KEY) {
      setError(t.badKey);
      return;
    }

    setLoading(true);
    try {
      let targetEmail = email.trim();

      if (role === 'teacher') {
        const cleanEmployeeId = employeeId.trim().toUpperCase();

        try {
          const allowedDocRef = doc(db, 'allowed_teachers', cleanEmployeeId);
          const allowedSnap = await getDoc(allowedDocRef);
          if (!allowedSnap.exists()) {
            setError(lang === 'ph'
              ? 'Hindi nasa official NEU faculty list ang Employee ID.'
              : 'Your Employee ID is not on the official NEU faculty whitelist.');
            return;
          }
        } catch {
          setError(lang === 'ph'
            ? 'Hindi ma-verify ang faculty list. Subukan muli.'
            : 'Could not verify the faculty list. Please try again.');
          return;
        }

        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('employeeId', '==', cleanEmployeeId));
        const querySnap = await getDocs(q);

        if (querySnap.empty) {
          setError(lang === 'ph'
            ? 'Walang account para sa Employee ID na ito. Mag-sign up muna.'
            : 'No account registered with this Employee ID. Please sign up first.');
          return;
        }

        const teacherUserDoc = querySnap.docs[0].data();
        targetEmail = teacherUserDoc.email;

        if (!targetEmail.toLowerCase().endsWith('@neu.edu.ph')) {
          setError(lang === 'ph'
            ? 'Mga @neu.edu.ph account lang ang pinapayagan.'
            : 'Only @neu.edu.ph institutional accounts are allowed.');
          return;
        }
      }

      await signInWithEmailAndPassword(auth, targetEmail, password);
      const user = auth.currentUser;
      if (!user) return;

      const userDocSnap = await getDoc(doc(db, 'users', user.uid));
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.role !== role) {
          await signOut(auth);
          setError(lang === 'ph'
            ? `Ang account ay rehistrado bilang ${userData.role}.`
            : `This account is registered as ${userData.role}.`);
          return;
        }
        if (userData.status === 'pending') {
          await signOut(auth);
          setError(lang === 'ph'
            ? 'Hintayin muna ang approval ng admin.'
            : 'Your account is waiting for admin approval.');
          return;
        }
      }

      if (rememberMe) {
        const identifier = role === 'teacher' ? employeeId.trim().toUpperCase() : email.trim();
        AsyncStorage.setItem('@bakas_remember', identifier).catch(() => {});
      } else {
        AsyncStorage.removeItem('@bakas_remember').catch(() => {});
      }

      router.replace('/(tabs)');
    } catch (err: any) {
      const code = err.code;
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        setError(lang === 'ph' ? 'Maling credentials o password.' : 'Invalid credentials or password.');
      } else if (code === 'auth/user-not-found') {
        setError(lang === 'ph' ? 'Hindi natagpuan ang account.' : 'Account not found.');
      } else {
        setError(lang === 'ph' ? 'May naganap na error. Subukan muli.' : 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError('');
    if (role === 'teacher' && !employeeId.trim()) {
      setError(lang === 'ph' ? 'Ipasok muna ang Employee ID.' : 'Enter your Employee ID first.');
      return;
    }

    try {
      let targetEmail = email.trim();
      if (role === 'teacher') {
        const cleanEmployeeId = employeeId.trim().toUpperCase();
        const q = query(collection(db, 'users'), where('employeeId', '==', cleanEmployeeId));
        const querySnap = await getDocs(q);
        if (querySnap.empty) {
          setError(lang === 'ph' ? 'Hindi natagpuan ang Employee ID.' : 'Employee ID not found.');
          return;
        }
        targetEmail = querySnap.docs[0].data().email;
      }
      await sendPasswordResetEmail(auth, targetEmail);
      setError('');
      // Inline success keeps the visual language consistent.
      setNotice(lang === 'ph'
        ? `Na-send ang reset link sa ${targetEmail}.`
        : `Password reset link sent to ${targetEmail}.`);
    } catch {
      setError(lang === 'ph' ? 'Hindi ma-send ang reset link.' : 'Could not send the reset link.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContainer}
        >
          <View style={styles.responsiveWrapper}>
            <TouchableOpacity onPress={safeBack} style={styles.backBtn} accessibilityLabel="Back">
              <Text style={{ fontSize: 20 }}>←</Text>
            </TouchableOpacity>

            <View style={styles.content}>
              <Text style={styles.welcomeText}>{t.welcome}</Text>
              <Text style={styles.mainTitle}>{t.title}</Text>

              <View style={styles.roleContainer}>
                <TouchableOpacity
                  style={[styles.roleTab, role === 'teacher' && styles.roleActive]}
                  onPress={() => { setRole('teacher'); setAdminKey(''); setError(''); }}
                >
                  <Text style={[styles.roleText, role === 'teacher' && styles.roleTextActive]}>{t.teacher}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleTab, role === 'admin' && styles.roleActive]}
                  onPress={() => { setRole('admin'); setError(''); }}
                >
                  <Text style={[styles.roleText, role === 'admin' && styles.roleTextActive]}>{t.admin}</Text>
                </TouchableOpacity>
              </View>

              {role === 'teacher' ? (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t.labelEmpId}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t.placeholderEmpId}
                    value={employeeId}
                    onChangeText={change(setEmployeeId)}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                </View>
              ) : (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t.labelEmail}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t.placeholderEmail}
                    value={email}
                    onChangeText={change(setEmail)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t.labelPass}</Text>
                <View style={styles.inputWrap}>
                  <TextInput
                    style={[styles.input, styles.inputWithIcon]}
                    placeholder="••••••••"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={change(setPassword)}
                    autoComplete="password"
                  />
                  <TouchableOpacity
                    style={styles.eyeBtn}
                    onPress={() => setShowPassword(!showPassword)}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </View>

              {role === 'admin' && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: '#F77F67' }]}>{t.labelKey}</Text>
                  <TextInput
                    style={[styles.input, { borderColor: '#F77F67' }]}
                    placeholder={t.placeholderKey}
                    secureTextEntry
                    value={adminKey}
                    onChangeText={change(setAdminKey)}
                  />
                </View>
              )}

              {!!error && (
                <View style={styles.messageBox}>
                  <Ionicons name="alert-circle-outline" size={16} color="#B91C1C" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              {!!notice && !error && (
                <View style={[styles.messageBox, styles.noticeBox]}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#15803D" />
                  <Text style={styles.noticeText}>{notice}</Text>
                </View>
              )}

              <View style={styles.rowBetween}>
                <TouchableOpacity style={styles.checkboxRow} onPress={() => setRememberMe(!rememberMe)}>
                  <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                    {rememberMe && <Text style={{ color: 'white', fontSize: 10 }}>✓</Text>}
                  </View>
                  <Text style={styles.rememberText}>{t.remember}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotRow}>
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

              <TouchableOpacity
                onPress={() => router.push({ pathname: '/(auth)/signup', params: { role } })}
              >
                <Text style={styles.signupFooter}>
                  {t.noAccount.split('?')[0]}?{' '}
                  <Text style={styles.signupLink}>{t.noAccount.split('?')[1]}</Text>
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
  responsiveWrapper: { width: '100%', maxWidth: 550, paddingHorizontal: '8%' },
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
  input: { backgroundColor: 'white', height: 56, borderRadius: 30, paddingHorizontal: 20, fontSize: normalize(15), borderWidth: 1, borderColor: '#F0F0F0' },
  inputWrap: { position: 'relative' },
  inputWithIcon: { paddingRight: 52 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, height: 56, justifyContent: 'center' },
  messageBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 12 },
  noticeBox: { backgroundColor: '#F0FDF4' },
  errorText: { flex: 1, color: '#B91C1C', fontSize: normalize(12), lineHeight: 18 },
  noticeText: { flex: 1, color: '#15803D', fontSize: normalize(12), lineHeight: 18 },
  forgotRow: { alignSelf: 'flex-end', marginVertical: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center' },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#1E3A8A', marginRight: 8, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#1E3A8A' },
  rememberText: { fontSize: normalize(13), color: '#666' },
  forgotText: { fontSize: normalize(13), color: '#1E3A8A', fontWeight: '700' },
  btnLogin: { backgroundColor: '#1E3A8A', height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginTop: 20, elevation: 4 },
  btnLoginText: { color: 'white', fontSize: normalize(16), fontWeight: '700' },
  signupFooter: { textAlign: 'center', marginTop: 30, color: '#777', fontSize: normalize(14), marginBottom: 40 },
  signupLink: { color: '#1E3A8A', fontWeight: '700' },
});
