import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#030707' },
          headerTintColor: '#f5f5f7',
          contentStyle: { backgroundColor: '#030707' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Talkin' }} />
        <Stack.Screen name="gravando" options={{ title: 'Gravando', presentation: 'modal' }} />
      </Stack>
    </>
  );
}
