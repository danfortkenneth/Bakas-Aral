import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, Dimensions, PixelRatio, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375;
const normalize = (size: number) => Math.round(PixelRatio.roundToNearestPixel(size * scale));

interface ChildProgress {
  nickname: string;
  avatar: string;
  accuracy: string;
  duration: string;
  timestamp: string;
  school: string;
}

export default function ParentsDashboardScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanning, setIsScanning] = useState(false);
  const [savedProgress, setSavedProgress] = useState<ChildProgress | null>(null);
  const [pastSessions, setPastSessions] = useState<ChildProgress[]>([]);

  useEffect(() => {
    loadLocalParentData();
  }, []);

  // Mag-load ng data mula sa local phone memory ng magulang
  const loadLocalParentData = async () => {
    try {
      const activeProfile = await AsyncStorage.getItem('@parent_active_child');
      const historyLog = await AsyncStorage.getItem('@parent_sync_history');
      
      if (activeProfile) setSavedProgress(JSON.parse(activeProfile));
      if (historyLog) setPastSessions(JSON.parse(historyLog));
    } catch (e) {
      console.error("Failed to load local storage data.");
    }
  };

  // Proseso para sa Pag-parse at Pag-save ng QR Data
  const processQRData = async (rawData: string) => {
    try {
      const parsedData = JSON.parse(rawData);

      // Proteksyon: Siguraduhing QR ng Bakás-Aral ang na-scan
      if (parsedData.appIdentifier !== "BAKAS_ARAL_PARENT_SYNC") {
        Alert.alert("Maling QR Code", "Ang QR code na ito ay hindi galing sa Bakás-Aral Teacher Dashboard.");
        return;
      }

      const newRecord: ChildProgress = {
        nickname: parsedData.nickname,
        avatar: parsedData.avatar,
        accuracy: parsedData.accuracy,
        duration: parsedData.duration,
        timestamp: parsedData.timestamp,
        school: parsedData.school
      };

      // I-save sa Local Phone Memory ng Magulang (Decentralized!)
      await AsyncStorage.setItem('@parent_active_child', JSON.stringify(newRecord));
      
      const updatedHistory = [newRecord, ...pastSessions];
      await AsyncStorage.setItem('@parent_sync_history', JSON.stringify(updatedHistory));

      setSavedProgress(newRecord);
      setPastSessions(updatedHistory);

      Alert.alert("Sync Tagumpay!", `Na-import na ang pinakabagong classroom progress ni ${newRecord.nickname}!`);
    } catch (error) {
      Alert.alert("Error", "Hindi mabasa ang tamang data sa QR Code.");
    }
  };

  // 1. Handler para sa Live Camera Scanner
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    setIsScanning(false);
    processQRData(data);
  };

  // 2. Handler para sa Pag-upload ng QR mula sa Gallery (Litrato)
  const handleUploadQRImage = async () => {
    // Humingi ng permiso sa photo library
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permiso Kailangan", "Kailangan ng access sa iyong gallery upang makapili ng litrato ng QR.");
      return;
    }

    // Buksan ang image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets[0]) {
      const selectedImageUri = result.assets[0].uri;

      // Gagamit tayo ng scanner feature na kaya mag-scan mula sa local image uri
      try {
        const scannedResults = await CameraView.scanFromImageAsync(selectedImageUri, ["qr"]);
        if (scannedResults && scannedResults.length > 0) {
          processQRData(scannedResults[0].data);
        } else {
          Alert.alert("Walang QR Code", "Hindi nakakita ng QR Code sa napiling litrato. Siguraduhing malinaw ang pagkakakuha.");
        }
      } catch (err) {
        Alert.alert("Error", "May problema sa pag-scan ng litrato.");
      }
    }
  };

  if (!permission) return <View style={styles.center}><Text>Humihingi ng permiso sa Camera...</Text></View>;
  
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={{ textAlign: 'center', marginBottom: 15 }}>Kailangan ng app ang access sa camera para ma-scan ang QR ng Guro.</Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Bigyan ng Permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {isScanning ? (
        <View style={StyleSheet.absoluteFillObject}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
          <View style={styles.overlayScanner}>
            <Text style={styles.scannerGuideText}>Itapat ang camera sa QR Code sa Tablet ng Guro</Text>
            <TouchableOpacity style={styles.cancelScanBtn} onPress={() => setIsScanning(false)}>
              <Text style={{ color: 'white', fontWeight: 'bold' }}>Kanselahin</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* HEADER */}
          <View style={styles.header}>
            <View>
              <Text style={styles.subtitle}>PARENTS ECOSYSTEM</Text>
              <Text style={styles.title}>Gabay-Magulang Portal</Text>
            </View>
          </View>

          {/* DUAL ACTION BUTTONS FOR INPUTTING DATA */}
          <View style={styles.actionCardContainer}>
            <Text style={styles.actionSectionTitle}>I-sync ang Progress ng Anak</Text>
            <View style={styles.dualButtonRow}>
              
              {/* SCAN QR BUTTON */}
              <TouchableOpacity style={styles.actionBtnLive} onPress={() => setIsScanning(true)}>
                <Ionicons name="camera-outline" size={22} color="white" />
                <Text style={styles.actionBtnText}>I-scan ang Guro</Text>
              </TouchableOpacity>

              {/* UPLOAD QR BUTTON */}
              <TouchableOpacity style={styles.actionBtnUpload} onPress={handleUploadQRImage}>
                <Ionicons name="image-outline" size={22} color="#F77F67" />
                <Text style={[styles.actionBtnText, { color: '#F77F67' }]}>I-upload ang QR</Text>
              </TouchableOpacity>

            </View>
          </View>

          {/* ACTIVE CHILD PORTAL CARD & HOME PRACTICE LAUNCHER */}
          {savedProgress ? (
            <View style={styles.activeChildCard}>
              <Text style={styles.cardTag}>AKTIBONG PROPEYL SA BAHAY</Text>
              <View style={styles.childMetaRow}>
                <Text style={styles.childEmoji}>
                  {savedProgress.avatar === 'lion' ? '🦁' : savedProgress.avatar === 'bear' ? '🐻' : '🐰'} 
                </Text>
                <View>
                  <Text style={styles.childName}>{savedProgress.nickname}</Text>
                  <Text style={styles.childSchool}>{savedProgress.school}</Text>
                </View>
              </View>

              {/* PRACTICE MODE BUTTON */}
              <TouchableOpacity 
                style={styles.practiceBtn} 
                onPress={() => router.push({
                  pathname: '/bakas', 
                  params: { parentMode: 'true', studentName: savedProgress.nickname }
                })}
              >
                <MaterialCommunityIcons name="play-circle" size={24} color="#141414" />
                <Text style={styles.practiceBtnText}>Simulan ang Practice sa Bahay</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <MaterialCommunityIcons name="account-child-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>Walang aktibong profile ng bata. Gamitin ang mga button sa itaas para mag-scan o mag-upload ng QR code galing sa guro.</Text>
            </View>
          )}

          {/* CLASSROOM SCORE HISTORY LOGS */}
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>📈 Kasaysayan ng Pag-unlad (School Logs)</Text>
            {pastSessions.length === 0 ? (
              <Text style={styles.emptySubText}>Mag-scan o mag-upload ng QR pagkatapos ng klase upang makita rito ang mga nakaraang accuracy rate ng bata.</Text>
            ) : (
              pastSessions.map((session, idx) => (
                <View key={idx} style={styles.historyRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.historyIcon}>📊</Text>
                    <View>
                      <Text style={styles.historyDate}>{session.timestamp} - Klase sa Paaralan</Text>
                      <Text style={styles.historyMeta}>{`Katumpakan (Accuracy): ${session.accuracy} | Oras: ${session.duration}`}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  scrollContent: { padding: 20, paddingBottom: 50 },
  header: { marginBottom: 20 },
  subtitle: { fontSize: normalize(9), color: '#9CA3AF', fontWeight: 'bold' },
  title: { fontSize: normalize(16), fontWeight: '900', color: '#333', marginTop: 2 },
  
  // Styles para sa Dual Input Card Control
  actionCardContainer: { backgroundColor: 'white', borderRadius: 25, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: '#F3F4F6' },
  actionSectionTitle: { fontSize: normalize(11), fontWeight: '900', color: '#333', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  dualButtonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  actionBtnLive: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F77F67', paddingVertical: 12, borderRadius: 15 },
  actionBtnUpload: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF5F3', paddingVertical: 12, borderRadius: 15, borderWidth: 1, borderColor: '#F77F67' },
  actionBtnText: { color: 'white', fontWeight: 'bold', fontSize: normalize(11), marginLeft: 6 },

  permissionBtn: { backgroundColor: '#F77F67', padding: 12, borderRadius: 10 },
  overlayScanner: { position: 'absolute', bottom: 50, left: 20, right: 20, alignItems: 'center' },
  scannerGuideText: { color: 'white', fontWeight: 'bold', textAlign: 'center', marginBottom: 20, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 10 },
  cancelScanBtn: { backgroundColor: '#EF4444', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  activeChildCard: { backgroundColor: '#141414', borderRadius: 25, padding: 20, marginBottom: 20 },
  cardTag: { color: '#4ADE80', fontSize: normalize(8), fontWeight: 'bold', letterSpacing: 1 },
  childMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 20 },
  childEmoji: { fontSize: normalize(32), marginRight: 15 },
  childName: { color: 'white', fontSize: normalize(16), fontWeight: 'bold' },
  childSchool: { color: '#9CA3AF', fontSize: normalize(10) },
  practiceBtn: { flexDirection: 'row', backgroundColor: '#4ADE80', padding: 15, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  practiceBtnText: { color: '#141414', fontWeight: 'bold', fontSize: normalize(12), marginLeft: 8 },
  emptyCard: { backgroundColor: 'white', borderRadius: 25, padding: 30, alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB' },
  emptyText: { color: '#666', fontSize: normalize(10), textAlign: 'center', marginTop: 10, lineHeight: 16 },
  historySection: { backgroundColor: 'white', borderRadius: 25, padding: 20 },
  sectionTitle: { fontSize: normalize(12), fontWeight: '900', color: '#333', marginBottom: 12 },
  emptySubText: { color: '#9CA3AF', fontSize: normalize(10), lineHeight: 16, textAlign: 'center', paddingVertical: 10 },
  historyRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyIcon: { fontSize: normalize(18), marginRight: 10 },
  historyDate: { fontWeight: 'bold', fontSize: normalize(11), color: '#333' },
  historyMeta: { fontSize: normalize(9), color: '#666', marginTop: 2 }
});