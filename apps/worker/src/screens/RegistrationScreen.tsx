import React, { useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { useStore } from '../store';
import { Btn, C, H1, Muted } from '../ui';

const SKILLS = ['kitchen', 'cleaning', 'bathroom', 'laundry'];
const LANGS = ['Hindi', 'Kannada', 'English', 'Tamil', 'Telugu', 'Marathi'];

/** 4-step registration wizard: personal → KYC → skills → bank. */
export default function RegistrationScreen({ navigation }: any) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [pan, setPan] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [langs, setLangs] = useState<string[]>([]);
  const [upi, setUpi] = useState('');
  const setProfile = useStore(s => s.setProfile);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  async function submit() {
    try {
      await api('/v1/workforce/register', {
        method: 'POST',
        body: JSON.stringify({
          name, skills, languages: langs,
          aadhaarLast4: aadhaar.slice(-4), panMasked: `${pan.slice(0, 2)}xxx${pan.slice(-3)}`,
          upiId: upi || undefined,
        }),
      });
      const { worker } = await api('/v1/workforce/me');
      setProfile(worker);
      navigation.reset({ index: 0, routes: [{ name: 'StatusGate' }] });
    } catch (e) { Alert.alert('Error', (e as Error).message); }
  }

  const canNext = [name.trim().length > 0, aadhaar.length === 12 && pan.length === 10, skills.length > 0 && langs.length > 0, true][step];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 24, paddingTop: 70 }}>
      <Muted>Step {step + 1} of 4</Muted>
      <H1>{['Your details', 'Identity verification', 'Skills & languages', 'Payout details'][step]}</H1>

      {step === 0 && (
        <>
          <TextInput style={inp} placeholder="Full name" value={name} onChangeText={setName} />
          <Muted>A selfie for verification is captured at your hub during onboarding.</Muted>
        </>
      )}
      {step === 1 && (
        <>
          <TextInput style={inp} placeholder="Aadhaar number (12 digits)" keyboardType="number-pad" maxLength={12} value={aadhaar} onChangeText={setAadhaar} />
          <TextInput style={inp} placeholder="PAN (10 characters)" autoCapitalize="characters" maxLength={10} value={pan} onChangeText={setPan} />
          <Muted>Your documents are verified by our team before activation. Only masked numbers are stored.</Muted>
        </>
      )}
      {step === 2 && (
        <>
          <Text style={lbl}>What work can you do?</Text>
          <View style={row}>
            {SKILLS.map(s => <Chip key={s} label={s} on={skills.includes(s)} onPress={() => toggle(skills, setSkills, s)} />)}
          </View>
          <Text style={lbl}>Languages you speak</Text>
          <View style={row}>
            {LANGS.map(l => <Chip key={l} label={l} on={langs.includes(l)} onPress={() => toggle(langs, setLangs, l)} />)}
          </View>
        </>
      )}
      {step === 3 && (
        <>
          <TextInput style={inp} placeholder="UPI ID for payouts (e.g. name@upi)" autoCapitalize="none" value={upi} onChangeText={setUpi} />
          <Muted>You can add a bank account later from Profile.</Muted>
        </>
      )}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 24 }}>
        {step > 0 && <Btn kind="ghost" title="Back" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
        {step < 3
          ? <Btn title="Continue" onPress={() => setStep(step + 1)} disabled={!canNext} style={{ flex: 2 }} />
          : <Btn title="Submit application" onPress={submit} style={{ flex: 2 }} />}
      </View>
    </ScrollView>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Text onPress={onPress}
      style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 18, overflow: 'hidden', backgroundColor: on ? C.accent : 'white', color: on ? 'white' : C.text, fontWeight: '600', borderWidth: 1, borderColor: C.border, textTransform: 'capitalize' }}>
      {label}
    </Text>
  );
}

const inp = { backgroundColor: 'white', borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 14, fontSize: 16, color: C.text, marginBottom: 12 } as const;
const lbl = { fontWeight: '700' as const, color: C.text, marginBottom: 8, marginTop: 10 };
const row = { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 };
