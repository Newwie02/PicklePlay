import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/auth';
import { SignupProvider } from '../lib/signup';
import { palette } from '../theme/glass';

/**
 * Root navigator. Route guards live in each group's `_layout` / `index`,
 * so the navigator is always mounted and `router.replace` keeps working.
 */
export default function RootLayout() {
  return (
    <AuthProvider>
      <SignupProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: palette.bgTop },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="booking/[id]" />
          <Stack.Screen name="tournament/create" />
          <Stack.Screen name="tournament/[id]" />
          <Stack.Screen name="tournament/manage" />
          <Stack.Screen name="tournament/bracket" />
          <Stack.Screen name="tournament/teams" />
          <Stack.Screen name="owner" />
        </Stack>
      </SignupProvider>
    </AuthProvider>
  );
}
