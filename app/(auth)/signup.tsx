import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  Dimensions, 
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useLanguage } from '../_layout'; 

import { auth, db } from '../../lib/firebase'; 
import { createUserWithEmailAndPassword, updateProfile, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const { width } = Dimensions.get('window');
const isTablet = width >= 768;
const scaleFont = (size: number) => {
  if (isTablet) return size * 1.2;
  return size * (width / 375);
};

export default function Signup() {
  const router = useRouter();
  const { lang } = useLanguage();
  const { role } = useLocalSearchParams(); 

  const currentRole = (role as string) || 'teacher';

  const [employeeId, setEmployeeId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [school, setSchool] = useState('New Era University');
  const [adminKey, setAdminKey] = useState('');
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);

  const DEV_SECRET_KEY = process.env.EXPO_PUBLIC_ADMIN_KEY || "BAKAS_DEV_2026"; 

  const content = {
    en: {
      sub: "ACCOUNT CREATION",
      title: currentRole === 'admin' ? "Administrator Registration" : "Faculty Registration",
      labelEmpId: "EMPLOYEE / FACULTY ID",
      labelName: "FULL NAME",
      labelEmail: "INSTITUTIONAL EMAIL",
      labelPass: "PASSWORD",
      labelSchool: "SCHOOL / DIVISION",
      labelKey: "SECRET ADMIN KEY",
      placeholderEmpId: "Enter Employee ID",
      placeholderName: "Enter Full Name",
      placeholderEmail: "name@neu.edu.ph",
      placeholderPass: "At least 6 characters",
      placeholderSchool: "Enter School or Division",
      placeholderKey: "Enter Admin Key",
      terms: "I agree to the Terms and Privacy Policy.",
      btn: "Create Account",
      footer: "Already have an account? Log-in",
      errorKey: "Invalid Secret Key for Admin authorization.",
      wait: "Please complete all required fields.",
      successTitle: "Registration Successful",
      successMsg: "Account created successfully. Please await Administrator approval before logging in.",
      emailError: "Only valid @neu.edu.ph institutional email addresses are permitted for faculty members.",
      invalidEmpId: "Employee ID was not found in the official NEU faculty directory.",
      emailMismatch: "Provided email does not match the record associated with this Employee ID."
    }
  };

  const t = content.en;

  const handleSignup = async () => {
    if (!email.trim() || !password || !fullName.trim()) {
      Alert.alert("Incomplete Information", t.wait);
      return;
    }

    if (currentRole === 'teacher' && !employeeId.trim()) {
      Alert.alert("Validation Error", "Employee ID is required for Teacher registration.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Validation Error", "Password must be at least 6 characters long.");
      return;
    }

    if (currentRole === 'teacher' && !email.toLowerCase().endsWith('@neu.edu.ph')) {
      Alert.alert("Invalid Email", t.emailError);
      return;
    }

    if (currentRole === 'admin' && adminKey !== DEV_SECRET_KEY) {
      Alert.alert("Access Denied", t.errorKey);
      return;
    }

    setLoading(true);

    try {
      const cleanEmployeeId = employeeId.trim().toUpperCase();

      // 1. WHITELIST VERIFICATION VIA FIRESTORE (allowed_teachers)
      if (currentRole === 'teacher') {
        let allowedSnap;
        try {
          const allowedDocRef = doc(db, 'allowed_teachers', cleanEmployeeId);
          allowedSnap = await getDoc(allowedDocRef);
        } catch (docErr: any) {
          console.error("Firestore Permission Check Error:", docErr);
          Alert.alert(
            "System Error", 
            "Database access denied. Please verify system permissions."
          );
          setLoading(false);
          return;
        }

        if (!allowedSnap || !allowedSnap.exists()) {
          Alert.alert("Access Denied", t.invalidEmpId);
          setLoading(false);
          return;
        }

        const allowedData = allowedSnap.data();

        if (allowedData.isRegistered) {
          Alert.alert("Registration Error", "This Employee ID is already associated with an existing account.");
          setLoading(false);
          return;
        }

        if (allowedData.email && allowedData.email.toLowerCase() !== email.trim().toLowerCase()) {
          Alert.alert("Mismatch Error", t.emailMismatch);
          setLoading(false);
          return;
        }
      }

      // 2. CREATE FIREBASE AUTH USER
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 3. UPDATE FIREBASE AUTH DISPLAY NAME
      await updateProfile(user, {
        displayName: fullName.trim()
      });

      // 4. RECORD USER DATA IN FIRESTORE
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        employeeId: currentRole === 'teacher' ? cleanEmployeeId : 'ADMIN',
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        role: currentRole, 
        status: currentRole === 'teacher' ? 'pending' : 'approved',
        school: currentRole === 'teacher' ? (school.trim() || 'New Era University') : 'NEU Central Admin',
        createdAt: new Date().toISOString(),
      });

      if (currentRole === 'teacher') {
        const allowedDocRef = doc(db, 'allowed_teachers', cleanEmployeeId);
        await setDoc(allowedDocRef, { isRegistered: true }, { merge: true });
      }

      // 5. SIGN OUT UPON CREATION TO PREVENT PENDING DIRECT ACCESS
      await signOut(auth);

      Alert.alert(t.successTitle, t.successMsg);
      router.replace('/(auth)/login'); 

    } catch (error: any) {
      let msg = error.message;
      if (error.code === 'auth/email-already-in-use') {
        msg = "This email address is already in use by another account.";
      }
      Alert.alert("Registration Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContainer}>
          <View style={styles.responsiveWrapper}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                <Text style={styles.backArrow}>←</Text>
              </TouchableOpacity>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarActive} />
                <View style={styles.progressBarActive} />
              </View>
              <Text style={styles.progressText}>2/2</Text>
            </View>

            <View style={styles.content}>
              <Text style={styles.subTitle}>{t.sub}</Text>
              <Text style={styles.mainTitle}>{t.title}</Text>

              {currentRole === 'teacher' && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: '#1E3A8A' }]}>{t.labelEmpId}</Text>
                  <TextInput 
                    style={[styles.input, { borderColor: '#1E3A8A' }]} 
                    placeholder={t.placeholderEmpId} 
                    value={employeeId}
                    onChangeText={setEmployeeId}
                    autoCapitalize="characters"
                  />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t.labelName}</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder={t.placeholderName} 
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t.labelEmail}</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder={t.placeholderEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t.labelPass}</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder={t.placeholderPass}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </View>

              {currentRole === 'teacher' ? (
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>{t.labelSchool}</Text>
                  <TextInput 
                    style={styles.input} 
                    placeholder={t.placeholderSchool}
                    value={school}
                    onChangeText={setSchool}
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
                    onChangeText={setAdminKey}
                  />
                </View>
              )}

              <TouchableOpacity style={styles.checkboxRow} onPress={() => setAgree(!agree)}>
                <View style={[styles.checkbox, agree && styles.checkboxActive]}>
                  {agree && <Text style={{ color: 'white', fontSize: 10 }}>✓</Text>}
                </View>
                <Text style={styles.termsText}>{t.terms}</Text>
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

              <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.footerText}>
                  {t.footer.split('?')[0]}? <Text style={styles.loginLink}>{t.footer.split('?')[1]}</Text>
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
  responsiveWrapper: { width: '100%', maxWidth: 550, paddingHorizontal: width * 0.08 },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 20, justifyContent: 'space-between', marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  backArrow: { fontSize: 20, color: '#333' },
  progressBarContainer: { flexDirection: 'row', flex: 0.8, height: 6, backgroundColor: '#E5E5E5', borderRadius: 3, overflow: 'hidden' },
  progressBarActive: { flex: 0.5, backgroundColor: '#1E3A8A' },
  progressText: { fontSize: 12, color: '#999', fontWeight: 'bold' },
  content: { marginTop: 10 },
  subTitle: { fontSize: 10, color: '#999', fontWeight: '700', letterSpacing: 1 },
  mainTitle: { fontSize: scaleFont(24), fontWeight: '900', color: '#333', marginTop: 5, marginBottom: 25 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 11, fontWeight: '700', color: '#999', marginBottom: 8 },
  input: { backgroundColor: 'white', height: 55, borderRadius: 30, paddingHorizontal: 20, fontSize: 15, elevation: 1, borderWidth: 1, borderColor: '#F0F0F0' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 15 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: '#1E3A8A', marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#1E3A8A' },
  termsText: { fontSize: 12, color: '#666' },
  btnCreate: { backgroundColor: '#1E3A8A', height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 3 },
  btnDisabled: { backgroundColor: '#9CA3AF' },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  footerText: { textAlign: 'center', marginTop: 30, color: '#777', fontSize: 14 },
  loginLink: { color: '#1E3A8A', fontWeight: 'bold' }
});