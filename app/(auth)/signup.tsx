import React, { useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { auth, db } from '../../lib/firebase';
import { normalizeFor } from '../../lib/responsive';
import { useLanguage } from '../_layout';
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Original visual baseline restored; live layout comes from useResponsive.
const normalize = (size: number) => normalizeFor(375, size);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Signup() {
  const router = useRouter();
  const { role } = useLocalSearchParams();
  const { lang } = useLanguage();

  const currentRole = (role as string) || 'teacher';

  const [employeeId, setEmployeeId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [school, setSchool] = useState('New Era University');
  const [adminKey, setAdminKey] = useState('');
  const [agree, setAgree] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // No hardcoded fallback — production must supply the key via environment.
  const ADMIN_KEY = process.env.EXPO_PUBLIC_ADMIN_KEY;
  const adminKeyConfigured = !!ADMIN_KEY;

  const content = {
    en: {
      sub: 'ACCOUNT CREATION',
      title: currentRole === 'admin' ? 'Administrator Registration' : 'Faculty Registration',
      labelEmpId: 'EMPLOYEE / FACULTY ID',
      labelName: 'FULL NAME',
      labelEmail: 'INSTITUTIONAL EMAIL',
      labelPass: 'PASSWORD',
      labelConfirm: 'CONFIRM PASSWORD',
      labelSchool: 'SCHOOL / DIVISION',
      labelKey: 'SECRET ADMIN KEY',
      placeholderEmpId: 'Enter Employee ID',
      placeholderName: 'Enter Full Name',
      placeholderEmail: 'name@neu.edu.ph',
      placeholderPass: 'At least 8 characters',
      placeholderConfirm: 'Repeat password',
      placeholderSchool: 'Enter School or Division',
      placeholderKey: 'Enter Admin Key',
      terms: 'I agree to the Terms and Privacy Policy.',
      btn: 'Create Account',
      footer: 'Already have an account? Log in',
      weak: 'Password is too weak.',
      mismatch: 'Passwords do not match.',
      required: 'Please complete all required fields.',
      emailInvalid: 'Enter a valid @neu.edu.ph email address.',
      needEmp: 'Employee ID is required for teacher registration.',
      needKey: 'A valid admin secret key is required.',
      agreed: 'Please agree to the Terms and Privacy Policy.',
      successTitle: 'Registration Successful',
      successMsg: 'Please wait for administrator approval before signing in.',
      privacyTitle: 'Privacy Notice',
      privacyBody:
        'Progress is saved on this device first. No ads, no trackers, no child data sent to an AI. An adult chooses when to sync with the teacher via QR code. Saved data can be cleared at any time.',
    },
    ph: {
      sub: 'PAGGAWA NG ACCOUNT',
      title: currentRole === 'admin' ? 'Rehistrasyon ng Admin' : 'Rehistrasyon ng Guro',
      labelEmpId: 'EMPLOYEE / FACULTY ID',
      labelName: 'BUONG PANGALAN',
      labelEmail: 'INSTITUTIONAL EMAIL',
      labelPass: 'PASSWORD',
      labelConfirm: 'ULITIN ANG PASSWORD',
      labelSchool: 'PAARALAN / DIVISION',
      labelKey: 'SECRET ADMIN KEY',
      placeholderEmpId: 'Ipasok ang Employee ID',
      placeholderName: 'Ipasok ang buong pangalan',
      placeholderEmail: 'name@neu.edu.ph',
      placeholderPass: 'Dapat 8+ na karakter',
      placeholderConfirm: 'Ulitin ang password',
      placeholderSchool: 'Ipasok ang paaralan o division',
      placeholderKey: 'Ipasok ang Admin Key',
      terms: 'Sumasang-ayon ako sa Terms at Privacy Policy.',
      btn: 'Gumawa ng Account',
      footer: 'May account na? Mag-log in',
      weak: 'Masyadong mahina ang password.',
      mismatch: 'Hindi tugma ang mga password.',
      required: 'Kumpletuhin ang lahat ng required fields.',
      emailInvalid: 'Magpasok ng wastong @neu.edu.ph email.',
      needEmp: 'Kailangan ang Employee ID para sa guro.',
      needKey: 'Kailangan ang wastong admin secret key.',
      agreed: 'Paki-check ang Terms at Privacy Policy.',
      successTitle: 'Tagumpay sa Rehistrasyon',
      successMsg: 'Hintayin muna ang approval ng admin bago mag-sign in.',
      privacyTitle: 'Privacy Notice',
      privacyBody:
        'Una, nasa device ang progress. Walang ads, tracker, o data ng bata na ipinapadala sa AI. Ang matanda ang pipili kung kailan i-sync sa guro gamit ang QR. Pwede burahin ang data anumang oras.',
    },
  };
  const t = content[lang];

  const strength = (() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  })();

  const strengthColor = ['#EF4444', '#F97316', '#FBBF24', '#4ADE80'][Math.max(0, strength - 1)] ?? '#EF4444';

  const safeBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/user-selection');
  };

  const clearError = () => setError('');

  const handleSignup = async () => {
    setError('');

    if (!email.trim() || !password || !confirmPassword || !fullName.trim()) {
      setError(t.required);
      return;
    }
    if (currentRole === 'teacher' && !employeeId.trim()) {
      setError(t.needEmp);
      return;
    }
    if (!EMAIL_RE.test(email.trim()) || !email.trim().toLowerCase().endsWith('@neu.edu.ph')) {
      setError(t.emailInvalid);
      return;
    }
    if (password.length < 8 || strength < 2) {
      setError(t.weak);
      return;
    }
    if (password !== confirmPassword) {
      setError(t.mismatch);
      return;
    }
    if (!agree) {
      setError(t.agreed);
      return;
    }
    if (currentRole === 'admin' && !adminKeyConfigured) {
      setError(lang === 'ph' ? 'Hindi naka-configure ang admin access.' : 'Admin access is not configured.');
      return;
    }
    if (currentRole === 'admin' && adminKey !== ADMIN_KEY) {
      setError(t.needKey);
      return;
    }

    setLoading(true);
    try {
      const cleanEmployeeId = employeeId.trim().toUpperCase();

      if (currentRole === 'teacher') {
        let allowedSnap;
        try {
          const allowedDocRef = doc(db, 'allowed_teachers', cleanEmployeeId);
          allowedSnap = await getDoc(allowedDocRef);
        } catch {
          setError(lang === 'ph' ? 'Hindi ma-access ang database.' : 'Database access denied. Please verify permissions.');
          return;
        }

        if (!allowedSnap || !allowedSnap.exists()) {
          setError(lang === 'ph'
            ? 'Hindi natagpuan ang Employee ID sa official NEU directory.'
            : 'Employee ID was not found in the official NEU faculty directory.');
          return;
        }

        const allowedData = allowedSnap.data();
        if (allowedData.isRegistered) {
          setError(lang === 'ph'
            ? 'May account na para sa Employee ID na ito.'
            : 'This Employee ID already has an account.');
          return;
        }
        if (allowedData.email && allowedData.email.toLowerCase() !== email.trim().toLowerCase()) {
          setError(lang === 'ph'
            ? 'Hindi tugma ang email sa record ng Employee ID.'
            : 'Email does not match the record for this Employee ID.');
          return;
        }
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: fullName.trim() });

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        employeeId: currentRole === 'teacher' ? cleanEmployeeId : 'ADMIN',
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        role: currentRole,
        status: 'pending',
        school: currentRole === 'teacher' ? (school.trim() || 'New Era University') : 'NEU Central Admin',
        createdAt: new Date().toISOString(),
      });

      if (currentRole === 'teacher') {
        await setDoc(doc(db, 'allowed_teachers', cleanEmployeeId), { isRegistered: true }, { merge: true });
      }

      await signOut(auth);
      router.replace('/(auth)/login');
    } catch (err: any) {
      setError(err.code === 'auth/email-already-in-use'
        ? (lang === 'ph' ? 'Ginagamit na ang email na ito.' : 'This email is already in use.')
        : (lang === 'ph' ? 'May naganap na error. Subukan muli.' : 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
      >
        <View style={styles.responsiveWrapper}>
          <View style={styles.header}>
            <TouchableOpacity onPress={safeBack} style={styles.backBtn} accessibilityLabel="Back">
              <Text style={styles.backArrow}>←</Text>
            </TouchableOpacity>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarActive} />
              <View style={styles.progressBarActive} />
            </View>
            <Text style={styles.progressText}>2/2</Text>
          </View>

          <View style={styles.content}>
            <Text style={styles.mainTitle}>{t.title}</Text>

            {currentRole === 'teacher' && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: '#1E3A8A' }]}>{t.labelEmpId}</Text>
                <TextInput
                  style={[styles.input, { borderColor: '#1E3A8A' }]}
                  placeholder={t.placeholderEmpId}
                  value={employeeId}
                  onChangeText={(v) => { setEmployeeId(v); clearError(); }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.labelName}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.placeholderName}
                value={fullName}
                onChangeText={(v) => { setFullName(v); clearError(); }}
                autoComplete="name"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.labelEmail}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.placeholderEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={(v) => { setEmail(v); clearError(); }}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.labelPass}</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  style={[styles.input, styles.inputWithIcon]}
                  placeholder={t.placeholderPass}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={(v) => { setPassword(v); clearError(); }}
                  autoComplete="new-password"
                />
                <TouchableOpacity
                  style={styles.eyeBtn}
                  onPress={() => setShowPassword(!showPassword)}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
              <View style={styles.strengthTrack}>
                <View style={[styles.strengthFill, { width: `${strength * 25}%`, backgroundColor: strengthColor }]} />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t.labelConfirm}</Text>
              <TextInput
                style={styles.input}
                placeholder={t.placeholderConfirm}
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={(v) => { setConfirmPassword(v); clearError(); }}
                autoComplete="new-password"
              />
            </View>

            {currentRole === 'teacher' ? (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t.labelSchool}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t.placeholderSchool}
                  value={school}
                  onChangeText={(v) => { setSchool(v); clearError(); }}
                />
              </View>
            ) : (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: '#F77F67' }]}>{t.labelKey}</Text>
                <TextInput
                  style={[styles.input, { borderColor: '#F77F67' }]}
                  placeholder={t.placeholderKey}
                  secureTextEntry
                  value={adminKey}
                  onChangeText={(v) => { setAdminKey(v); clearError(); }}
                />
              </View>
            )}

            {!!error && (
              <View style={styles.messageBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#B91C1C" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.termsRow} onPress={() => setAgree(!agree)}>
              <View style={[styles.checkbox, agree && styles.checkboxActive]}>
                {agree && <Ionicons name="checkmark" size={13} color="white" />}
              </View>
              <Text style={styles.termsText}>{t.terms}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPrivacyVisible(true)} style={styles.privacyLink}>
              <Text style={styles.privacyLinkText}>{t.privacyTitle}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnCreate, (!agree || loading) && styles.btnDisabled]}
              disabled={!agree || loading}
              onPress={handleSignup}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.btnText}>{t.btn}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.footerTouch}>
              <Text style={styles.footerText}>
                {t.footer.split('?')[0]}? <Text style={styles.loginLink}>{t.footer.split('?')[1]}</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal visible={privacyVisible} transparent animationType="fade" onRequestClose={() => setPrivacyVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPrivacyVisible(false)}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#16A34A" />
              <Text style={styles.modalTitle}>{t.privacyTitle}</Text>
            </View>
            <Text style={styles.modalBody}>{t.privacyBody}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setPrivacyVisible(false)}>
              <Text style={styles.modalBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB' },
  scrollContainer: { paddingBottom: 40, alignItems: 'center' },
  responsiveWrapper: { width: '100%', maxWidth: 550, paddingHorizontal: '8%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 18 },
  headerTitle: { fontSize: normalize(10), fontWeight: '900', color: '#999', letterSpacing: 1.2 },
  backArrow: { fontSize: 20, color: '#333' },
  progressBarContainer: { flexDirection: 'row', flex: 0.8, height: 6, backgroundColor: '#E5E5E5', borderRadius: 3, overflow: 'hidden' },
  progressBarActive: { flex: 0.5, backgroundColor: '#1E3A8A' },
  progressText: { fontSize: 12, color: '#999', fontWeight: 'bold' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  content: { marginTop: 4 },
  mainTitle: { fontSize: normalize(24), fontWeight: '900', color: '#333', marginBottom: 25 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: normalize(11), fontWeight: '700', color: '#999', marginBottom: 8 },
  input: { backgroundColor: 'white', height: 55, borderRadius: 30, paddingHorizontal: 20, fontSize: normalize(15), borderWidth: 1, borderColor: '#F0F0F0' },
  inputWrap: { position: 'relative' },
  inputWithIcon: { paddingRight: 52 },
  eyeBtn: { position: 'absolute', right: 14, top: 0, height: 55, justifyContent: 'center' },
  strengthTrack: { height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', marginTop: 8, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 2 },
  messageBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 12 },
  errorText: { flex: 1, color: '#B91C1C', fontSize: normalize(12), lineHeight: 18 },
  termsRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: '#1E3A8A', marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#1E3A8A' },
  termsText: { flex: 1, fontSize: normalize(11), color: '#666' },
  privacyLink: { alignSelf: 'flex-start', marginBottom: 6 },
  privacyLinkText: { color: '#1E3A8A', fontWeight: '800', fontSize: normalize(11), textDecorationLine: 'underline' },
  btnCreate: { backgroundColor: '#1E3A8A', height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 3 },
  btnDisabled: { backgroundColor: '#9CA3AF' },
  btnText: { color: 'white', fontSize: normalize(16), fontWeight: '700' },
  footerTouch: { alignSelf: 'center', marginTop: 24 },
  footerText: { textAlign: 'center', color: '#777', fontSize: normalize(13) },
  loginLink: { color: '#1E3A8A', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: 'white', borderRadius: 22, padding: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  modalTitle: { fontSize: normalize(15), fontWeight: '900', color: '#1F2937' },
  modalBody: { fontSize: normalize(12), color: '#4B5563', lineHeight: 19 },
  modalBtn: { alignSelf: 'flex-end', backgroundColor: '#1E3A8A', paddingHorizontal: 20, paddingVertical: 9, borderRadius: 16, marginTop: 16 },
  modalBtnText: { color: 'white', fontWeight: '800', fontSize: normalize(12) },
});
