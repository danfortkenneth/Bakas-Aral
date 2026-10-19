import React from 'react'; // Tinanggal ang useState dito
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
import { useLanguage } from './_layout'; // Import ang global context

const { width, height } = Dimensions.get('window');

// Bagong Scale Font logic para mag-fit sa Phones at Tablets nang hindi sumasabog ang laki
const isTablet = width >= 768;
const scaleFont = (size: number) => {
  const scaled = size * (width / 375);
  // Kung tablet, lagyan ng cap/limit para hindi maging dambuhala ang text
  if (isTablet) {
    return size * 1.3; 
  }
  return scaled;
};

export default function WelcomePage() {
  const router = useRouter();
  
  // 1. Gamitin ang Global Context sa halip na local useState
  const { lang, setLang } = useLanguage();

  // 2. Content Dictionary (Nanatiling pareho pero naka-link na sa global lang)
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
      {/* Wrapper para sa Tablet at Big Screens para hindi mag-stretch nang buong-buo */}
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
          <View>
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
  responsiveWrapper: { flex: 1, width: '100%', maxWidth: 550, justifyContent: 'space-between' }, // Sinisiguradong hindi sasabog ang layout sa tablet
  langSwitcher: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: width * 0.08,
    marginTop: Platform.OS === 'android' ? 40 : 10,
    alignItems: 'center',
    zIndex: 10,
  },
  langBtn: { padding: 10 },
  langText: { fontSize: 14, color: '#AAA', fontWeight: 'bold' },
  langActive: { color: '#F77F67' },
  langDivider: { marginHorizontal: 5, color: '#DDD' },
  header: { flex: 0.22, paddingHorizontal: width * 0.08, justifyContent: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  mainLogo: { width: width * 0.18, height: width * 0.18, maxWidth: 80, maxHeight: 80 },
  brandTextContainer: { marginLeft: 12 },
  brandTitle: { fontSize: scaleFont(12), color: '#999', fontWeight: '600', letterSpacing: 1.5 },
  brandSub: { fontSize: scaleFont(20), fontWeight: 'bold', color: '#333' },
  pill: { backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: 'flex-start', marginTop: 15, borderWidth: 1, borderColor: '#F0F0F0' },
  pillText: { fontSize: scaleFont(10), color: '#666', fontWeight: '700' },
  mainContent: { flex: 0.48, paddingHorizontal: width * 0.08, justifyContent: 'center' },
  titleBlack: { fontSize: scaleFont(38), fontWeight: '800', color: '#222' },
  titleOrange: { fontSize: scaleFont(38), fontWeight: '800', color: '#F7A072', marginTop: -5 },
  description: { marginTop: 15, fontSize: scaleFont(14), color: '#666', lineHeight: scaleFont(22) },
  featureRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
  featureCircle: { width: isTablet ? 110 : width * 0.25, height: isTablet ? 110 : width * 0.25, borderRadius: 20, backgroundColor: 'white', borderWidth: 1, borderColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center', elevation: 3 },
  featLabel: { fontSize: scaleFont(9), fontWeight: '800', color: '#AAA', marginTop: 4 },
  footer: { flex: 0.3, paddingHorizontal: width * 0.08, justifyContent: 'flex-end', paddingBottom: height * 0.04 },
  btnStart: { backgroundColor: '#F77F67', height: isTablet ? 65 : height * 0.07, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  btnStartText: { color: 'white', fontSize: scaleFont(18), fontWeight: 'bold' },
  btnLogin: { backgroundColor: 'white', height: isTablet ? 65 : height * 0.07, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginTop: 12, borderWidth: 1, borderColor: '#EEE' },
  btnLoginText: { color: '#333', fontSize: scaleFont(16), fontWeight: 'bold' },
  termsText: { textAlign: 'center', fontSize: scaleFont(10), color: '#BBB', marginTop: 15 }
});