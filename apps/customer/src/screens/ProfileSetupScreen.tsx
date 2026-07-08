import React, { useState } from 'react';
import { Alert, TextInput, View } from 'react-native';
import { api } from '../api';
import { useStore } from '../store';
import { Btn, C, H1, Muted } from '../ui';

export default function ProfileSetupScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [referral, setReferral] = useState('');
  const { user, setUser } = useStore();

  async function save() {
    try {
      const r = await api('/v1/users/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name, email: email || undefined, referralCode: referral || undefined }),
      });
      setUser({ ...user!, name: r.user.name, email: r.user.email });
      navigation.reset({ index: 0, routes: [{ name: 'LocationGate' }] });
    } catch (e) { Alert.alert('Error', (e as Error).message); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center' }}>
      <H1>Tell us about you</H1>
      <TextInput style={inp} placeholder="Your name" value={name} onChangeText={setName} autoFocus />
      <TextInput style={inp} placeholder="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={inp} placeholder="Referral code (optional)" value={referral} onChangeText={setReferral} autoCapitalize="characters" />
      <Muted style={{ marginBottom: 12 }}>You can change these later in Profile.</Muted>
      <Btn title="Continue" onPress={save} disabled={!name.trim()} />
    </View>
  );
}

const inp = {
  backgroundColor: 'white', borderWidth: 1, borderColor: C.border,
  borderRadius: 16, padding: 14, fontSize: 16, color: C.text, marginBottom: 12,
} as const;
