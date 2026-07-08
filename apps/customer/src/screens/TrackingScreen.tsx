import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { api, rupees } from '../api';
import { getSocket, subscribe, unsubscribe } from '../socket';
import { useStore } from '../store';
import { Btn, C, Card, IconCircle, Loading, Muted } from '../ui';
import { Ionicons, MCI } from '../icons';

/**
 * One screen, all live states:
 * SEARCHING → finding-expert overlay · ASSIGNED/EN_ROUTE → live map + OTP ·
 * ARRIVED → OTP prompt · IN_PROGRESS → timer + extend · COMPLETED → rating modal.
 */
export default function TrackingScreen({ route, navigation }: any) {
  const { bookingId } = route.params;
  const [booking, setBooking] = useState<any>(null);
  const [workerPos, setWorkerPos] = useState<{ lat: number; lng: number; etaMin: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [rateOpen, setRateOpen] = useState(false);
  const setActiveBookingId = useStore(s => s.setActiveBookingId);

  const load = () => api(`/v1/bookings/${bookingId}`).then(r => setBooking(r.booking));

  useEffect(() => {
    load();
    const channel = `booking:${bookingId}`;
    const socket = getSocket();
    subscribe(channel);
    const onUpdate = (u: any) => { if (u.bookingId === bookingId) load(); };
    const onLoc = (l: any) => { if (l.bookingId === bookingId) setWorkerPos(l); };
    socket.on('booking.update', onUpdate);
    socket.on('booking.worker_location', onLoc);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      socket.off('booking.update', onUpdate);
      socket.off('booking.worker_location', onLoc);
      unsubscribe(channel);
      clearInterval(tick);
    };
  }, [bookingId]);

  useEffect(() => {
    if (!booking) return;
    if (booking.status === 'COMPLETED') setRateOpen(true);
    if (['RATED', 'CANCELLED_CUSTOMER', 'CANCELLED_ADMIN', 'CANCELLED_SYSTEM', 'NO_EXPERT_FOUND'].includes(booking.status)) {
      setActiveBookingId(null);
    } else {
      setActiveBookingId(bookingId);
    }
  }, [booking?.status]);

  if (!booking) return <Loading />;

  const remaining = booking.timerEndsAt ? Math.max(0, new Date(booking.timerEndsAt).getTime() - now) : 0;
  const mm = String(Math.floor(remaining / 60000)).padStart(2, '0');
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');

  async function cancel() {
    Alert.alert('Cancel booking?', 'A fee may apply within 30 min of start.', [
      { text: 'Keep booking' },
      {
        text: 'Cancel it', style: 'destructive',
        onPress: async () => {
          try {
            const r = await api(`/v1/bookings/${bookingId}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'customer changed plans' }) });
            if (r.lateFeePaise > 0) Alert.alert('Cancelled', `Late-cancellation fee: ${rupees(r.lateFeePaise)}`);
            setActiveBookingId(null);
            navigation.goBack();
          } catch (e) { Alert.alert('Error', (e as Error).message); }
        },
      },
    ]);
  }

  async function extend(minutes: number) {
    try {
      await api(`/v1/bookings/${bookingId}/extend`, { method: 'POST', body: JSON.stringify({ minutes }) });
      load();
    } catch (e) { Alert.alert('Error', (e as Error).message); }
  }

  const addr = booking.address;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ height: 300 }}>
        <MapView style={{ flex: 1 }} region={{
          latitude: workerPos?.lat ?? addr.lat, longitude: workerPos?.lng ?? addr.lng,
          latitudeDelta: 0.01, longitudeDelta: 0.01,
        }}>
          <Marker coordinate={{ latitude: addr.lat, longitude: addr.lng }} title="You" pinColor={C.accent} />
          {workerPos && (
            <Marker coordinate={{ latitude: workerPos.lat, longitude: workerPos.lng }} title={booking.worker?.name}>
              <View style={{ backgroundColor: C.accent, borderRadius: 18, padding: 6, borderWidth: 2, borderColor: 'white' }}>
                <MCI name="account-wrench" size={18} color="white" />
              </View>
            </Marker>
          )}
        </MapView>
        <Pressable onPress={() => navigation.goBack()} style={{ position: 'absolute', top: 54, left: 16, backgroundColor: 'white', borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {booking.status === 'SEARCHING' && (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconCircle size={44}><MCI name="magnify" size={22} color={C.accent} /></IconCircle>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>Finding your expert…</Text>
              <Muted style={{ marginTop: 2 }}>Assigning the nearest available expert. This usually takes under a minute.</Muted>
            </View>
          </Card>
        )}
        {booking.status === 'NO_EXPERT_FOUND' && (
          <Card>
            <Text style={{ fontSize: 17, fontWeight: '800', color: C.red }}>No experts available right now</Text>
            <Muted style={{ marginTop: 6 }}>Try scheduling for a later slot from Home.</Muted>
            <Btn title="Back to Home" style={{ marginTop: 10 }} onPress={() => navigation.goBack()} />
          </Card>
        )}

        {booking.worker && (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconCircle size={52}><MCI name="account-wrench" size={26} color={C.accent} /></IconCircle>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: C.text, fontSize: 16 }}>{booking.worker.name}</Text>
              <Muted>★ {booking.worker.rating.toFixed(1)} · {booking.worker.jobsDone} jobs · verified ✓</Muted>
              {workerPos && ['ASSIGNED', 'EN_ROUTE'].includes(booking.status) && (
                <Text style={{ color: C.accent, fontWeight: '700', marginTop: 2 }}>Arriving in ~{workerPos.etaMin} min</Text>
              )}
            </View>
          </Card>
        )}

        {['ASSIGNED', 'EN_ROUTE', 'ARRIVED'].includes(booking.status) && booking.otp && (
          <Card style={{ backgroundColor: C.tint, borderColor: C.tint, alignItems: 'center' }}>
            <Muted>Share this OTP with your expert to start</Muted>
            <Text style={{ fontSize: 34, fontWeight: '900', letterSpacing: 10, color: C.accent, marginTop: 4 }}>{booking.otp}</Text>
          </Card>
        )}

        {booking.status === 'IN_PROGRESS' && (
          <Card style={{ alignItems: 'center' }}>
            <Muted>Time remaining</Muted>
            <Text style={{ fontSize: 44, fontWeight: '900', color: C.text }}>{mm}:{ss}</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Btn kind="ghost" title="+30 min" onPress={() => extend(30)} style={{ flex: 1 }} />
              <Btn kind="ghost" title="+60 min" onPress={() => extend(60)} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        <Card>
          <Text style={{ fontWeight: '700', color: C.text }}>{booking.taskNames.join(' + ')}</Text>
          <Muted>{booking.durationMin} min · {rupees(booking.pricing.totalPaise)} · {booking.status.replace(/_/g, ' ')}</Muted>
          {booking.instructions && <Muted>Note: {booking.instructions}</Muted>}
        </Card>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {['SEARCHING', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED'].includes(booking.status) && (
            <Btn kind="danger" title="Cancel" onPress={cancel} style={{ flex: 1 }} />
          )}
          <Btn kind="ghost" title="Help / SOS" style={{ flex: 1 }} onPress={async () => {
            await api('/v1/safety/sos', { method: 'POST', body: JSON.stringify({ bookingId }) });
            Alert.alert('Help is on the way', 'Our safety team has been alerted and will call you.');
          }} />
        </View>
      </ScrollView>

      <RatingModal
        visible={rateOpen} bookingId={bookingId} workerName={booking.worker?.name}
        onDone={() => { setRateOpen(false); setActiveBookingId(null); navigation.goBack(); }}
      />
    </View>
  );
}

function RatingModal({ visible, bookingId, workerName, onDone }: {
  visible: boolean; bookingId: string; workerName?: string; onDone: () => void;
}) {
  const [stars, setStars] = useState(5);
  const [tags, setTags] = useState<string[]>([]);
  const [tip, setTip] = useState(0);
  const [comment, setComment] = useState('');
  const TAGS = ['Thorough', 'On time', 'Polite', 'Went extra mile'];

  async function submit() {
    try {
      await api(`/v1/bookings/${bookingId}/rate`, {
        method: 'POST', body: JSON.stringify({ stars, tags, comment: comment || undefined, tipPaise: tip }),
      });
    } catch { /* already rated */ }
    onDone();
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: 'white', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22 }}>
          <Text style={{ fontSize: 19, fontWeight: '800', color: C.text, textAlign: 'center' }}>
            Service complete ✅
          </Text>
          <Muted style={{ textAlign: 'center', marginTop: 4 }}>How was {workerName ?? 'your expert'}?</Muted>
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginVertical: 14 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <MCI
                key={n} name={n <= stars ? 'star' : 'star-outline'} size={38}
                color={n <= stars ? '#f59e0b' : C.border}
                style={{ marginHorizontal: 4 }} onPress={() => setStars(n)}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {TAGS.map(t => {
              const on = tags.includes(t);
              return (
                <Text key={t} onPress={() => setTags(on ? tags.filter(x => x !== t) : [...tags, t])}
                  style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, overflow: 'hidden', backgroundColor: on ? C.accent : '#F5F5F5', color: on ? 'white' : C.text }}>
                  {t}
                </Text>
              );
            })}
          </View>
          <TextInput
            style={{ backgroundColor: '#FAFAFA', borderRadius: 16, padding: 12, marginTop: 12, color: C.text }}
            placeholder="Add a comment (optional)" value={comment} onChangeText={setComment}
          />
          <Muted style={{ marginTop: 14, textAlign: 'center' }}>Add a tip? 100% goes to your expert</Muted>
          <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 8 }}>
            {[0, 2000, 3000, 5000].map(p => (
              <Text key={p} onPress={() => setTip(p)}
                style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, overflow: 'hidden', backgroundColor: tip === p ? C.green : '#F5F5F5', color: tip === p ? 'white' : C.text, fontWeight: '700' }}>
                {p === 0 ? 'No tip' : rupees(p)}
              </Text>
            ))}
          </View>
          <Btn title="Submit" onPress={submit} style={{ marginTop: 16 }} />
        </View>
      </View>
    </Modal>
  );
}
