import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api, setToken } from '../api';
import { resetSocket } from '../socket';
import { stopPinger } from '../location';
import { useStore } from '../store';
import { Btn, C, Card, H1, IconCircle, Muted } from '../ui';
import { MCI } from '../icons';

type MCIName = React.ComponentProps<typeof MCI>['name'];

export default function ProfileScreen({ navigation }: any) {
  const { profile, setProfile } = useStore();
  const [bankOpen, setBankOpen] = useState(false);
  const [upi, setUpi] = useState(profile?.upiId ?? '');
  const [acct, setAcct] = useState(profile?.bankAccount ?? '');
  const [ticketOpen, setTicketOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  async function saveBank() {
    const { worker } = await api('/v1/workforce/bank', {
      method: 'PATCH', body: JSON.stringify({ upiId: upi || undefined, bankAccount: acct || undefined }),
    }).then(() => api('/v1/workforce/me'));
    setProfile(worker);
    setBankOpen(false);
  }

  async function raiseTicket() {
    await api('/v1/support/tickets', { method: 'POST', body: JSON.stringify({ subject, body }) });
    setTicketOpen(false); setSubject(''); setBody('');
    Alert.alert('Sent', 'Support will get back to you.');
  }

  async function logout() {
    stopPinger();
    await setToken(null);
    resetSocket();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56, gap: 10 }}>
      <H1>My profile</H1>
      <Card>
        <Text style={{ fontWeight: '800', fontSize: 17, color: C.text }}>{profile?.name}</Text>
        <Muted>+91 {profile?.phone} · {profile?.status}</Muted>
        <Muted>Skills: {profile?.skills.join(', ')}</Muted>
        <Muted>Languages: {profile?.languages.join(', ')}</Muted>
        <Muted>KYC: {profile?.kycStatus}</Muted>
      </Card>

      {([
        ['chart-line', 'My performance', () => navigation.navigate('Performance')],
        ['bank', `Payout details ${profile?.upiId ? `(${profile.upiId})` : ''}`, () => setBankOpen(true)],
        ['headset', 'Contact support', () => setTicketOpen(true)],
      ] as Array<[MCIName, string, () => void]>).map(([icon, label, fn]) => (
        <Pressable key={label} onPress={fn}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconCircle size={40}><MCI name={icon} size={20} color={C.accent} /></IconCircle>
            <Text style={{ flex: 1, fontWeight: '600', color: C.text }}>{label}</Text>
            <MCI name="chevron-right" size={20} color={C.muted} />
          </Card>
        </Pressable>
      ))}

      <Pressable onPress={logout}>
        <Card><Text style={{ color: C.red, fontWeight: '700', textAlign: 'center' }}>Log out</Text></Card>
      </Pressable>

      <Modal visible={bankOpen} transparent animationType="slide">
        <View style={sheet}>
          <View style={sheetInner}>
            <Text style={{ fontWeight: '800', fontSize: 17, color: C.text }}>Payout details</Text>
            <TextInput style={inp} placeholder="UPI ID" autoCapitalize="none" value={upi} onChangeText={setUpi} />
            <TextInput style={inp} placeholder="Bank account number" keyboardType="number-pad" value={acct} onChangeText={setAcct} />
            <Btn title="Save" onPress={saveBank} />
            <Btn kind="ghost" title="Cancel" onPress={() => setBankOpen(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={ticketOpen} transparent animationType="slide">
        <View style={sheet}>
          <View style={sheetInner}>
            <Text style={{ fontWeight: '800', fontSize: 17, color: C.text }}>Contact support</Text>
            <TextInput style={inp} placeholder="Subject" value={subject} onChangeText={setSubject} />
            <TextInput style={[inp, { height: 80 }]} placeholder="Message" multiline value={body} onChangeText={setBody} />
            <Btn title="Send" onPress={raiseTicket} disabled={subject.length < 3 || body.length < 3} />
            <Btn kind="ghost" title="Cancel" onPress={() => setTicketOpen(false)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const sheet = { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' as const };
const sheetInner = { backgroundColor: 'white', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, gap: 10 };
const inp = { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 12, color: C.text } as const;
