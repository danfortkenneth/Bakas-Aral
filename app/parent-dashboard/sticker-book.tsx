import React, { useCallback, useEffect, useState } from 'react';
import { COLORS } from '../../lib/theme';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TRACEABLE_LETTERS, TRACEABLE_NUMBERS } from '../../constants/traceableData';
import { VOICE_LINES } from '../../constants/voiceLines';
import { loadStickers } from '../../lib/stickers';
import { useLanguage } from '../_layout';

const ALL = [...TRACEABLE_LETTERS, ...TRACEABLE_NUMBERS];

export default function StickerBook() {
  const router = useRouter();
  const { lang } = useLanguage();
  const [stickers, setStickers] = useState<string[]>([]);

  const refresh = useCallback(() => {
    loadStickers().then(setStickers);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>
          {lang === 'ph' ? 'Album ng Sticker' : 'Sticker Album'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.summary}>
        <Ionicons name="albums-outline" size={20} color="#7C3AED" />
        <Text style={styles.summaryText}>
          {lang === 'ph'
            ? `${stickers.length}/${ALL.length} sticker ang nakolekta`
            : `${stickers.length}/${ALL.length} stickers collected`}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {ALL.map((character) => {
          const unlocked = stickers.includes(character);
          const art = VOICE_LINES[character]?.image;
          return (
            <View
              key={character}
              style={[styles.stickerItem, unlocked ? styles.stickerUnlocked : styles.stickerLocked]}
            >
              {unlocked && art ? (
                <Image source={art} style={styles.art} resizeMode="contain" />
              ) : (
                <Text style={styles.emoji}>{unlocked ? '⭐' : '🔒'}</Text>
              )}
              <Text style={[styles.char, !unlocked && styles.charLocked]}>{character}</Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.cream, paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  title: { fontSize: 20, fontWeight: '900', color: '#333' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'white', borderRadius: 18, padding: 14, marginBottom: 16 },
  summaryText: { fontSize: 13, fontWeight: '800', color: '#5B21B6' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingBottom: 30 },
  stickerItem: { width: '28%', aspectRatio: 0.85, borderRadius: 20, alignItems: 'center', justifyContent: 'center', padding: 10, elevation: 2 },
  stickerUnlocked: { backgroundColor: '#F0FDF4', borderWidth: 2, borderColor: '#4ADE80' },
  stickerLocked: { backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  art: { width: 54, height: 54 },
  emoji: { fontSize: 30 },
  char: { marginTop: 6, fontSize: 16, fontWeight: '900', color: '#166534' },
  charLocked: { color: '#9CA3AF' },
});
