import { Tabs } from 'expo-router';
import { View, TouchableOpacity, Text, StyleSheet, Platform, Dimensions, PixelRatio, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage, useUser } from '../_layout'; 
import { useEffect, useRef, useState } from 'react';
import { auth, db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const scale = SCREEN_WIDTH / 375;
const normalize = (size: number) => Math.round(PixelRatio.roundToNearestPixel(size * scale));
const isTablet = SCREEN_WIDTH > 550;

export default function TabLayout() {
  const { firebaseUser } = useUser();

  return (
    <Tabs
      tabBar={(props) => (firebaseUser ? <CustomTabBar {...props} /> : null)}
      screenOptions={{ 
        headerShown: false,
        tabBarHideOnKeyboard: true 
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'HOME' }} />
      <Tabs.Screen name="bakas" options={{ title: 'BAKÁS' }} />
      <Tabs.Screen name="progress" options={{ title: 'PROGRESS' }} />
      <Tabs.Screen name="teacher" options={{ title: 'TEACHER' }} />
      <Tabs.Screen name="admin-dashboard" options={{ title: 'ADMIN' }} />
    </Tabs>
  );
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { lang } = useLanguage();
  const [role, setRole] = useState<'admin' | 'teacher' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeDoc = () => {};

    // Session listener para kilalanin ang account na pumasok
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        // Kapag nag-logout, linisin ang local states at patayin ang Firestore snapshot listener
        setRole(null);
        setLoading(false);
        unsubscribeDoc(); 
        return;
      }

      setLoading(true);
      const userRef = doc(db, "users", user.uid);
      
      unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          const userRole = docSnap.data().role;
          setRole(userRole);

          // 🔥 AUTO-REDIRECT PARA SA ADMIN:
          // Kung napatunayang 'admin', awtomatikong dadalhin sa admin-dashboard route.
          if (userRole === 'admin') {
            navigation.navigate('admin-dashboard');
          }
        } else {
          setRole('teacher');
        }
        setLoading(false);
      }, (error) => {
        // Tinitiyak na sinalo nang mapayapa ang error tuwing magtatapos ang session (Sign Out)
        console.log("Error checking role inside tabbar handled gracefully.");
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      unsubscribeDoc();
    };
  }, [navigation]);

  // Habang naghihintay ng signal mula sa Firebase Firestore
  if (loading) {
    return (
      <View style={styles.tabBarContainer}>
        <View style={[styles.tabBar, { justifyContent: 'center' }]}>
          <ActivityIndicator color="#F77F67" size="small" />
        </View>
      </View>
    );
  }

  // 🛡️ KRITIKAL NA PAGSALA NG MGA ROUTES
  const visibleRoutes = state.routes.filter((route: any) => {
    if (role === 'admin') {
      // Kapag ADMIN ang naka-login, tanging ang 'admin-dashboard' tab LAMANG ang makikita.
      return route.name === 'admin-dashboard';
    } else {
      // Kapag TEACHER naman, lalabas ang Home, Bakas, Progress, at Teacher (itago ang Admin).
      return route.name !== 'admin-dashboard';
    }
  });

  return (
    <View style={styles.tabBarContainer}>
      <View style={styles.tabBar}>
        {visibleRoutes.map((route: any) => {
          const originalIndex = state.routes.findIndex((r: any) => r.key === route.key);
          const isFocused = state.index === originalIndex;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          let iconName = 'home';
          let displayTitle = 'Home';

          if (route.name === 'index') {
            iconName = isFocused ? 'home' : 'home-outline';
            displayTitle = lang === 'ph' ? 'Bahay' : 'Home';
          } else if (route.name === 'bakas') {
            iconName = isFocused ? 'brush' : 'brush-outline';
            displayTitle = lang === 'ph' ? 'Bakas' : 'Trace';
          } else if (route.name === 'progress') {
            iconName = isFocused ? 'stats-chart' : 'stats-chart-outline';
            displayTitle = lang === 'ph' ? 'Suri' : 'Progress';
          } else if (route.name === 'teacher') {
            iconName = isFocused ? 'person-circle' : 'person-circle-outline';
            displayTitle = lang === 'ph' ? 'Guro' : 'Teacher';
          } else if (route.name === 'admin-dashboard') {
            iconName = isFocused ? 'shield-checkmark' : 'shield-checkmark-outline';
            displayTitle = lang === 'ph' ? 'Admin' : 'Admin';
          }

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={isFocused ? styles.tabItemActive : styles.tabItem}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={iconName as any} 
                size={isFocused ? normalize(18) : normalize(22)} 
                color={isFocused ? 'white' : '#AAA'} 
              />
              {/* Inilabas ang text label para makita rin ito habang naka-focus ang tab para sa mas magandang UX */}
              <Text style={[styles.tabLabel, { color: isFocused ? 'white' : '#AAA' }]}>
                {displayTitle}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: isTablet ? (SCREEN_WIDTH - 520) / 2 : '5%',
    right: isTablet ? (SCREEN_WIDTH - 520) / 2 : '5%',
    width: isTablet ? 520 : '90%',
    alignSelf: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    height: isTablet ? 85 : 75,
    borderRadius: 40,
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    paddingHorizontal: 10,
  },
  tabItemActive: {
    backgroundColor: '#F77F67',
    width: isTablet ? 78 : 68,
    height: isTablet ? 78 : 68,
    borderRadius: 39,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20, 
    elevation: 6,
    shadowColor: '#F77F67',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  tabItem: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
    minWidth: 60,
  },
  tabLabel: {
    fontSize: normalize(8.5),
    fontWeight: '900',
    marginTop: 2,
  }, 
});