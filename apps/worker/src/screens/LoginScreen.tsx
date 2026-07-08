import React, { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { api, setToken } from '../api';
import { useStore } from '../store';
import { Btn, C, H1, Muted } from '../ui';
import { MCI } from '../icons';
import { routeForStatus } from '../../App';

export default function LoginScreen({ navigation }: any) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState<'phone' | 'otp'>('phone');
  const setProfile = useStore(s => s.setProfile);

  async function requestOtp() {
    try {
      await api('/v1/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone }) });
      setStage('otp');
    } catch (e) { Alert.alert('Error', (e as Error).message); }
  }

  async function verify() {
    try {
      const r = await api('/v1/auth/otp/verify', {
        method: 'POST', body: JSON.stringify({ phone, code: otp, as: 'WORKER' }),
      });
      await setToken(r.token);
      const { worker } = await api('/v1/workforce/me');
      setProfile(worker);
      navigation.reset({ index: 0, routes: [{ name: routeForStatus(worker.status) }] });
    } catch (e) { Alert.alert('Error', (e as Error).message); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center' }}>
      <MCI name="account-wrench" size={52} color={C.accent} style={{ alignSelf: 'center', marginBottom: 8 }} />
      <H1>{stage === 'phone' ? 'Pronto Expert — sign in' : `OTP sent to +91 ${phone}`}</H1>
      {stage === 'phone' ? (
        <>
          <TextInput style={inp} keyboardType="number-pad" maxLength={10} value={phone} onChangeText={setPhone} placeholder="Mobile number" autoFocus />
          <Btn title="Send OTP" onPress={requestOtp} disabled={phone.length !== 10} style={{ marginTop: 12 }} />
          <Muted style={{ marginTop: 10 }}>Demo workers: 9000000011 … 9000000016 (already active)</Muted>
        </>
      ) : (
        <>
          <TextInput style={inp} keyboardType="number-pad" maxLength={6} value={otp} onChangeText={setOtp} placeholder="OTP (dev: 123456)" autoFocus />
          <Btn title="Verify" onPress={verify} disabled={otp.length < 4} style={{ marginTop: 12 }} />
        </>
      )}
    </View>
  );
}

const inp = {
  backgroundColor: 'white', borderWidth: 1, borderColor: C.border,
  borderRadius: 16, padding: 14, fontSize: 18, color: C.text,
} as const;
