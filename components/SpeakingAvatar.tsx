/**
 * Placeholder "study buddy" avatar for the tracing screens.
 *
 * It shows a short speech bubble and speaks the line out loud with the device's
 * text-to-speech voice. No internet, no API key and no account data leave the
 * phone. Swap the emoji for a real PNG later — the bubble/voice logic stays.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Speech from 'expo-speech';

export type AvatarLine = { ph: string; en: string };

type Props = {
  line: AvatarLine;
  lang: 'en' | 'ph';
  /** Increment to repeat the same line. */
  trigger: number;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export default function SpeakingAvatar({ line, lang, trigger, size = 64, style }: Props) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showBubble, setShowBubble] = useState(true);
  const [englishFallback, setEnglishFallback] = useState(false);
  const [replay, setReplay] = useState(0);
  const [bounce] = useState(() => new Animated.Value(1));
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const text = lang === 'ph' ? line.ph : line.en;

    const speak = async () => {
      if (cancelled) return;
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
      setShowBubble(true);
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        if (cancelled) return;

        const filipino = voices.find((voice) => /^(fil|tl)[-_]/i.test(voice.language));
        const englishVoice = voices.find((voice) => /^en[-_]/i.test(voice.language));
        const useEnglish = lang === 'ph' && !filipino;
        const spoken = useEnglish ? line.en : text;
        const language = useEnglish
          ? englishVoice?.identifier ?? 'en-US'
          : lang === 'ph'
            ? filipino?.identifier ?? 'fil-PH'
            : englishVoice?.identifier ?? 'en-US';

        setEnglishFallback(useEnglish);
        Speech.stop();
        Speech.speak(spoken, {
          language,
          rate: 1.0,
          pitch: 1.5,
          onStart: () => {
            if (!cancelled) setIsSpeaking(true);
          },
          onDone: () => {
            if (!cancelled) setIsSpeaking(false);
          },
          onError: () => {
            if (!cancelled) setIsSpeaking(false);
          },
        });

        bubbleTimerRef.current = setTimeout(() => {
          if (!cancelled) setShowBubble(false);
        }, 4000);
      } catch {
        if (!cancelled) {
          setIsSpeaking(false);
          bubbleTimerRef.current = setTimeout(() => setShowBubble(false), 4000);
        }
      }
    };

    speak();
    return () => {
      cancelled = true;
      Speech.stop();
      if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    };
  }, [line.ph, line.en, lang, trigger, replay, bounce]);

  // Gentle bounce while the avatar is talking.
  useEffect(() => {
    if (isSpeaking) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bounce, { toValue: 1.07, duration: 260, useNativeDriver: true }),
          Animated.timing(bounce, { toValue: 1, duration: 260, useNativeDriver: true }),
        ])
      );
      loopRef.current = loop;
      loop.start();
    } else {
      loopRef.current?.stop();
      loopRef.current = null;
      Animated.timing(bounce, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    }
    return () => {
      loopRef.current?.stop();
      loopRef.current = null;
    };
  }, [isSpeaking, bounce]);

  const visibleText =
    lang === 'ph' ? (englishFallback ? line.en : line.ph) : line.en;

  return (
    <View
      style={[styles.wrapper, { width: size * 2.2 }, style]}
      pointerEvents="box-none"
    >
      {showBubble && (
        <View style={[styles.bubble, { maxWidth: size * 2.2 }]} pointerEvents="none">
          <Text style={styles.bubbleText} numberOfLines={3}>
            {visibleText}
          </Text>
        </View>
      )}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setReplay((value) => value + 1)}
        accessibilityLabel="Repeat instruction"
        style={styles.avatarButton}
      >
        <Animated.View style={{ transform: [{ scale: bounce }] }}>
          <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2 }]}>
            <Image
              source={require('../assets/images/student-avatar.png')}
              style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]}
              resizeMode="cover"
            />
          </View>
        </Animated.View>
        {isSpeaking && <View style={styles.talkBadge} />}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'flex-start', position: 'absolute' },
  bubble: {
    backgroundColor: 'white',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#FDE68A',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  bubbleText: { fontSize: 11, fontWeight: '700', color: '#7C4A03', lineHeight: 14 },
  avatarButton: { padding: 2 },
  avatarCircle: {
    backgroundColor: '#FFE9C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#F7A072',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },
  avatarImage: { overflow: 'hidden' },
  talkBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: 'white',
  },
});
