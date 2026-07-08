import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { api } from '../api';
import { useStore } from '../store';
import { Btn, C, Card, H1, Muted } from '../ui';
import { MCI } from '../icons';
import { routeForStatus } from '../../App';

export default function TrainingScreen({ navigation }: any) {
  const [modules, setModules] = useState<any[]>([]);
  const [open, setOpen] = useState<any>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const setProfile = useStore(s => s.setProfile);

  const load = () => api('/v1/workforce/training').then(r => setModules(r.modules));
  useEffect(() => { load(); }, []);

  async function submit() {
    try {
      const r = await api(`/v1/workforce/training/${open.id}/submit`, {
        method: 'POST', body: JSON.stringify({ answers }),
      });
      Alert.alert(r.passed ? 'Passed! 🎉' : 'Not quite', `Score: ${r.scorePct}%${r.passed ? '' : ' — review the material and retry.'}`);
      setOpen(null); setAnswers([]);
      await load();
      const { worker } = await api('/v1/workforce/me');
      setProfile(worker);
      if (worker.status === 'ACTIVE') {
        Alert.alert('You are live! ⚡', 'All modules passed. You can now go on duty.');
        navigation.reset({ index: 0, routes: [{ name: routeForStatus(worker.status) }] });
      }
    } catch (e) { Alert.alert('Error', (e as Error).message); }
  }

  if (open) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 24, paddingTop: 70 }}>
        <H1>{open.title}</H1>
        <Muted style={{ marginBottom: 14 }}>Watch/read the material, then answer the quiz. Pass mark 70%.</Muted>
        {open.quiz.map((q: any, qi: number) => (
          <Card key={qi} style={{ marginBottom: 12 }}>
            <Text style={{ fontWeight: '700', color: C.text, marginBottom: 8 }}>{qi + 1}. {q.q}</Text>
            {q.options.map((opt: string, oi: number) => (
              <Text key={oi}
                onPress={() => setAnswers(a => { const n = [...a]; n[qi] = oi; return n; })}
                style={{ padding: 10, borderRadius: 14, marginBottom: 6, overflow: 'hidden', backgroundColor: answers[qi] === oi ? C.accent : '#F5F5F5', color: answers[qi] === oi ? 'white' : C.text }}>
                {opt}
              </Text>
            ))}
          </Card>
        ))}
        <Btn title="Submit quiz" onPress={submit} disabled={answers.filter(a => a !== undefined).length < open.quiz.length} />
        <Btn kind="ghost" title="Back" onPress={() => setOpen(null)} style={{ marginTop: 10 }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 24, paddingTop: 70, gap: 10 }}>
      <H1>Training</H1>
      <Muted>Pass every module to go live.</Muted>
      {modules.map(m => (
        <Card key={m.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MCI name={m.passed ? 'check-circle' : 'book-open-variant'} size={20} color={m.passed ? C.accent : C.blue} />
              <Text style={{ fontWeight: '700', color: C.text, flex: 1 }}>{m.title}</Text>
            </View>
            {!m.passed && <Btn title="Start" onPress={() => { setOpen(m); setAnswers([]); }} />}
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
