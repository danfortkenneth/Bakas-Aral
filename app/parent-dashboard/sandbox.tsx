import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, PanResponder, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

export default function HomePracticeSandbox() {
  const router = useRouter();
  const [currentLetter, setCurrentLetter] = useState('A');

  // Trigger ng Haptic kapag tumama sa Linya
  const triggerCorrectStroke = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Trigger ng Haptic kapag lumampas sa Linya (Sharp Pulse)
  const triggerErrorPulse = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  };

  // Simulation ng Phonetic Audio Card
  const playPhoneticAudio = () => {
    Alert.alert("🔈 Phonetic Audio Simulation", `Playing: "${currentLetter}-${currentLetter}-${currentLetter}-Agila!"`);
    // Dito mo ikakabit ang Audio element mula sa assets:
    // const { sound } = await Audio.Sound.createAsync(require('../../assets/sounds/Atis.mp3'));
    // await sound.playAsync();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Practice Sandbox</Text>
        <TouchableOpacity onPress={playPhoneticAudio} style={styles.audioBtn}>
          <Text style={{ fontSize: 18 }}>🔊</Text>
        </TouchableOpacity>
      </View>

      {/* Tracing Canvas Area */}
      <View style={styles.canvasContainer}>
        <Text style={styles.guideText}>Trace the letter inside the box</Text>
        
        <View style={styles.letterBox}>
          {/* Background Tracing Template Letter */}
          <Text style={styles.traceTarget}>{currentLetter}</Text>
          
          {/* Interactive invisible nodes to trigger simulated haptics */}
          <TouchableOpacity 
            style={[styles.node, { top: '20%', left: '46%' }]} 
            onPressIn={triggerCorrectStroke}
          />
          <TouchableOpacity 
            style={[styles.node, { top: '50%', left: '30%' }]} 
            onPressIn={triggerCorrectStroke}
          />
          <TouchableOpacity 
            style={[styles.node, { top: '50%', left: '62%' }]} 
            onPressIn={triggerCorrectStroke}
          />
          {/* Simulated boundary limits (error zones) */}
          <TouchableOpacity 
            style={[styles.errorZone, { top: '45%', left: '5%' }]} 
            onPressIn={triggerErrorPulse}
          />
        </View>
      </View>

      {/* Contextual Anchor Word Cards */}
      <View style={styles.anchorCard}>
        <Text style={styles.anchorEmoji}>🦅</Text>
        <View>
          <Text style={styles.anchorTitle}>A para sa Agila!</Text>
          <Text style={styles.anchorSub}>Tap the speaker above to hear phonetics.</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  audioBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', elevation: 1 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  canvasContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  guideText: { color: '#777', fontSize: 14, marginBottom: 15, fontWeight: '600' },
  letterBox: { width: '90%', height: '65%', backgroundColor: 'white', borderRadius: 30, borderStyle: 'solid', borderWidth: 1, borderColor: '#E5E5E5', justifyContent: 'center', alignItems: 'center', position: 'relative', elevation: 2 },
  traceTarget: { fontSize: 180, fontWeight: '100', color: '#E5E5E5', textAlign: 'center' },
  node: { position: 'absolute', width: 45, height: 45, borderRadius: 25, backgroundColor: 'rgba(247, 127, 103, 0.15)', borderWidth: 1, borderColor: '#F77F67' },
  errorZone: { position: 'absolute', width: 50, height: 180, backgroundColor: 'rgba(239, 68, 68, 0.05)' },
  anchorCard: { flexDirection: 'row', backgroundColor: '#E0F2FE', padding: 20, borderRadius: 25, alignItems: 'center', marginBottom: 30, elevation: 1 },
  anchorEmoji: { fontSize: 40, marginRight: 15 },
  anchorTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E3A8A' },
  anchorSub: { fontSize: 11, color: '#6B7280', marginTop: 2 }
});