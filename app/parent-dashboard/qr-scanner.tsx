import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CameraView } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { parseParentQR, saveParentQRPayload } from '../../lib/parentSync';

export default function QRScannerPortal() {
  const router = useRouter();

  // Process and save parsed QR data
  const handleProcessScannedQR = async (scannedRawString: string) => {
    try {
      const parsedPayload = parseParentQR(scannedRawString);
      await saveParentQRPayload(parsedPayload);

      Alert.alert(
        "Nai-sync na! 🎉", 
        `Tagumpay na naipatala ang datos ni ${parsedPayload.nickname}.`, 
        [{ text: "Tingnan ang Report", onPress: () => router.replace('/parent-dashboard/progress') }]
      );
    } catch (e: any) {
      Alert.alert("Error sa QR Code", "Hindi nababasa ang QR Code o hindi ito mula sa Bakas-Aral Teacher app.");
    }
  };

  // Upload at pag-scan ng QR mula sa Gallery Image
  const handleUploadQRImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert("Permiso kailangan", "Kailangan ng access sa Photos upang makapili ng litrato.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const selectedImageUri = result.assets[0].uri;

        // I-scan ang QR mula sanapiling image URI
        const scannedResults = await (CameraView as any).scanFromImageAsync(selectedImageUri, ["qr"]);
        
        if (scannedResults && scannedResults.length > 0) {
          handleProcessScannedQR(scannedResults[0].data);
        } else {
          Alert.alert("Walang QR Code", "Hindi nakakita ng valid na QR Code sa napiling litrato. Siguraduhing malinaw ang QR.");
        }
      }
    } catch (err) {
      console.error("Error sa scanning mula sa gallery:", err);
      Alert.alert("Error", "Nagkaroon ng problema sa pagbasa ng litrato. Subukang kumuha ng mas malinaw na larawan.");
    }
  };

  // Mock function para sa testing/simulation
  const handleMockScanSuccess = () => {
    const mockTeacherPayload = JSON.stringify({
      appIdentifier: "BAKAS_ARAL_PARENT_SYNC",
      studentId: "FB_STU_99812",
      nickname: "Juan Cruz",
      avatar: "lion",
      accuracy: "92%",
      duration: "65s",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      school: "NEU Pre-K Division"
    });

    handleProcessScannedQR(mockTeacherPayload);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>QR Code Scanner</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.scannerWrapper}>
        <View style={styles.cameraBox}>
          <Ionicons name="qr-code-outline" size={80} color="#F77F67" />
          <Text style={styles.scannerPlaceholder}>I-tapat ang QR Code ng Guro dito</Text>
        </View>
        <Text style={styles.hint}>
          I-scan ang QR Code na nakalabas sa screen ng Guro pagkatapos ng klase upang ma-sync ang datos at progress ng bata.
        </Text>
      </View>

      <View style={styles.actionContainer}>
        {/* Upload Button */}
        <TouchableOpacity style={styles.btnUpload} onPress={handleUploadQRImage}>
          <Ionicons name="image-outline" size={20} color="#F77F67" />
          <Text style={styles.btnUploadText}>Mag-upload ng QR mula sa Gallery</Text>
        </TouchableOpacity>

        {/* Simulation Test Button */}
        <TouchableOpacity style={styles.btnSimulate} onPress={handleMockScanSuccess}>
          <Text style={styles.btnText}>I-test ang Pag-Scan (Simulation)</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  title: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  scannerWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  cameraBox: { width: 260, height: 260, borderWidth: 3, borderColor: '#F77F67', borderStyle: 'dashed', borderRadius: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFF' },
  scannerPlaceholder: { color: '#999', fontWeight: 'bold', marginTop: 12, fontSize: 12 },
  hint: { textAlign: 'center', color: '#666', marginTop: 25, fontSize: 13, paddingHorizontal: 20, lineHeight: 18 },
  actionContainer: { marginBottom: 30, gap: 12 },
  btnUpload: { flexDirection: 'row', backgroundColor: '#FFF', borderWidth: 1.5, borderColor: '#F77F67', height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  btnUploadText: { color: '#F77F67', fontSize: 14, fontWeight: 'bold', marginLeft: 8 },
  btnSimulate: { backgroundColor: '#F77F67', height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  btnText: { color: 'white', fontSize: 14, fontWeight: 'bold' }
});