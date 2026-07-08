import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { api, rupees } from '../api';
import { useStore } from '../store';
import { Btn, C, Card, Loading, Muted } from '../ui';

export default function BookingDetailScreen({ route, navigation }: any) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const { toggleTask, clearDraft } = useStore();

  useEffect(() => {
    api(`/v1/bookings/${bookingId}`).then(r => setBooking(r.booking));
    api(`/v1/bookings/${bookingId}/timeline`).then(r => setTimeline(r.events)).catch(() => {});
  }, [bookingId]);

  if (!booking) return <Loading />;
  const p = booking.pricing;

  function bookAgain() {
    clearDraft();
    booking.tasks.forEach((t: string) => toggleTask(t));
    navigation.navigate('Main', { screen: 'Home' });
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Card>
        <Text style={{ fontWeight: '800', fontSize: 16, color: C.text }}>{booking.taskNames.join(' + ')}</Text>
        <Muted>{booking.durationMin} min · {booking.status.replace(/_/g, ' ')}</Muted>
        {booking.worker && <Muted>Expert: {booking.worker.name} · ★ {booking.worker.rating.toFixed(1)}</Muted>}
        <Muted>{booking.address.flat}{booking.address.landmark ? `, ${booking.address.landmark}` : ''}</Muted>
      </Card>

      <Card>
        <Row l="Base" r={rupees(p.basePaise)} />
        {p.extensionPaise > 0 && <Row l="Extensions" r={rupees(p.extensionPaise)} />}
        {p.discountPaise > 0 && <Row l="Discount" r={`− ${rupees(p.discountPaise)}`} />}
        {p.tipPaise > 0 && <Row l="Tip" r={rupees(p.tipPaise)} />}
        <Row l="Total" r={rupees(p.totalPaise)} bold />
      </Card>

      <Card>
        <Text style={{ fontWeight: '700', color: C.text, marginBottom: 6 }}>Timeline</Text>
        {timeline.map(e => (
          <Muted key={e.id}>
            {new Date(e.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} — {e.toStatus.replace(/_/g, ' ')}
          </Muted>
        ))}
      </Card>

      <Btn title="Book again" onPress={bookAgain} />
      <Btn kind="ghost" title="Report an issue" onPress={async () => {
        await api('/v1/support/tickets', {
          method: 'POST',
          body: JSON.stringify({ subject: `Issue with booking ${bookingId.slice(-6)}`, body: 'Customer reported an issue from the app.', bookingId }),
        });
        Alert.alert('Reported', 'Our support team will reach out shortly.');
      }} />
    </ScrollView>
  );
}

function Row({ l, r, bold }: { l: string; r: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 }}>
      <Text style={{ color: C.muted, fontWeight: bold ? '800' : '400' }}>{l}</Text>
      <Text style={{ color: C.text, fontWeight: bold ? '800' : '600' }}>{r}</Text>
    </View>
  );
}
