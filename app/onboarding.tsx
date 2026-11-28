/**
 * First-run child-safety and privacy notice.
 *
 * One clear consent step before the learner enters the app. No account, no
 * tracking, no ads — progress stays on the device until an adult exports it.
 */
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useLanguage } from './_layout';
import { BUTTON_HEIGHT, COLORS, RADIUS } from '../lib/theme';

const CONSENT_KEY = '@bakas_consent';

const COPY = {
  en: {
    tag: 'SAFE LEARNING SPACE',
    title: 'Welcome to Bakas-Aral',
    intro: 'A gentle tracing app for young learners. Here is how we keep it safe.',
    bullets: [
      'Progress is saved on this device first.',
      'No ads, no trackers, no in-app purchases.',
      'Sound, voice and haptics can be turned off anytime.',
      'An adult chooses when to sync with the teacher.',
    ],
    agree: 'I understand and agree to the Privacy Notice.',
    continue: 'Continue',
    more: 'Read the full notice',
    less: 'Show less',
    details:
      'Bakas-Aral stores learning progress locally and only syncs it when an adult scans a teacher QR code. We do not collect names, photos, or behavioural ads data from children. A parent or teacher may clear all saved data from the device at any time.',
  },
  ph: {
    tag: 'LIGTAS NA PAG-AARAL',
    title: 'Maligayang pagdating sa Bakas-Aral',
    intro: 'Isang maamang app para sa pagbakas ng mga bata. Ganito namin ito pinapanatiling ligtas.',
    bullets: [
      'Una, nasa device lang ang progress ng bata.',
      'Walang ads, tracker, o in-app purchase.',
      'Pwede patayin ang tunog, boses, at haptics anumang oras.',
      'Ang matanda ang pipili kung kailan i-sync sa guro.',
    ],
    agree: 'Nauunawaan ko at sumasang-ayon ako sa Privacy Notice.',
    continue: 'Magpatuloy',
    more: 'Basahin ang buong notice',
    less: 'Itago',
    details:
      'Sinasave ng Bakas-Aral ang progress sa device at isi-sync lang kapag na-scan ng matanda ang QR code ng guro. Hindi kami nangongolekta ng pangalan, larawan, o ad data mula sa mga bata. Pwede burahin ng magulang o guro ang lahat ng data sa device anumang oras.',
  },
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { lang, setLang } = useLanguage();
  const [agreed, setAgreed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CONSENT_KEY)
      .then((value) => {
        if (value === 'true') router.replace('/');
      })
      .catch(() => {});
  }, [router]);

  const accept = () => {
    if (!agreed) return;
    AsyncStorage.setItem(CONSENT_KEY, 'true').catch(() => {});
    router.replace('/');
  };

  const t = COPY[lang];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.langRow}>
          <TouchableOpacity onPress={() => setLang('en')} style={styles.langBtn}>
            <Text style={[styles.langText, lang === 'en' && styles.langActive]}>EN</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setLang('ph')} style={styles.langBtn}>
            <Text style={[styles.langText, lang === 'ph' && styles.langActive]}>PH</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t.tag}</Text>
        </View>

        <View style={styles.shield}>
          <Ionicons name="shield-checkmark" size={54} color="#16A34A" />
        </View>

        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.intro}>{t.intro}</Text>

        <View style={styles.card}>
          {t.bullets.map((line) => (
            <View key={line} style={styles.bulletRow}>
              <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
              <Text style={styles.bullet}>{line}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.moreRow} onPress={() => setExpanded(!expanded)}>
          <Text style={styles.moreText}>{expanded ? t.less : t.more}</Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color="#F77F67" />
        </TouchableOpacity>
        {expanded && <Text style={styles.details}>{t.details}</Text>}

        <TouchableOpacity style={styles.agreeRow} onPress={() => setAgreed(!agreed)}>
          <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
            {agreed && <Ionicons name="checkmark" size={14} color="white" />}
          </View>
          <Text style={styles.agreeText}>{t.agree}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.continueBtn, !agreed && styles.continueDisabled]}
          onPress={accept}
          disabled={!agreed}
        >
          <Text style={styles.continueText}>{t.continue}</Text>
          <Ionicons name="arrow-forward" size={18} color="white" />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream },
  content: { paddingHorizontal: 24, paddingBottom: 30, alignItems: 'center' },
  langRow: { flexDirection: 'row', alignSelf: 'flex-end', gap: 6, paddingTop: 10 },
  langBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: 'white' },
  langText: { fontWeight: '900', fontSize: 12, color: '#9CA3AF' },
  langActive: { color: COLORS.primary },
  badge: { backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, marginTop: 16 },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#15803D', letterSpacing: 0.6 },
  shield: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  title: { fontSize: 23, fontWeight: '900', color: '#1F2937', textAlign: 'center', marginTop: 16 },
  intro: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 8, lineHeight: 19 },
  card: { backgroundColor: 'white', borderRadius: 20, padding: 16, width: '100%', marginTop: 20, elevation: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  bullet: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 19 },
  moreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'center', marginTop: 14 },
  moreText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },
  details: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginTop: 10, backgroundColor: 'white', borderRadius: 14, padding: 14 },
  agreeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  agreeText: { flex: 1, fontSize: 12, color: '#374151', lineHeight: 17 },
  continueBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: COLORS.primary, height: BUTTON_HEIGHT, borderRadius: RADIUS.md, width: '100%', marginTop: 20 },
  continueDisabled: { backgroundColor: '#D1D5DB' },
  continueText: { color: 'white', fontWeight: '900', fontSize: 15 },
});
