import React, { useEffect, useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { api, setToken } from '../api';
import { useStore } from '../store';
import { Btn, C, H1, Muted } from '../ui';

export default function LoginScreen({ navigation }: any) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [stage, setStage] = useState<'phone' | 'otp'>('phone');
  const [resendIn, setResendIn] = useState(0);
  const setUser = useStore(s => s.setUser);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function requestOtp() {
    try {
      await api('/v1/auth/otp/request', { method: 'POST', body: JSON.stringify({ phone }) });
      setStage('otp');
      setResendIn(30);
    } catch (e) { Alert.alert('Error', (e as Error).message); }
  }

  async function verify() {
    try {
      const r = await api('/v1/auth/otp/verify', {
        method: 'POST', body: JSON.stringify({ phone, code: otp, as: 'CUSTOMER' }),
      });
      await setToken(r.token);
      setUser(r.user);
      navigation.reset({ index: 0, routes: [{ name: r.isNew || !r.user.name ? 'ProfileSetup' : 'LocationGate' }] });
    } catch (e) { Alert.alert('Error', (e as Error).message); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center' }}>
      <H1>{stage === 'phone' ? 'Enter your mobile number' : `OTP sent to +91 ${phone}`}</H1>
      {stage === 'phone' ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 18, color: C.text }}>+91</Text>
            <TextInput
              style={inp} keyboardType="number-pad" maxLength={10} value={phone}
              onChangeText={setPhone} placeholder="10-digit number" autoFocus
            />
          </View>
          <Muted style={{ marginVertical: 12 }}>By continuing you agree to our Terms & Privacy Policy.</Muted>
          <Btn title="Send OTP" onPress={requestOtp} disabled={phone.length !== 10} />
        </>
      ) : (
        <>
          <TextInput
            style={inp} keyboardType="number-pad" maxLength={6} value={otp}
            onChangeText={setOtp} placeholder="6-digit OTP" autoFocus
          />
          <Muted style={{ marginVertical: 12 }}>Dev OTP: 123456</Muted>
          <Btn title="Verify" onPress={verify} disabled={otp.length < 4} />
          <View style={{ marginTop: 12 }}>
            <Btn
              kind="ghost"
              title={resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend OTP'}
              onPress={requestOtp} disabled={resendIn > 0}
            />
          </View>
          <View style={{ marginTop: 12 }}>
            <Btn kind="ghost" title="Change number" onPress={() => { setStage('phone'); setOtp(''); }} />
          </View>
        </>
      )}
    </View>
  );
}

const inp = {
  flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: C.border,
  borderRadius: 16, padding: 14, fontSize: 18, color: C.text,
} as const;
