import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  PixelRatio, 
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import jsQR from 'jsqr';
import { decode as decodeBase64 } from 'base64-js';
import { decode as decodeJpeg } from 'jpeg-js';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375;
const normalize = (size: number) => Math.round(PixelRatio.roundToNearestPixel(size * scale));

interface ChildProgressReport {
  nickname: string;
  avatar: string;
  accuracy: string;
  duration: string;
  starsEarned: number;
  unlockedStickers: string[];
  charBreakdown?: Record<string, { accuracy: string; status: string }>;
  timestamp: string;
  school: string;
}

export default function ParentsDashboardScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [savedProgress, setSavedProgress] = useState<ChildProgressReport | null>(null);

  useEffect(() => {
    loadLocalParentData();
  }, []);

  const loadLocalParentData = async () => {
    try {
      const activeProfile = await AsyncStorage.getItem('@parent_active_child');
      if (activeProfile) {
        setSavedProgress(JSON.parse(activeProfile));
      } else {
        setIsScanning(true);
      }
    } catch (e) {
      console.error("Failed to load local storage data.");
    } finally {
      setLoading(false);
    }
  };

  const processQRData = async (rawData: string) => {
    try {
      const parsedData = JSON.parse(rawData);

      if (parsedData.appIdentifier !== "BAKAS_ARAL_PARENT_SYNC") {
        Alert.alert("Invalid QR Code", "This QR code is not generated from the Bakas-Aral Teacher Dashboard.");
        return;
      }

      const fullReport: ChildProgressReport = {
        nickname: parsedData.nickname || "Student",
        avatar: (parsedData.avatar || "tiger").toLowerCase(),
        accuracy: parsedData.accuracy || "100%",
        duration: parsedData.duration || "0s",
        starsEarned: parsedData.starsEarned || 3,
        unlockedStickers: parsedData.unlockedStickers || ['A'],
        charBreakdown: parsedData.charBreakdown || { 'A': { accuracy: parsedData.accuracy || '100%', status: 'DONE' } },
        timestamp: parsedData.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        school: parsedData.school || "Bakas-Aral Learning Center"
      };

      await AsyncStorage.removeItem('@parent_active_child');
      await AsyncStorage.setItem('@parent_active_child', JSON.stringify(fullReport));

      setSavedProgress(fullReport);
      setIsScanning(false);

      Alert.alert("Synchronization Successful 🎉", `Loaded the progress report for ${fullReport.nickname}.`);
    } catch (error) {
      Alert.alert("QR Code Error", "Unable to decode the QR code data. Please ensure it originates from the Teacher Application.");
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    processQRData(data);
  };

  const handleUploadQRImage = async () => {
    try {
      const currentPermission = await ImagePicker.getMediaLibraryPermissionsAsync();
      let isGranted = currentPermission.granted;

      if (!isGranted && currentPermission.canAskAgain) {
        const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
        isGranted = requested.granted;
      }

      if (!isGranted) {
        Alert.alert(
          "Photo Permission Required",
          "Access to Photo Library is blocked. Please allow access in Device Settings > Photos."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const selectedImageUri = result.assets[0].uri;

        try {
          const scanFn = (CameraView as any).scanFromImageAsync;
          if (typeof scanFn === 'function') {
            const scannedResults = await scanFn(selectedImageUri, ["qr"]);
            if (scannedResults && scannedResults.length > 0) {
              processQRData(scannedResults[0].data);
              return;
            }
          }
        } catch (e) {
          // Fall back to JS decoder if native scanning fails
        }

        try {
          const base64 = await FileSystem.readAsStringAsync(selectedImageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });

          const byteArray = decodeBase64(base64);
          const rawImageData = decodeJpeg(byteArray, { useTArray: true });

          const code = jsQR(
            Uint8ClampedArray.from(rawImageData.data),
            rawImageData.width,
            rawImageData.height
          );

          if (code && code.data) {
            processQRData(code.data);
          } else {
            Alert.alert(
              "No QR Code Found", 
              "Could not detect a valid QR Code in the selected image. Please ensure the image is clear and well-lit."
            );
          }
        } catch (decodeErr) {
          console.error("Error decoding JS QR:", decodeErr);
          Alert.alert(
            "Unreadable QR Code", 
            "Unable to process the image format. Please select a JPEG/JPG image."
          );
        }
      }
    } catch (e) {
      console.log("Gallery picker error or cancelled:", e);
    }
  };

  const handleLogoutToUserSelection = () => {
    Alert.alert(
      "Exit Portal",
      "Are you sure you want to log out and return to the User Selection screen?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Log Out", 
          style: "destructive", 
          onPress: async () => {
            await AsyncStorage.removeItem('@parent_active_child');
            setSavedProgress(null);
            router.replace('/(auth)/user-selection' as any);
          } 
        }
      ]
    );
  };

  const getAvatarEmoji = (avatar: string) => {
    const cleanAvatar = (avatar || '').toLowerCase();
    switch (cleanAvatar) {
      case 'tiger': return '🐯';
      case 'lion': return '🦁';
      case 'bear': return '🐻';
      case 'rabbit': return '🐰';
      case 'panda': return '🐼';
      case 'fox': return '🦊';
      case 'koala': return '🐨';
      case 'monkey': return '🐵';
      case 'cat': return '🐱';
      case 'dog': return '🐶';
      case 'pig': return '🐷';
      case 'mouse': return '🐭';
      default: return '👶';
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#F77F67" />
        <Text style={{ marginTop: 10, color: '#666' }}>Loading Parent Portal...</Text>
      </View>
    );
  }

  if (isScanning || !savedProgress) {
    if (!permission) return <View style={styles.center}><Text>Requesting Camera permission...</Text></View>;

    if (!permission.granted) {
      return (
        <View style={styles.center}>
          <Ionicons name="qr-code-outline" size={60} color="#F77F67" style={{ marginBottom: 15 }} />
          <Text style={{ textAlign: 'center', marginBottom: 20, color: '#444', paddingHorizontal: 20 }}>
            Camera permission is required to scan the student QR Code provided by the teacher to access the Parent Dashboard.
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={{ color: 'white', fontWeight: 'bold' }}>Grant Camera Access</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.permissionBtn, { backgroundColor: '#FFF5F3', borderWidth: 1, borderColor: '#F77F67', marginTop: 10 }]} 
            onPress={handleUploadQRImage}
          >
            <Text style={{ color: '#F77F67', fontWeight: 'bold' }}>Upload from Gallery</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        <View style={StyleSheet.absoluteFill}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={handleBarcodeScanned}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          />
          <View style={styles.overlayScanner}>
            <View style={styles.scanNoticeCard}>
              <Text style={styles.scanNoticeTitle}>🔑 Parent Portal Access Gate</Text>
              <Text style={styles.scanNoticeSub}>
                Scan the QR Code on the Teacher's device or upload a QR image from the gallery to sync the full progress report.
              </Text>
              <TouchableOpacity style={styles.overlayUploadBtn} onPress={handleUploadQRImage}>
                <Ionicons name="image-outline" size={18} color="white" />
                <Text style={styles.overlayUploadText}>Upload QR Image</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {savedProgress && (
                <TouchableOpacity style={styles.cancelScanBtn} onPress={() => setIsScanning(false)}>
                  <Text style={{ color: 'white', fontWeight: 'bold' }}>Dashboard</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.logoutScanBtn} onPress={handleLogoutToUserSelection}>
                <Ionicons name="log-out-outline" size={18} color="white" />
                <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 4 }}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* HEADER WITH LOGOUT */}
        <View style={styles.header}>
          <View>
            <Text style={styles.subtitle}>PARENTS ECOSYSTEM</Text>
            <Text style={styles.title}>Progress Report</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.rescanHeaderBtn} onPress={() => setIsScanning(true)}>
              <Ionicons name="qr-code-outline" size={16} color="#F77F67" />
              <Text style={styles.rescanHeaderText}>Resync</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutHeaderBtn} onPress={handleLogoutToUserSelection}>
              <Ionicons name="log-out-outline" size={16} color="#EF4444" />
              <Text style={styles.logoutHeaderText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ACTIVE CHILD CARD */}
        <View style={styles.activeChildCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.cardTag}>OFFICIAL SCHOOL REPORT</Text>
            <Text style={{ color: '#9CA3AF', fontSize: normalize(8) }}>{savedProgress.timestamp}</Text>
          </View>

          <View style={styles.childMetaRow}>
            <Text style={styles.childEmoji}>
              {getAvatarEmoji(savedProgress.avatar)}
            </Text>
            <View>
              <Text style={styles.childName}>{savedProgress.nickname}</Text>
              <Text style={styles.childSchool}>{savedProgress.school}</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={styles.practiceBtn} 
            onPress={() => router.push({
              pathname: '/parent-dashboard/sandbox' as any,
              params: { 
                studentName: savedProgress.nickname,
                activeAvatar: savedProgress.avatar,
                selectedChar: 'A'
              }
            })}
          >
            <MaterialCommunityIcons name="play-circle" size={24} color="#141414" />
            <Text style={styles.practiceBtnText}>{`Start Practice Session for ${savedProgress.nickname}`}</Text>
          </TouchableOpacity>
        </View>

        {/* METRICS GRID */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: '#ECFDF5' }]}>
            <MaterialCommunityIcons name="target" size={22} color="#10B981" />
            <Text style={styles.metricValue}>{savedProgress.accuracy}</Text>
            <Text style={styles.metricLabel}>Accuracy Rate</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="time" size={22} color="#3B82F6" />
            <Text style={styles.metricValue}>{savedProgress.duration}</Text>
            <Text style={styles.metricLabel}>Practice Duration</Text>
          </View>
        </View>

        {/* REWARDS & STICKERS */}
        <View style={styles.rewardCard}>
          <View style={styles.rewardRow}>
            <View style={styles.rewardItem}>
              <Ionicons name="star" size={24} color="#F59E0B" />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.rewardCount}>{savedProgress.starsEarned}</Text>
                <Text style={styles.rewardLabel}>Stars Earned</Text>
              </View>
            </View>

            <View style={styles.rewardDivider} />

            <View style={styles.rewardItem}>
              <MaterialCommunityIcons name="sticker-emoji" size={24} color="#8B5CF6" />
              <View style={{ marginLeft: 8 }}>
                <Text style={styles.rewardCount}>{savedProgress.unlockedStickers.length}</Text>
                <Text style={styles.rewardLabel}>Stickers Unlocked</Text>
              </View>
            </View>
          </View>
        </View>

        {/* PER LETTER BREAKDOWN */}
        {savedProgress.charBreakdown && (
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>{`Letter Performance for ${savedProgress.nickname}`}</Text>
            {Object.entries(savedProgress.charBreakdown).map(([char, data], idx) => (
              <View key={idx} style={styles.historyRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.charBoxPlayed}>
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>{char}</Text>
                  </View>
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.historyDate}>{`Letter ${char}`}</Text>
                    <Text style={styles.historyMeta}>{`Accuracy: ${data.accuracy}`}</Text>
                  </View>
                </View>
                <View style={styles.badgeDone}>
                  <Text style={styles.badgeTextDone}>COMPLETED</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* MAIN BOTTOM LOGOUT BUTTON */}
        <TouchableOpacity style={styles.bottomLogoutBtn} onPress={handleLogoutToUserSelection}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.bottomLogoutText}>Exit Parent Portal</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  scrollContent: { padding: 20, paddingBottom: 50 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  subtitle: { fontSize: normalize(9), color: '#9CA3AF', fontWeight: 'bold' },
  title: { fontSize: normalize(15), fontWeight: '900', color: '#333', marginTop: 2 },
  rescanHeaderBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#F77F67' },
  rescanHeaderText: { color: '#F77F67', fontSize: normalize(9), fontWeight: 'bold', marginLeft: 4 },
  
  logoutHeaderBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEE2E2', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#FCA5A5' },
  logoutHeaderText: { color: '#EF4444', fontSize: normalize(9), fontWeight: 'bold', marginLeft: 4 },
  
  overlayScanner: { position: 'absolute', bottom: 40, left: 20, right: 20, alignItems: 'center' },
  scanNoticeCard: { backgroundColor: 'rgba(20, 20, 20, 0.9)', padding: 18, borderRadius: 20, width: '100%', marginBottom: 15, alignItems: 'center' },
  scanNoticeTitle: { color: '#4ADE80', fontWeight: 'bold', fontSize: normalize(12), textAlign: 'center', marginBottom: 6 },
  scanNoticeSub: { color: '#E5E7EB', fontSize: normalize(10), textAlign: 'center', lineHeight: 16, marginBottom: 12 },
  overlayUploadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F77F67', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  overlayUploadText: { color: 'white', fontSize: normalize(10), fontWeight: 'bold', marginLeft: 6 },
  cancelScanBtn: { backgroundColor: '#374151', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 15 },
  logoutScanBtn: { backgroundColor: '#EF4444', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 15, flexDirection: 'row', alignItems: 'center' },

  permissionBtn: { backgroundColor: '#F77F67', padding: 14, borderRadius: 12 },

  activeChildCard: { backgroundColor: '#141414', borderRadius: 25, padding: 20, marginBottom: 15 },
  cardTag: { color: '#4ADE80', fontSize: normalize(8), fontWeight: 'bold', letterSpacing: 1 },
  childMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 20 },
  childEmoji: { fontSize: normalize(32), marginRight: 15 },
  childName: { color: 'white', fontSize: normalize(16), fontWeight: 'bold' },
  childSchool: { color: '#9CA3AF', fontSize: normalize(10) },
  practiceBtn: { flexDirection: 'row', backgroundColor: '#4ADE80', padding: 15, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  practiceBtnText: { color: '#141414', fontWeight: 'bold', fontSize: normalize(12), marginLeft: 8 },
  
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  metricCard: { width: '48%', borderRadius: 20, padding: 15, alignItems: 'center', elevation: 1 },
  metricValue: { fontSize: normalize(16), fontWeight: '900', color: '#1F2937', marginVertical: 4 },
  metricLabel: { fontSize: normalize(9), fontWeight: '700', color: '#6B7280' },

  rewardCard: { backgroundColor: '#FFF', borderRadius: 20, padding: 16, marginBottom: 15, borderWidth: 1, borderColor: '#FDE68A' },
  rewardRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  rewardItem: { flexDirection: 'row', alignItems: 'center' },
  rewardCount: { fontSize: normalize(14), fontWeight: '900', color: '#1F2937' },
  rewardLabel: { fontSize: normalize(9), fontWeight: '700', color: '#78716C' },
  rewardDivider: { width: 1, height: 30, backgroundColor: '#FDE68A' },

  historySection: { backgroundColor: 'white', borderRadius: 25, padding: 20, marginBottom: 15 },
  sectionTitle: { fontSize: normalize(12), fontWeight: '900', color: '#333', marginBottom: 12 },
  historyRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  charBoxPlayed: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F77F67', justifyContent: 'center', alignItems: 'center' },
  historyDate: { fontWeight: 'bold', fontSize: normalize(11), color: '#333' },
  historyMeta: { fontSize: normalize(9), color: '#666', marginTop: 2 },
  badgeDone: { backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeTextDone: { color: '#16A34A', fontSize: normalize(8), fontWeight: '900' },

  bottomLogoutBtn: { 
    flexDirection: 'row', 
    backgroundColor: '#FFF', 
    borderWidth: 1.5, 
    borderColor: '#FCA5A5', 
    borderRadius: 16, 
    paddingVertical: 14, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1
  },
  bottomLogoutText: { 
    color: '#EF4444', 
    fontWeight: 'bold', 
    fontSize: normalize(11), 
    marginLeft: 8 
  }
});