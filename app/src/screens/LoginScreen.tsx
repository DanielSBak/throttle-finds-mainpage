import React, { useState } from 'react';
import { Alert, Image, Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { GITHUB_OAUTH_CLIENT_ID } from '../config';
import { pollDeviceFlow, saveToken, startDeviceFlow, validateToken } from '../github';
import { colors, radius } from '../theme';
import { Button } from '../ui';

export function LoginScreen(props: { onSignedIn: () => void }) {
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [deviceCode, setDeviceCode] = useState('');

  async function finishSignIn(t: string) {
    await saveToken(t);
    if (await validateToken()) {
      props.onSignedIn();
    } else {
      Alert.alert('Access denied', 'This account cannot access the inventory. Ask Daniel to add you as a collaborator on GitHub.');
    }
  }

  async function signInWithToken() {
    if (!token.trim()) return;
    setBusy(true);
    try {
      await finishSignIn(token);
    } catch (e) {
      Alert.alert('Sign-in failed', String(e));
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGitHub() {
    setBusy(true);
    try {
      const device = await startDeviceFlow();
      setDeviceCode(device.user_code);
      await Linking.openURL(device.verification_uri);
      const t = await pollDeviceFlow(device);
      await finishSignIn(t);
    } catch (e) {
      Alert.alert('Sign-in failed', String(e));
    } finally {
      setBusy(false);
      setDeviceCode('');
    }
  }

  return (
    <View style={styles.wrap}>
      <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>THROTTLE FINDS</Text>
      <Text style={styles.subtitle}>Inventory Manager</Text>

      {GITHUB_OAUTH_CLIENT_ID !== '' && (
        <>
          <Button title="Sign in with GitHub" onPress={signInWithGitHub} busy={busy} />
          {deviceCode !== '' && (
            <Text style={styles.code}>Enter this code on GitHub: {deviceCode}</Text>
          )}
          <Text style={styles.or}>— or —</Text>
        </>
      )}

      <TextInput
        style={styles.input}
        value={token}
        onChangeText={setToken}
        placeholder="Paste your GitHub access token"
        placeholderTextColor="#5f656d"
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
      />
      <Button title="Sign In" onPress={signInWithToken} busy={busy} disabled={!token.trim()} />
      <Text style={styles.hint}>
        You only do this once. The token is stored securely on this phone.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', padding: 28, gap: 14, backgroundColor: colors.bg },
  logo: { width: 84, height: 64, alignSelf: 'center' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: 3, textAlign: 'center' },
  subtitle: { color: colors.muted, textAlign: 'center', marginBottom: 18, letterSpacing: 1 },
  or: { color: colors.muted, textAlign: 'center' },
  code: {
    color: colors.text, textAlign: 'center', fontSize: 20, fontWeight: '800', letterSpacing: 3,
    backgroundColor: colors.card, borderRadius: radius.md, padding: 12, overflow: 'hidden',
  },
  input: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: 15,
    paddingVertical: 14,
    fontSize: 15,
  },
  hint: { color: colors.muted, fontSize: 12, textAlign: 'center', marginTop: 4 },
});
