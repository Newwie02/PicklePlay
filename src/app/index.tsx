import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../lib/auth';
import { palette } from '../theme/glass';

/** Sends people to the right landing spot for their session and role. */
export default function Index() {
  const { user, booting } = useAuth();

  if (booting) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bgTop, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.lime} size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  if (user.role === 'owner') return <Redirect href="/owner" />;
  return <Redirect href="/home" />;
}
