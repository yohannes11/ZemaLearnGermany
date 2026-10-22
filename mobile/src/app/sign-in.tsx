import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ApiError } from '@/core/api/client';
import { useSession } from '@/core/session';
import { Button, Text } from '@/ui/primitives';
import { Screen } from '@/ui/screen';
import { radius, space, type, useColours } from '@/ui/theme';

function Field({ label, ...props }: TextInputProps & { label: string }) {
  const c = useColours();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.subtle}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
        style={[styles.input, type.body, { color: c.text, backgroundColor: c.surface, borderColor: focused ? c.brand : c.borderStrong }]}
      />
    </View>
  );
}

/** Sign in, or create a free account; the same account works on the website. */
export default function SignInScreen() {
  const c = useColours();
  const { signIn, register } = useSession();
  const [creating, setCreating] = useState(false);
  const [fields, setFields] = useState({ login: '', password: '', username: '', name: '', email: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof fields) => (value: string) => setFields(f => ({ ...f, [key]: value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (creating) await register({ username: fields.username, name: fields.name, email: fields.email, password: fields.password });
      else await signIn(fields.login, fields.password);
      router.back();
    } catch (problem) {
      setError(problem instanceof ApiError ? problem.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        <Text variant="title">{creating ? 'Create your account' : 'Welcome back'}</Text>
        <Text colour="muted">Your words, scores, XP and streak follow you to every device and the website.</Text>
        {creating ? (
          <>
            <Field label="Your name" value={fields.name} onChangeText={set('name')} autoCapitalize="words" textContentType="name" />
            <Field label="Username" value={fields.username} onChangeText={set('username')} textContentType="username" />
            <Field label="Email" value={fields.email} onChangeText={set('email')} keyboardType="email-address" textContentType="emailAddress" />
          </>
        ) : (
          <Field label="Username or email" value={fields.login} onChangeText={set('login')} textContentType="username" />
        )}
        <Field label="Password" value={fields.password} onChangeText={set('password')} secureTextEntry textContentType={creating ? 'newPassword' : 'password'} onSubmitEditing={submit} />
        {error && <Text accessibilityLiveRegion="polite" colour="red">{error}</Text>}
        <Button label={creating ? 'Create account' : 'Sign in'} onPress={submit} busy={busy} />
        <Button label={creating ? 'I already have an account' : 'Create a free account'} kind="ghost" onPress={() => setCreating(v => !v)} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.xs },
  input: { minHeight: 52, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.md },
});
