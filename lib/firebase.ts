import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: 'AIzaSyBwkp5UxRyvDAB8hsvTXEFFAcQyUR9S5Lo',
  authDomain: 'neu-bakas-86a28.firebaseapp.com',
  projectId: 'neu-bakas-86a28',
  storageBucket: 'neu-bakas-86a28.firebasestorage.app',
  messagingSenderId: '756520800544',
  appId: '1:756520800544:web:c588dbdb54228aa534c745',
  measurementId: 'G-4L598GK50E',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function createAuth() {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }

  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = getFirestore(app);
