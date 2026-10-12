import { Stack } from 'expo-router';
import { palette } from '../../theme/glass';

/** The three sign-up steps share one stack and hide the native header. */
export default function SignupLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: palette.bgTop },
      }}
    >
      <Stack.Screen name="step1" />
      <Stack.Screen name="step2" />
      <Stack.Screen name="step3" />
    </Stack>
  );
}
