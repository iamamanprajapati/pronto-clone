import React, { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, rupees } from '../api';
import { C, Card, H1, Muted } from '../ui';

export default function EarningsScreen() {
  const [summary, setSummary] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);

  useFocusEffect(useCallback(() => {
    api('/v1/earnings/summary').then(setSummary);
    api('/v1/earnings/history').then(r => setHistory(r.earnings));
  }, []));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56, gap: 12 }}>
      <H1>Earnings</H1>
      {summary && (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[['Today', summary.todayPaise], ['This week', summary.weekPaise], ['This month', summary.monthPaise]].map(([label, v]) => (
            <Card key={label as string} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: C.green }}>{rupees(v as number)}</Text>
              <Muted>{label}</Muted>
            </Card>
          ))}
        </View>
      )}
      {summary?.incentiveProgress.target > 0 && (
        <Card style={{ backgroundColor: C.greenTint, borderColor: C.greenTint }}>
          <Text style={{ fontWeight: '700', color: C.green }}>
            Streak: {summary.incentiveProgress.done}/{summary.incentiveProgress.target} jobs today → bonus {rupees(summary.incentiveProgress.bonusPaise)}
          </Text>
        </Card>
      )}

      <Text style={{ fontWeight: '800', color: C.text }}>Job history</Text>
      {history.map(e => (
        <Card key={e.id}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: '700', color: C.text, flex: 1 }}>{e.booking.tasks.join(', ')}</Text>
            <Text style={{ fontWeight: '800', color: C.green }}>{rupees(e.totalPaise)}</Text>
          </View>
          <Muted>
            {e.booking.durationMin} min · base {rupees(e.basePaise)}
            {e.incentivePaise > 0 ? ` + bonus ${rupees(e.incentivePaise)}` : ''}
            {e.tipPaise > 0 ? ` + tip ${rupees(e.tipPaise)}` : ''}
          </Muted>
          <Muted>{new Date(e.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Muted>
        </Card>
      ))}
      {history.length === 0 && <Muted style={{ textAlign: 'center', marginTop: 30 }}>Complete your first job to see earnings</Muted>}
    </ScrollView>
  );
}
