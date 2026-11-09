import React from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  Dimensions, 
  Image,
  Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useLanguage } from './_layout';

const { width, height } = Dimensions.get('window');

// LIGTAS NA SCALE FONT FIX PARA SA WEB AT MOBILE
const isTablet = width >= 768;
const scaleFont = (size: number) => {
  // Sa web browser, huwag hayaang bumaba sa original size ang font
  if (Platform.OS === 'web') {
    return isTablet ? size * 1.2 : size;
  }
  const scaled = size * (width / 375);
  if (isTablet) {
    return size * 1.3; 
  }
  return scaled;
};

export default function WelcomePage() {
  const router = useRouter();
  const { lang, setLang } = useLanguage();

  const content = {
    en: {
      pill: "● FOR PRE-KINDERGARTEN",
      title1: "Feel the",
      title2: "Filipino letters.",
      desc: "A multi-sensory literacy experience — integrating haptic feedback, phonetic audio, and contextual anchor words.",
      start: "Get Started",
      login: "I already have an account",
      footer: "By continuing, you agree to our Terms & Privacy Policy.",
      haptic: "HAPTIC",
      phonics: "PHONICS",
      anchor: "ANCHOR"
    },
    ph: {
      pill: "● PARA SA PRE-KINDERGARTEN",
      title1: "Damhin ang",
      title2: "letrang Filipino.",
      desc: "Multi-sensory na pagbasa — haptic feedback, phonetic audio, at anchor words sa isang masayang laro.",
      start: "Magsimula",
      login: "May account na ako",
      footer: "Sa pagpapatuloy, sumasang-ayon ka sa aming Terms & Privacy.",
      haptic: "HAPTIC",
      phonics: "PHONICS",
      anchor: "ANCHOR"
    }
  };

  const t = content[lang];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.responsiveWrapper}>
        {/* LANGUAGE SWITCHER */}
        <View style={styles.langSwitcher}>
          <TouchableOpacity onPress={() => setLang('en')} style={styles.langBtn}>
            <Text style={[styles.langText, lang === 'en' && styles.langActive]}>EN</Text>
          </TouchableOpacity>
          <Text style={styles.langDivider}>|</Text>
          <TouchableOpacity onPress={() => setLang('ph')} style={styles.langBtn}>
            <Text style={[styles.langText, lang === 'ph' && styles.langActive]}>PH</Text>
          </TouchableOpacity>
        </View>

        {/* HEADER SECTION */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Image 
              source={require('../assets/images/logo-bakas.png')} 
              style={styles.mainLogo}
              resizeMode="contain"
            />
            <View style={styles.brandTextContainer}>
              <Text style={styles.brandTitle}>NEU-BAKÁS</Text>
              <Text style={styles.brandSub}>Haptic Literacy</Text>
            </View>
          </View>
          
          <View style={styles.pill}>
            <Text style={styles.pillText}>{t.pill}</Text>
          </View>
        </View>

        {/* MAIN CONTENT */}
        <View style={styles.mainContent}>
          <View style={{ width: '100%' }}>
            <Text style={styles.titleBlack}>{t.title1}</Text>
            <Text style={styles.titleOrange}>{t.title2}</Text>
            <Text style={styles.description}>{t.desc}</Text>
          </View>

          <View style={styles.featureRow}>
            {[
              { label: t.haptic, icon: '🖐️' },
              { label: t.phonics, icon: '🔊' },
              { label: t.anchor, icon: '🏠' }
            ].map((item) => (
              <View key={item.label} style={styles.featureCircle}>
                <Text style={{ fontSize: scaleFont(22) }}>{item.icon}</Text>
                <Text style={styles.featLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* FOOTER SECTION */}
        <View style={styles.footer}>
          <TouchableOpacity 
            activeOpacity={0.8}
            style={styles.btnStart}
            onPress={() => router.push('/(auth)/user-selection')} 
          >
            <Text style={styles.btnStartText}>{t.start}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            activeOpacity={0.7}
            style={styles.btnLogin}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.btnLoginText}>{t.login}</Text>
          </TouchableOpacity>
          
          <Text style={styles.termsText}>{t.footer}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center' },
  responsiveWrapper: { flex: 1, width: '100%', maxWidth: 480, justifyContent: 'space-between' },
  langSwitcher: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    marginTop: Platform.OS === 'android' ? 40 : 10,
    alignItems: 'center',
    zIndex: 10,
  },
  langBtn: { padding: 8 },
  langText: { fontSize: 14, color: '#AAA', fontWeight: 'bold' },
  langActive: { color: '#F77F67' },
  langDivider: { marginHorizontal: 5, color: '#DDD' },
  header: { paddingHorizontal: 24, justifyContent: 'center', marginTop: 10 },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  mainLogo: { width: 64, height: 64 },
  brandTextContainer: { marginLeft: 12, flexShrink: 1 },
  brandTitle: { fontSize: scaleFont(12), color: '#999', fontWeight: '600', letterSpacing: 1.5 },
  brandSub: { fontSize: scaleFont(20), fontWeight: 'bold', color: '#333' },
  pill: { backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginTop: 15, borderWidth: 1, borderColor: '#F0F0F0' },
  pillText: { fontSize: scaleFont(10), color: '#666', fontWeight: '700' },
  mainContent: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', marginVertical: 20 },
  titleBlack: { fontSize: scaleFont(36), fontWeight: '800', color: '#222' },
  titleOrange: { fontSize: scaleFont(36), fontWeight: '800', color: '#F7A072', marginTop: -5 },
  description: { marginTop: 12, fontSize: scaleFont(14), color: '#666', lineHeight: Platform.OS === 'web' ? 22 : scaleFont(22) },
  featureRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24 },
  featureCircle: { width: 90, height: 90, borderRadius: 20, backgroundColor: 'white', borderWidth: 1, borderColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  featLabel: { fontSize: scaleFont(9), fontWeight: '800', color: '#AAA', marginTop: 4 },
  footer: { paddingHorizontal: 24, justifyContent: 'flex-end', paddingBottom: 24 },
  btnStart: { backgroundColor: '#F77F67', height: 52, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  btnStartText: { color: 'white', fontSize: scaleFont(18), fontWeight: 'bold' },
  btnLogin: { backgroundColor: 'white', height: 52, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#EEE' },
  btnLoginText: { color: '#333', fontSize: scaleFont(16), fontWeight: 'bold' },
  termsText: { textAlign: 'center', fontSize: scaleFont(10), color: '#BBB', marginTop: 12 }
});