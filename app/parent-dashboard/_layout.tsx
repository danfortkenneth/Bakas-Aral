import { Stack } from 'expo-router';

export default function ParentDashboardLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false, // Itatago ang default Expo header para masunod ang custom UI mo
        animation: 'slide_from_right',
      }}
    />
  );
}