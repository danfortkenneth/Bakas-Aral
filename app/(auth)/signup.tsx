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

// 1. IMPORT FIREBASE 
import { auth, db } from '../../lib/firebase'; 
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

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

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [school, setSchool] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);

  const DEV_SECRET_KEY = "BAKAS_DEV_2026"; 

  const content = {
    en: {
      sub: "CREATE AN ACCOUNT",
      title: "Just a few more details",
      labelName: "FULL NAME",
      labelEmail: "EMAIL",
      labelPass: "PASSWORD",
      labelSchool: "SCHOOL NAME",
      labelKey: "SECRET ADMIN KEY",
      placeholderName: "Full Name",
      placeholderEmail: "name@neu.edu.ph",
      placeholderPass: "At least 8 characters",
      placeholderSchool: "Enter school name",
      placeholderKey: "Enter dev code",
      terms: "I agree to the Terms and Privacy.",
      btn: "Create Account",
      footer: "Already have an account? Log-in",
      errorKey: "Invalid Secret Key for Admin!",
      wait: "Please fill in all required fields.",
      successTitle: "Success!",
      successMsg: "Account created! Please wait for Admin approval before logging in.",
      emailError: "Only @neu.edu.ph emails are allowed for teachers!" 
    },
    ph: {
      sub: "LUMIKHA NG ACCOUNT",
      title: "Kaunti pang detalye",
      labelName: "BUONG PANGALAN",
      labelEmail: "EMAIL",
      labelPass: "PASSWORD",
      labelSchool: "PANGALAN NG PAARALAN",
      labelKey: "SECRET ADMIN KEY",
      placeholderName: "Liza Santos",
      placeholderEmail: "liza@neu.edu.ph",
      placeholderPass: "Hindi bababa sa 8 letra",
      placeholderSchool: "Ilagay ang paaralan",
      placeholderKey: "Ilagay ang dev code",
      terms: "Sumasang-ayon ako sa Terms at Privacy.",
      btn: "Buoin ang account",
      footer: "May account na? Mag-login",
      errorKey: "Maling Secret Key para sa Admin!",
      wait: "Paki-fill up lahat ng boxes.",
      successTitle: "Tagumpay!",
      successMsg: "Gawa na ang account! Mangyaring hintayin ang pag-apruba ng Admin bago mag-login.",
      emailError: "Tanging @neu.edu.ph na email lamang ang tinatanggap para sa mga guro!" 
    }
  };

  const t = content[lang];

  const handleSignup = async () => {
    if (!email || !password || !fullName) {
      Alert.alert("Wait lang!", t.wait);
      return;
    }

    // --- NEU EMAIL VALIDATION FOR TEACHERS ---
    if (role === 'teacher' && !email.toLowerCase().endsWith('@neu.edu.ph')) {
      Alert.alert("Invalid Email", t.emailError);
      return;
    }

    if (role === 'admin' && adminKey !== DEV_SECRET_KEY) {
      Alert.alert("Error", t.errorKey);
      return;
    }

    if (role === 'teacher' && !school) {
        Alert.alert("Error", lang === 'en' ? "Please enter your school name." : "Paki-lagay ang pangalan ng paaralan.");
        return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // 1. I-save ang user info kung saan may default status field na 'pending' para sa teacher
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName: fullName,
        email: email.toLowerCase(),
        role: role, 
        status: role === 'teacher' ? 'pending' : 'approved', // Ang teacher ay dadaan muna sa approval panel
        school: role === 'teacher' ? school : 'NEU Central Admin',
        createdAt: new Date().toISOString(),
      });

      // 2. --- DITO MAGAGANAP ANG INITIAL RESET NG SESSIONS SA FIRESTORE (Account-specific) ---
      if (role === 'teacher') {
        try {
          // Gumagamit na ng personalized document base sa user ID ng bagong guro
          const activeSessionRef = doc(db, 'sessions', `active_student_${user.uid}`);
          await setDoc(activeSessionRef, {
            studentId: null,
            studentName: '---',
            teacherId: user.uid,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (sessionError) {
          console.log("Error initializing session document:", sessionError);
        }
      }

      await signOut(auth);
      Alert.alert(t.successTitle, t.successMsg);
      router.replace('/login'); 

    } catch (error: any) {
      Alert.alert("Signup Failed", error.message);
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

              {role === 'teacher' ? (
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

              <TouchableOpacity onPress={() => router.push('/login')}>
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
  progressBarActive: { flex: 0.5, backgroundColor: '#F77F67' },
  progressText: { fontSize: 12, color: '#999', fontWeight: 'bold' },
  content: { marginTop: 10 },
  subTitle: { fontSize: 10, color: '#999', fontWeight: '700', letterSpacing: 1 },
  mainTitle: { fontSize: scaleFont(26), fontWeight: '900', color: '#333', marginTop: 5, marginBottom: 25 },
  inputGroup: { marginBottom: 15 },
  label: { fontSize: 11, fontWeight: '700', color: '#999', marginBottom: 8 },
  input: { backgroundColor: 'white', height: 55, borderRadius: 30, paddingHorizontal: 20, fontSize: 15, elevation: 1, borderWidth: 1, borderColor: '#F0F0F0' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 15 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: '#F77F67', marginRight: 10, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { backgroundColor: '#F77F67' },
  termsText: { fontSize: 12, color: '#666' },
  btnCreate: { backgroundColor: '#F77F67', height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginTop: 10, elevation: 3 },
  btnDisabled: { backgroundColor: '#FFC1B5' },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  footerText: { textAlign: 'center', marginTop: 30, color: '#777', fontSize: 14 },
  loginLink: { color: '#F77F67', fontWeight: 'bold' }
});