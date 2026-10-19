import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function QRScannerPortal() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Mock function para gayahin ang successful scan
  const handleMockScanSuccess = async () => {
    const mockClassroomData = {
      accuracyScore: 88,
      completionTime: "2 mins, 15 secs",
      activeAvatar: "Lion 🦁",
      unlockedSticker: "Star Badge"
    };

    try {
      // I-save sa lokal na memory (AsyncStorage) nang walang internet
      await AsyncStorage.setItem('@classroom_data', JSON.stringify(mockClassroomData));
      
      // Magdagdag ng sticker sa Sticker Book list
      const existingStickers = await AsyncStorage.getItem('@collected_stickers');
      const stickerList = existingStickers ? JSON.parse(existingStickers) : [];
      if (!stickerList.includes("🦁 Lion Badge")) {
        stickerList.push("🦁 Lion Badge");
        await AsyncStorage.setItem('@collected_stickers', JSON.stringify(stickerList));
      }

      Alert.alert("Success! 🎉", "Data successfully imported from Teacher device.", [
        { text: "View Report", onPress: () => router.replace('/parent-dashboard/progress') }
      ]);
    } catch (e) {
      Alert.alert("Error", "Failed to save local data.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>QR Code Scanner</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.scannerWrapper}>
        <View style={styles.cameraBox}>
          {/* Dito papasok ang Camera View kapag sinalpakan mo ng expo-camera */}
          <Text style={styles.scannerPlaceholder}>[ Align QR Code Here ]</Text>
        </View>
        <Text style={styles.hint}>Scan the QR Code on the Teacher's screen after class to sync data.</Text>
      </View>

      <TouchableOpacity style={styles.btnSimulate} onPress={handleMockScanSuccess}>
        <Text style={styles.btnText}>Simulate Successful Scan</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  scannerWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraBox: { width: 260, height: 260, borderWidth: 3, borderColor: '#F77F67', borderStyle: 'dashed', borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  scannerPlaceholder: { color: '#999', fontWeight: 'bold' },
  hint: { textAlign: 'center', color: '#666', marginTop: 25, fontSize: 13, paddingHorizontal: 20, lineHeight: 18 },
  btnSimulate: { backgroundColor: '#F77F67', height: 55, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 30, elevation: 3 },
  btnText: { color: 'white', fontSize: 16, fontWeight: 'bold' }
});