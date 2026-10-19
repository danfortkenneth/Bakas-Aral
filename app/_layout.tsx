import { Stack, useRouter, useSegments } from 'expo-router';
import { createContext, useState, useContext, useEffect, useRef } from 'react';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

const LanguageContext = createContext({
  lang: 'en' as 'en' | 'ph',
  setLang: (_l: 'en' | 'ph') => {},
});

type ActiveStudent = { id: string | null; name: string; avatar: string | null };

const UserContext = createContext<{
  firebaseUser: User | null;
  userData: any;
  activeStudent: ActiveStudent;
  loading: boolean;
}>({
  firebaseUser: null,
  userData: null,
  activeStudent: { id: null, name: '---', avatar: null },
  loading: true,
});

export const useLanguage = () => useContext(LanguageContext);
export const useUser = () => useContext(UserContext);

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [lang, setLang] = useState<'en' | 'ph'>('en');
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [activeStudent, setActiveStudent] = useState<ActiveStudent>({
    id: null,
    name: '---',
    avatar: null,
  });
  const [loading, setLoading] = useState(true);
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    let unsubscribeUserDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      setFirebaseUser(user);

      if (!user) {
        setUserData(null);
        setActiveStudent({ id: null, name: '---', avatar: null });
        setLoading(false);
        return;
      }

      const userRef = doc(db, 'users', user.uid);
      unsubscribeUserDoc = onSnapshot(
        userRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);
            setActiveStudent({
              id: data.activeStudentId || null,
              name:
                data.activeStudentName ||
                (langRef.current === 'ph' ? 'Walang napiling bata' : 'No student selected'),
              avatar: data.activeStudentAvatar || null,
            });
          } else {
            setUserData(null);
            setActiveStudent({ id: null, name: '---', avatar: null });
          }
          setLoading(false);
        },
        (error) => {
          console.log('Teacher profile listener handled gracefully:', error.message);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) unsubscribeUserDoc();
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const root = segments[0];
    const screen = segments[1];
    const inTabs = root === '(tabs)';
    const isParentPractice = inTabs && screen === 'bakas';

    if (!firebaseUser && inTabs && !isParentPractice) {
      router.replace('/');
    }
  }, [firebaseUser, loading, segments, router]);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      <UserContext.Provider value={{ firebaseUser, userData, activeStudent, loading }}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)/user-selection" />
          <Stack.Screen name="(auth)/login" />
          <Stack.Screen name="(auth)/signup" />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="parent-dashboard" />
        </Stack>
      </UserContext.Provider>
    </LanguageContext.Provider>
  );
}
