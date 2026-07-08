import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api } from '../api';
import { C, Card, Muted } from '../ui';

export default function PerformanceScreen() {
  const [perf, setPerf] = useState<any>(null);
  useEffect(() => { api('/v1/workforce/performance').then(setPerf); }, []);
  if (!perf) return null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Text style={num}>⭐ {perf.rating.toFixed(2)}</Text><Muted>{perf.ratingCount} ratings</Muted>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Text style={num}>{perf.acceptanceRate}%</Text><Muted>acceptance</Muted>
        </Card>
        <Card style={{ flex: 1, alignItems: 'center' }}>
          <Text style={[num, { color: perf.strikes > 0 ? C.red : C.text }]}>{perf.strikes}</Text><Muted>strikes</Muted>
        </Card>
      </View>
      <Card>
        <Text style={{ fontWeight: '800', color: C.text }}>{perf.jobsDone} jobs completed</Text>
      </Card>
      <Text style={{ fontWeight: '800', color: C.text }}>Recent feedback</Text>
      {perf.recentRatings.map((r: any, i: number) => (
        <Card key={i}>
          <Text style={{ color: C.text }}>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)} {r.tags.join(' · ')}</Text>
          {r.comment && <Muted>"{r.comment}"</Muted>}
        </Card>
      ))}
      {perf.recentRatings.length === 0 && <Muted>No ratings yet</Muted>}
    </ScrollView>
  );
}

const num = { fontSize: 18, fontWeight: '800' as const, color: C.text };
