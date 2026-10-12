import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GlassBackground } from '../../components/glass/GlassBackground';
import { GlassCard } from '../../components/glass/GlassCard';
import { GlassInput } from '../../components/glass/GlassInput';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassSelect } from '../../components/glass/GlassSelect';
import { ErrorBanner } from '../../components/glass/Banner';
import { AvatarPicker } from '../../components/AvatarPicker';
import { GlassDatePicker } from '../../components/GlassDatePicker';
import { StepProgress } from '../../components/StepProgress';
import { DbError, updateProfile } from '../../lib/db';
import { supabase } from '../../lib/supabase';
import { useSignup } from '../../lib/signup';
import { useAuth } from '../../lib/auth';
import { BARANGAYS, GENDERS } from '../../lib/options';
import { validators } from '../../lib/validation';
import type { FieldErrors } from '../../lib/api';
import { palette, type } from '../../theme/glass';

const BIO_MAX = 255;

export default function SignUpStep3() {
  const router = useRouter();
  const draft = useSignup();
  const { signIn } = useAuth();

  const [avatar, setAvatar] = useState<string | null | undefined>(undefined);
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Step 3 only makes sense once Supabase Auth knows who we are.
  const [authUid, setAuthUid] = useState<string | null>(null);
  const [uidChecked, setUidChecked] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setAuthUid(data.user?.id ?? null);
      setUidChecked(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const clear = (key: string) => setErrors((p) => ({ ...p, [key]: '' }));

  const validate = () => {
    const next: Record<string, string | null> = {
      avatar: validators.avatar(avatar),
      bio: validators.bio(bio),
      location: validators.location(location),
      phone: validators.phone(phone),
      birthday: validators.birthday(birthday),
      gender: validators.gender(gender),
    };
    const cleaned = Object.fromEntries(Object.entries(next).filter(([, v]) => v)) as FieldErrors;
    setErrors(cleaned);
    setFormError(
      Object.keys(cleaned).length ? 'Almost there — check the highlighted fields.' : null
    );
    return Object.keys(cleaned).length === 0;
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (!validate()) return;
    const uid = authUid;
    if (!uid) {
      setFormError('Your session ended — please sign in again to finish setup.');
      return;
    }
    setBusy(true);
    try {
      const user = await updateProfile(uid, {
        avatar: avatar ?? null,
        bio: bio.trim(),
        location,
        phone: phone.replace(/[\s-]/g, ''),
        birthday,
        gender,
        profileComplete: true,
      });
      draft.reset();
      const { data: sessionData } = await supabase.auth.getSession();
      await signIn(sessionData.session?.access_token ?? '', user);
      router.replace('/home');
    } catch (e) {
      setFormError(e instanceof DbError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (uidChecked && !authUid) return <Redirect href="/signup/step1" />;

  return (
    <View style={styles.root}>
      <GlassBackground />
      <SafeAreaView style={styles.root}>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <StepProgress step={3} />

            <View style={styles.titleRow}>
              <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
                <Ionicons name="chevron-back" size={20} color={palette.white} />
              </Pressable>
              <View>
                <Text style={type.h1}>Set up your profile</Text>
                <Text style={type.caption}>Last step — this is what other players see.</Text>
              </View>
            </View>

            <ErrorBanner message={formError} />

            <GlassCard>
              <View style={styles.form}>
                <AvatarPicker
                  label="Profile picture *"
                  value={avatar ?? null}
                  onChange={(v) => {
                    setAvatar(v);
                    clear('avatar');
                  }}
                  firstName={draft.firstName}
                  lastName={draft.lastName}
                  error={errors.avatar || null}
                />

                <GlassInput
                  label="Bio"
                  placeholder="What do you play? Lefty, doubles lover, always early…"
                  multiline
                  maxLength={BIO_MAX}
                  value={bio}
                  onChangeText={(v) => {
                    setBio(v);
                    clear('bio');
                  }}
                  onBlur={() => setErrors((p) => ({ ...p, bio: validators.bio(bio) ?? '' }))}
                  error={errors.bio || null}
                  counter={{ length: bio.length, max: BIO_MAX }}
                />

                <GlassSelect
                  label="Location"
                  placeholder="Pick your barangay"
                  value={location}
                  options={BARANGAYS}
                  onSelect={(v) => {
                    setLocation(v);
                    clear('location');
                  }}
                  error={errors.location || null}
                  searchable
                />

                <GlassInput
                  label="Phone number"
                  placeholder="09XXXXXXXXX"
                  keyboardType="number-pad"
                  maxLength={11}
                  value={phone}
                  onChangeText={(v) => {
                    setPhone(v.replace(/[^\d]/g, ''));
                    clear('phone');
                  }}
                  onBlur={() => setErrors((p) => ({ ...p, phone: validators.phone(phone) ?? '' }))}
                  error={errors.phone || null}
                  hint={phone ? `${phone.length}/11 digits · starts with 09` : '11 digits, starts with 09.'}
                />

                <GlassDatePicker
                  label="Birthday"
                  value={birthday}
                  onChange={(v) => {
                    setBirthday(v);
                    clear('birthday');
                  }}
                  error={errors.birthday || null}
                />

                <GlassSelect
                  label="Gender"
                  placeholder="Choose one"
                  value={gender}
                  options={GENDERS}
                  onSelect={(v) => {
                    setGender(v);
                    clear('gender');
                  }}
                  error={errors.gender || null}
                />

                <GlassButton title="Create my account" onPress={handleSubmit} loading={busy} />
              </View>
            </GlassCard>

            <Text style={styles.legal}>
              By continuing you agree to keep PicklePlay friendly — no sandbagging, no smacking the
              net. 🙂
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgTop },
  container: { padding: 24, gap: 16, flexGrow: 1, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { gap: 16 },
  legal: { ...type.caption, fontSize: 12, textAlign: 'center', lineHeight: 17 },
});
