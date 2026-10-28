import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  Dimensions 
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from '../_layout'; 

const { width } = Dimensions.get('window');
const isTablet = width >= 768;
const scaleFont = (size: number) => {
  if (isTablet) return size * 1.2;
  return size * (width / 375);
};

export default function UserSelection() {
  const router = useRouter();
  const { lang } = useLanguage(); 
  
  const [selectedRole, setSelectedRole] = useState<'teacher' | 'admin' | 'parent' | null>(null);

  const content = {
    en: {
      sub: "CREATE AN ACCOUNT",
      title: "Who are you in NEU-Bakás?",
      teacher: "Teacher / Guro",
      teacherDesc: "Manage classes and track the accuracy of each child.",
      admin: "System Admin",
      adminDesc: "Developer access to manage system settings and accounts.",
      parent: "Parent / Magulang",
      parentDesc: "Monitor your child's progress and activities.",
      continue: "Continue",
      login: "Already have an account? Log-in"
    },
    ph: {
      sub: "LUMIKHA NG ACCOUNT",
      title: "Sino ka sa NEU-Bakás?",
      teacher: "Teacher / Guro",
      teacherDesc: "Magpatakbo ng klase, mag-track ng accuracy ng bawat bata.",
      admin: "System Admin",
      adminDesc: "Developer access para sa system settings at accounts.",
      parent: "Parent / Magulang",
      parentDesc: "Subaybayan ang progreso at mga aktibidad ng iyong anak.",
      continue: "Ituloy",
      login: "May account na? Mag-login"
    }
  };

  const t = content[lang];

  const handleContinue = () => {
    if (selectedRole === 'parent') {
      router.push('/parent-dashboard');
    } else if (selectedRole) {
      router.push({
        pathname: '/(auth)/signup',
        params: { role: selectedRole }
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.responsiveWrapper}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ fontSize: 20 }}>←</Text>
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar} />
          </View>
          <Text style={styles.progressText}>1/2</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.subTitle}>{t.sub}</Text>
          <Text style={styles.mainTitle}>{t.title}</Text>

          <TouchableOpacity 
            style={[styles.card, selectedRole === 'teacher' && styles.selectedCard]} 
            onPress={() => setSelectedRole('teacher')}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Text style={{fontSize: 30}}>👩‍🏫</Text>
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardTitle}>{t.teacher}</Text>
              <Text style={styles.cardDesc}>{t.teacherDesc}</Text>
            </View>
            <View style={[styles.radio, selectedRole === 'teacher' && styles.radioActive]}>
              {selectedRole === 'teacher' && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.card, selectedRole === 'admin' && styles.selectedCard]} 
            onPress={() => setSelectedRole('admin')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#E0F2FE' }]}>
              <Text style={{fontSize: 30}}>⚙️</Text>
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardTitle}>{t.admin}</Text>
              <Text style={styles.cardDesc}>{t.adminDesc}</Text>
            </View>
            <View style={[styles.radio, selectedRole === 'admin' && styles.radioActive]}>
              {selectedRole === 'admin' && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.card, selectedRole === 'parent' && styles.selectedCard]} 
            onPress={() => setSelectedRole('parent')}
            activeOpacity={0.7}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#E0FDEE' }]}>
              <Text style={{fontSize: 30}}>👪</Text>
            </View>
            <View style={styles.textContainer}>
              <Text style={styles.cardTitle}>{t.parent}</Text>
              <Text style={styles.cardDesc}>{t.parentDesc}</Text>
            </View>
            <View style={[styles.radio, selectedRole === 'parent' && styles.radioActive]}>
              {selectedRole === 'parent' && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            disabled={!selectedRole}
            style={[styles.btnContinue, !selectedRole && styles.btnDisabled]} 
            onPress={handleContinue}
          >
            <Text style={styles.btnText}>{t.continue}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.footerText}>
            {t.login.split('?')[0]}? <Text style={styles.loginLink}>{t.login.split('?')[1]}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB', alignItems: 'center' },
  responsiveWrapper: { flex: 1, width: '100%', maxWidth: 550, paddingHorizontal: width * 0.08 },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 20, justifyContent: 'space-between' },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  progressContainer: { flex: 0.8, height: 6, backgroundColor: '#E5E5E5', borderRadius: 3, overflow: 'hidden' },
  progressBar: { width: '50%', height: '100%', backgroundColor: '#F77F67' },
  progressText: { fontSize: 12, color: '#999', fontWeight: 'bold' },
  content: { flex: 1, justifyContent: 'center' },
  subTitle: { fontSize: 10, color: '#999', fontWeight: '700', letterSpacing: 1 },
  mainTitle: { fontSize: scaleFont(26), fontWeight: '900', color: '#333', marginVertical: 15 },
  card: { 
    flexDirection: 'row', 
    backgroundColor: 'white', 
    padding: 15, 
    borderRadius: 25, 
    marginBottom: 12, 
    alignItems: 'center', 
    elevation: 2, 
    borderWidth: 2, 
    borderColor: 'transparent' 
  },
  selectedCard: { borderColor: '#F77F67', backgroundColor: '#FFF5F2' },
  iconContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center' },
  textContainer: { flex: 1, marginLeft: 15, marginRight: 10 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  cardDesc: { fontSize: 11, color: '#777', marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#DDD', justifyContent: 'center', alignItems: 'center' },
  radioActive: { borderColor: '#F77F67' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F77F67' },
  btnContinue: { backgroundColor: '#F77F67', height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', marginTop: 20, elevation: 4 },
  btnDisabled: { backgroundColor: '#FFC1B5' },
  btnText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  footerText: { textAlign: 'center', marginBottom: 30, color: '#777', fontSize: 14 },
  loginLink: { color: '#F77F67', fontWeight: 'bold' }
});