import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ACTIVE_STATUSES } from '@pronto/shared';
import { api, rupees } from '../api';
import { C, Card, H1, Muted } from '../ui';

export default function BookingsScreen({ navigation }: any) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [tab, setTab] = useState<'active' | 'past'>('active');

  useFocusEffect(useCallback(() => {
    api('/v1/bookings').then(r => setBookings(r.bookings)).catch(() => {});
  }, []));

  const active = bookings.filter(b => ACTIVE_STATUSES.includes(b.status) || b.status === 'PAYMENT_PENDING');
  const past = bookings.filter(b => !active.includes(b));
  const list = tab === 'active' ? active : past;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: 56 }}>
      <View style={{ paddingHorizontal: 16 }}>
        <H1>My bookings</H1>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {(['active', 'past'] as const).map(t => (
            <Pressable key={t} onPress={() => setTab(t)}
              style={{ paddingVertical: 8, paddingHorizontal: 18, borderRadius: 18, backgroundColor: tab === t ? C.accent : 'white', borderWidth: 1, borderColor: C.border }}>
              <Text style={{ color: tab === t ? 'white' : C.text, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {list.map(b => (
          <Pressable key={b.id} onPress={() =>
            ACTIVE_STATUSES.includes(b.status)
              ? navigation.navigate('Tracking', { bookingId: b.id })
              : navigation.navigate('BookingDetail', { bookingId: b.id })
          }>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '800', color: C.text, flex: 1 }} numberOfLines={1}>{b.taskNames.join(' + ')}</Text>
                <Text style={{ fontWeight: '700', color: C.text }}>{rupees(b.pricing.totalPaise)}</Text>
              </View>
              <Muted>{b.durationMin} min · {new Date(b.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Muted>
              <Text style={{ marginTop: 4, fontWeight: '700', color: b.status === 'RATED' || b.status === 'COMPLETED' ? C.green : b.status.startsWith('CANCELLED') || b.status === 'NO_EXPERT_FOUND' ? C.red : C.accent }}>
                {b.status.replace(/_/g, ' ')}
              </Text>
            </Card>
          </Pressable>
        ))}
        {list.length === 0 && <Muted style={{ textAlign: 'center', marginTop: 40 }}>Nothing here yet</Muted>}
      </ScrollView>
    </View>
  );
}
