import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, FlatList, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function StickerBook() {
  const router = useRouter();
  const [stickers, setStickers] = useState<string[]>(["⭐️ First Steps", "✍️ Perfect Line"]); // Default starter stickers
  const [hearts, setHearts] = useState(3);

  useEffect(() => {
    loadStickers();
  }, []);

  const loadStickers = async () => {
    const stored = await AsyncStorage.getItem('@collected_stickers');
    if (stored) {
      const parsed = JSON.parse(stored);
      setStickers([...stickers, ...parsed]);
    }
  };

  const handleFeedAnimal = () => {
    setHearts(prev => prev + 1);
    Alert.alert("Yum! 😋", "You fed the active animal avatar! It loves you more now.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={{ fontSize: 20 }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Sticker Rewards</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Mini-Game Segment */}
      <View style={styles.miniGameBox}>
        <Text style={styles.gameHeading}>Feed Your Animal Avatar</Text>
        <Text style={{ fontSize: 60, marginVertical: 10 }}>🦁</Text>
        <Text style={styles.heartRating}>❤️ Affinity Level: {hearts}</Text>
        <TouchableOpacity style={styles.feedBtn} onPress={handleFeedAnimal}>
          <Text style={styles.feedBtnText}>🍖 Give Treat</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Your Digital Album Collection</Text>

      {/* Sticker Album List Grid */}
      <FlatList
        data={stickers}
        numColumns={2}
        keyExtractor={(item, index) => index.toString()}
        columnWrapperStyle={{ justifyContent: 'space-between' }}
        renderItem={({ item }) => (
          <View style={styles.stickerItem}>
            <Text style={styles.stickerThumb}>{item.split(' ')[0]}</Text>
            <Text style={styles.stickerText}>{item.substring(item.indexOf(' ') + 1)}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFBEB', paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 20 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'white', justifyContent: 'center', alignItems: 'center', elevation: 2 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  miniGameBox: { backgroundColor: 'white', padding: 20, borderRadius: 25, alignItems: 'center', elevation: 2, marginBottom: 25 },
  gameHeading: { fontSize: 14, fontWeight: '700', color: '#555' },
  heartRating: { fontSize: 13, color: '#E11D48', fontWeight: 'bold', marginBottom: 12 },
  feedBtn: { backgroundColor: '#10B981', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 15 },
  feedBtnText: { color: 'white', fontWeight: 'bold', fontSize: 13 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: '#444', marginBottom: 15 },
  stickerItem: { flex: 0.47, backgroundColor: 'white', padding: 15, borderRadius: 20, alignItems: 'center', marginBottom: 15, elevation: 1, borderWidth: 1, borderColor: '#F3F4F6' },
  stickerThumb: { fontSize: 35, marginBottom: 5 },
  stickerText: { fontSize: 12, fontWeight: '600', color: '#444', textAlign: 'center' }
});