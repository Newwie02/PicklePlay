import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GlassBackground } from '../../components/glass/GlassBackground';
import { GlassCard } from '../../components/glass/GlassCard';
import { GlassInput } from '../../components/glass/GlassInput';
import { GlassButton } from '../../components/glass/GlassButton';
import { GlassSelect } from '../../components/glass/GlassSelect';
import { Avatar } from '../../components/glass/Avatar';
import { ErrorBanner, SuccessBanner } from '../../components/glass/Banner';
import { AvatarPicker } from '../../components/AvatarPicker';
import { GlassDatePicker } from '../../components/GlassDatePicker';
import { DbError, updateProfile } from '../../lib/db';
import type { FieldErrors } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { BARANGAYS, GENDERS } from '../../lib/options';
import { validators } from '../../lib/validation';
import { palette, type } from '../../theme/glass';

const BIO_MAX = 255;

export default function ProfileScreen() {
  const { user, setUser, signOut } = useAuth();

  const [editing, setEditing] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
  const [bio, setBio] = useState(user?.bio ?? '');
  const [location, setLocation] = useState(user?.location ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [birthday, setBirthday] = useState(user?.birthday ?? '');
  const [gender, setGender] = useState(user?.gender ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const startEditing = () => {
    setAvatar(user.avatar);
    setBio(user.bio);
    setLocation(user.location);
    setPhone(user.phone);
    setBirthday(user.birthday);
    setGender(user.gender);
    setErrors({});
    setFormError(null);
    setSaved(null);
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setFormError(null);
  };

  const save = async () => {
    setFormError(null);
    setSaved(null);
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
    if (Object.keys(cleaned).length) {
      setFormError('Almost there — check the highlighted fields.');
      return;
    }

    setBusy(true);
    try {
      const updated = await updateProfile(user.id, {
        avatar: avatar ?? null,
        bio: bio.trim(),
        location,
        phone: phone.replace(/[\s-]/g, ''),
        birthday,
        gender,
      });
      setUser(updated);
      setSaved('Profile updated — looking sharp! 🎾');
      setEditing(false);
    } catch (e) {
      setFormError(e instanceof DbError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will need to log back in to see your bookings.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const fieldError = (key: string) => (errors[key] ? errors[key] : null);

  return (
    <View style={styles.root}>
      <GlassBackground />
      <SafeAreaView style={styles.root} edges={['top']}>
        <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={type.h1}>Profile</Text>

            {/* ---------- Identity card ---------- */}
            <GlassCard strong>
              <View style={styles.identity}>
                <Avatar avatar={user.avatar} firstName={user.firstName} lastName={user.lastName} size={76} />
                <View style={{ flex: 1 }}>
                  <Text style={[type.h2, { fontSize: 20 }]}>
                    {user.firstName} {user.lastName}
                  </Text>
                  <Text style={type.caption}>{user.email}</Text>
                  <View style={styles.verifiedRow}>
                    <Ionicons name="checkmark-circle" size={14} color={palette.mint} />
                    <Text style={styles.verified}>Gmail verified</Text>
                  </View>
                </View>
              </View>
              {user.bio ? <Text style={styles.bio}>“{user.bio}”</Text> : null}

              <View style={styles.statRow}>
                <Stat icon="location" label={user.location || 'Tagum City'} />
                <Stat icon="call" label={user.phone || 'No number yet'} />
              </View>
              <View style={styles.statRow}>
                <Stat icon="calendar" label={user.birthday || 'Birthday not set'} />
                <Stat icon="person" label={user.gender || 'Gender not set'} />
              </View>
            </GlassCard>

            <ErrorBanner message={formError} />
            <SuccessBanner message={saved} />

            {/* ---------- Edit form ---------- */}
            {!editing ? (
              <GlassButton title="Edit profile" variant="secondary" onPress={startEditing} />
            ) : (
              <GlassCard>
                <View style={styles.form}>
                  <Text style={styles.sectionTitle}>Edit your details</Text>

                  <AvatarPicker
                    label="Profile picture"
                    value={avatar}
                    onChange={setAvatar}
                    firstName={user.firstName}
                    lastName={user.lastName}
                    error={fieldError('avatar')}
                  />

                  <GlassInput
                    label="Bio"
                    placeholder="Tell everyone how you play"
                    multiline
                    maxLength={BIO_MAX}
                    value={bio}
                    onChangeText={(v) => {
                      setBio(v);
                      setErrors((p) => ({ ...p, bio: '' }));
                    }}
                    error={fieldError('bio')}
                    counter={{ length: bio.length, max: BIO_MAX }}
                  />

                  <GlassSelect
                    label="Location"
                    placeholder="Pick your barangay"
                    value={location}
                    options={BARANGAYS}
                    onSelect={(v) => {
                      setLocation(v);
                      setErrors((p) => ({ ...p, location: '' }));
                    }}
                    error={fieldError('location')}
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
                      setErrors((p) => ({ ...p, phone: '' }));
                    }}
                    error={fieldError('phone')}
                    hint={phone ? `${phone.length}/11 digits · starts with 09` : '11 digits, starts with 09.'}
                  />

                  <GlassDatePicker
                    label="Birthday"
                    value={birthday}
                    onChange={(v) => {
                      setBirthday(v);
                      setErrors((p) => ({ ...p, birthday: '' }));
                    }}
                    error={fieldError('birthday')}
                  />

                  <GlassSelect
                    label="Gender"
                    placeholder="Choose one"
                    value={gender}
                    options={GENDERS}
                    onSelect={(v) => {
                      setGender(v);
                      setErrors((p) => ({ ...p, gender: '' }));
                    }}
                    error={fieldError('gender')}
                  />

                  <GlassButton title="Save changes" onPress={save} loading={busy} />
                  <GlassButton title="Cancel" variant="secondary" onPress={cancel} disabled={busy} />
                </View>
              </GlassCard>
            )}

            <Pressable style={styles.signOut} onPress={confirmSignOut}>
              <Ionicons name="log-out-outline" size={18} color={palette.danger} />
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>

            <Text style={styles.version}>PicklePlay · Tagum City</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

function Stat({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={palette.mint} />
      <Text style={styles.statText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bgTop },
  container: { padding: 20, gap: 16, paddingBottom: 130 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  verified: { fontSize: 12, fontWeight: '600', color: palette.mint },
  bio: { fontSize: 14, fontStyle: 'italic', color: palette.muted, marginTop: 14, lineHeight: 20 },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  statText: { fontSize: 12.5, color: palette.white, flex: 1 },
  sectionTitle: { ...type.h3, marginBottom: 2 },
  form: { gap: 16 },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,138,138,0.5)',
    backgroundColor: 'rgba(255,138,138,0.1)',
  },
  signOutText: { color: palette.danger, fontSize: 15, fontWeight: '700' },
  version: { ...type.caption, textAlign: 'center', fontSize: 11.5 },
});
