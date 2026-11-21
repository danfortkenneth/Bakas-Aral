import { Tabs, useRouter } from 'expo-router';
import { View, TouchableOpacity, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage, useUser } from '../_layout'; 
import { useEffect, useState } from 'react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { normalizeFor, useResponsive } from '../../lib/responsive';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const router = useRouter();
  const { lang } = useLanguage();
  const { firebaseUser } = useUser();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, isTablet: isTabletDevice, isSmallPhone } = useResponsive();
  const [roleState, setRoleState] = useState<'admin' | 'teacher' | null>(null);
  const [loadedUid, setLoadedUid] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;

    const uid = firebaseUser.uid;
    const userRef = doc(db, "users", uid);

    const unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
      const userRole = docSnap.exists() ? docSnap.data().role : 'teacher';
      setRoleState(userRole);
      setLoadedUid(uid);

      if (userRole === 'admin' && navigation?.navigate) {
        navigation.navigate('admin-dashboard');
      }
    }, (error) => {
      console.log("Error checking role inside tabbar handled gracefully:", error.message);
      setLoadedUid(uid);
    });

    return () => {
      unsubscribeDoc();
    };
  }, [firebaseUser, navigation]);

  // Derive these instead of calling setState synchronously inside the effect
  const role = firebaseUser ? roleState : null;
  const loading = !!firebaseUser && loadedUid !== firebaseUser.uid;

  // Live metrics so the floating bar fits 320 dp phones and wide tablets.
  const barWidth = Math.min(windowWidth * 0.9, isTabletDevice ? 520 : 460);
  const barHeight = isSmallPhone ? 64 : isTabletDevice ? 85 : 75;
  const barBottom = Math.max(insets.bottom, Platform.OS === 'ios' ? 16 : 12);

  if (loading) {
    return (
      <View
        style={[
          styles.tabBarContainer,
          { bottom: barBottom, width: barWidth, left: (windowWidth - barWidth) / 2 },
        ]}
      >
        <View style={[styles.tabBar, { justifyContent: 'center', height: barHeight }]}>
          <ActivityIndicator color="#F77F67" size="small" />
        </View>
      </View>
    );
  }

  // 🛡️ KRITIKAL NA PAGSALA NG MGA ROUTES
  const visibleRoutes = (state?.routes || []).filter((route: any) => {
    if (role === 'admin') {
      return route.name === 'admin-dashboard';
    } else {
      return route.name !== 'admin-dashboard';
    }
  });

  const routeCount = Math.max(visibleRoutes.length, 1);
  // Active pill and inactive slots share the bar; shrink both on narrow screens.
  const activeSize = Math.max(46, Math.min(isTabletDevice ? 78 : 68, barWidth / routeCount - 8));
  const inactiveMinWidth = Math.max(38, Math.min(60, barWidth / routeCount - 6));

  return (
    <View
      style={[
        styles.tabBarContainer,
        { bottom: barBottom, width: barWidth, left: (windowWidth - barWidth) / 2 },
      ]}
    >
      <View style={[styles.tabBar, { height: barHeight }]}>
        {visibleRoutes.map((route: any) => {
          const originalIndex = state.routes.findIndex((r: any) => r.key === route.key);
          const isFocused = state.index === originalIndex;

          const onPress = () => {
            const event = navigation?.emit 
              ? navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
              : null;

            if (!isFocused && (!event || !event.defaultPrevented)) {
              if (navigation?.navigate) {
                navigation.navigate(route.name);
              } else {
                // Pag-handle sa Expo Router fallback: kapag 'index', ididirekta sa root tab
                if (route.name === 'index') {
                  router.push('/(tabs)');
                } else {
                  router.push(`/(tabs)/${route.name}` as any);
                }
              }
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
              style={isFocused
                ? [styles.tabItemActive, {
                    width: activeSize,
                    height: activeSize,
                    borderRadius: activeSize / 2,
                    marginTop: -(activeSize * 0.3),
                  }]
                : [styles.tabItem, { minWidth: inactiveMinWidth }]}
              activeOpacity={0.8}
            >
              <Ionicons 
                name={iconName as any} 
                size={isFocused ? (isSmallPhone ? 16 : 18) : (isSmallPhone ? 19 : 22)}
                color={isFocused ? 'white' : '#AAA'} 
              />
              <Text style={[styles.tabLabel, { color: isFocused ? 'white' : '#AAA', fontSize: isSmallPhone ? 7.5 : normalizeFor(windowWidth, 8.5) }]}>
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
    alignSelf: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
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
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  tabLabel: {
    fontWeight: '900',
    marginTop: 2,
  }, 
});