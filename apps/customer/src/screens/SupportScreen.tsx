import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { Btn, C, Card, Muted } from '../ui';

const FAQ = [
  ['How fast will the expert arrive?', 'For instant bookings, typically 10–15 minutes depending on how many experts are free near you.'],
  ['Can I cancel?', 'Yes — free until 30 minutes before start. After that a small fee applies.'],
  ['Are experts verified?', 'Every expert is Aadhaar + PAN verified, background-checked and trained before their first job.'],
  ['How do extensions work?', 'During a service, tap +30/+60 min. The extra amount is charged to your payment method.'],
];

export default function SupportScreen() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const load = () => api('/v1/support/tickets').then(r => setTickets(r.tickets)).catch(() => {});
  useEffect(() => { load(); }, []);

  async function submit() {
    await api('/v1/support/tickets', { method: 'POST', body: JSON.stringify({ subject, body }) });
    setSubject(''); setBody('');
    Alert.alert('Ticket created', 'We usually respond within a few hours.');
    load();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ fontWeight: '800', fontSize: 16, color: C.text }}>FAQs</Text>
      {FAQ.map(([q, a]) => (
        <Card key={q}>
          <Text style={{ fontWeight: '700', color: C.text }}>{q}</Text>
          <Muted style={{ marginTop: 4 }}>{a}</Muted>
        </Card>
      ))}

      <Text style={{ fontWeight: '800', fontSize: 16, color: C.text, marginTop: 8 }}>Raise a ticket</Text>
      <TextInput style={inp} placeholder="Subject" value={subject} onChangeText={setSubject} />
      <TextInput style={[inp, { height: 80 }]} placeholder="Describe the issue…" value={body} onChangeText={setBody} multiline />
      <Btn title="Submit" onPress={submit} disabled={subject.length < 3 || body.length < 3} />

      {tickets.length > 0 && <Text style={{ fontWeight: '800', fontSize: 16, color: C.text, marginTop: 8 }}>Your tickets</Text>}
      {tickets.map(t => (
        <Card key={t.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700', color: C.text, flex: 1 }}>{t.subject}</Text>
            <Text style={{ color: t.status === 'RESOLVED' ? C.green : C.amber, fontWeight: '700' }}>{t.status}</Text>
          </View>
          {t.messages.map((m: any) => (
            <Muted key={m.id}>{m.author.startsWith('admin') ? 'Agent: ' : 'You: '}{m.body}</Muted>
          ))}
        </Card>
      ))}
    </ScrollView>
  );
}

const inp = {
  backgroundColor: 'white', borderWidth: 1, borderColor: C.border,
  borderRadius: 16, padding: 12, fontSize: 15, color: C.text,
} as const;
