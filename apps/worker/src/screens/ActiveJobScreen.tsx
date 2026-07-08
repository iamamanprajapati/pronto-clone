import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { api, rupees } from '../api';
import { getSocket } from '../socket';
import { useStore } from '../store';
import { Btn, C, Card, IconCircle, Loading, Muted } from '../ui';
import { MCI } from '../icons';

/** One screen, all job states: EN_ROUTE → ARRIVED → OTP → IN_PROGRESS (checklist+timer) → COMPLETED summary. */
export default function ActiveJobScreen({ route, navigation }: any) {
  const jobId = route.params?.jobId ?? useStore.getState().activeJobId;
  const [job, setJob] = useState<any>(null);
  const [otp, setOtp] = useState('');
  const [checklist, setChecklist] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(Date.now());
  const [summary, setSummary] = useState<any>(null);
  const setActiveJobId = useStore(s => s.setActiveJobId);

  const load = async () => {
    const { jobs } = await api('/v1/workforce/jobs');
    const j = jobs.find((x: any) => x.id === jobId);
    setJob(j ?? null);
    return j;
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    const onUpdate = (u: any) => { if (u.bookingId === jobId) load(); };
    socket.on('booking.update', onUpdate);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { socket.off('booking.update', onUpdate); clearInterval(t); };
  }, [jobId]);

  if (!job && !summary) return <Loading />;

  async function arrive() {
    try { await api(`/v1/bookings/${jobId}/arrive`, { method: 'POST' }); load(); }
    catch (e) { Alert.alert('Error', (e as Error).message); }
  }
  async function start() {
    try { await api(`/v1/bookings/${jobId}/start`, { method: 'POST', body: JSON.stringify({ otp }) }); setOtp(''); load(); }
    catch (e) { Alert.alert('OTP', (e as Error).message); }
  }
  async function complete() {
    const items = job.tasks.map((t: string) => ({ task: t, done: checklist[t] ?? false }));
    if (items.some((i: any) => !i.done) && !await confirm('Some tasks are unchecked. Complete anyway?')) return;
    try {
      await api(`/v1/bookings/${jobId}/complete`, { method: 'POST', body: JSON.stringify({ checklist: items }) });
      const { earnings } = await api('/v1/earnings/history');
      setSummary(earnings.find((e: any) => e.bookingId === jobId) ?? { totalPaise: 0 });
    } catch (e) { Alert.alert('Error', (e as Error).message); }
  }

  if (summary) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
        <IconCircle size={88}><MCI name="party-popper" size={44} color={C.accent} /></IconCircle>
        <Text style={{ fontSize: 22, fontWeight: '900', color: C.text, marginTop: 14 }}>Job complete!</Text>
        <Text style={{ fontSize: 34, fontWeight: '900', color: C.green, marginVertical: 10 }}>{rupees(summary.totalPaise)}</Text>
        <Muted>base {rupees(summary.basePaise ?? 0)} + incentive {rupees(summary.incentivePaise ?? 0)}</Muted>
        <Btn title="Back to duty" style={{ alignSelf: 'stretch', marginTop: 20 }}
          onPress={() => { setActiveJobId(null); navigation.reset({ index: 0, routes: [{ name: 'Main' }] }); }} />
      </View>
    );
  }

  const remaining = job.timerEndsAt ? Math.max(0, new Date(job.timerEndsAt).getTime() - now) : 0;
  const mm = String(Math.floor(remaining / 60000)).padStart(2, '0');
  const ss = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ height: 240 }}>
        <MapView style={{ flex: 1 }} region={{ latitude: job.address.lat, longitude: job.address.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }}>
          <Marker coordinate={{ latitude: job.address.lat, longitude: job.address.lng }} title="Customer" />
        </MapView>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Card>
          <Text style={{ fontWeight: '800', fontSize: 16, color: C.text }}>{job.tasks.join(' + ')}</Text>
          <Muted>{job.durationMin} min · {job.customerName} · {job.status.replace(/_/g, ' ')}</Muted>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MCI name="map-marker" size={14} color={C.muted} />
            <Muted>{job.address.flat}{job.address.landmark ? `, ${job.address.landmark}` : ''}</Muted>
          </View>
          {job.instructions && <Muted>Note: {job.instructions}</Muted>}
        </Card>

        {['ASSIGNED', 'EN_ROUTE'].includes(job.status) && (
          <>
            <Btn title="Navigate →" onPress={() =>
              Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${job.address.lat},${job.address.lng}`)} />
            <Btn kind="ghost" title="I've arrived" onPress={arrive} />
          </>
        )}

        {job.status === 'ARRIVED' && (
          <Card>
            <Text style={{ fontWeight: '700', color: C.text, marginBottom: 8 }}>Ask the customer for their OTP</Text>
            <TextInput
              style={{ backgroundColor: '#F5F5F5', borderRadius: 16, padding: 14, fontSize: 24, textAlign: 'center', letterSpacing: 8 }}
              keyboardType="number-pad" maxLength={4} value={otp} onChangeText={setOtp} placeholder="••••"
            />
            <Btn title="Start job" onPress={start} disabled={otp.length !== 4} style={{ marginTop: 10 }} />
          </Card>
        )}

        {job.status === 'IN_PROGRESS' && (
          <>
            <Card style={{ alignItems: 'center' }}>
              <Muted>Time remaining</Muted>
              <Text style={{ fontSize: 40, fontWeight: '900', color: C.text }}>{mm}:{ss}</Text>
            </Card>
            <Card>
              <Text style={{ fontWeight: '700', color: C.text, marginBottom: 8 }}>Task checklist</Text>
              {job.tasks.map((t: string) => (
                <Pressable key={t} onPress={() => setChecklist(c => ({ ...c, [t]: !c[t] }))}
                  style={{ padding: 10, borderRadius: 14, marginBottom: 6, backgroundColor: checklist[t] ? '#E7F7EF' : '#F5F5F5', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MCI name={checklist[t] ? 'checkbox-marked' : 'checkbox-blank-outline'} size={20} color={checklist[t] ? C.accent : C.muted} />
                  <Text style={{ color: C.text, fontWeight: '600' }}>{t}</Text>
                </Pressable>
              ))}
            </Card>
            <Btn title="Mark job complete" onPress={complete} />
          </>
        )}

        <Btn kind="danger" title="SOS — I need help" onPress={async () => {
          await api('/v1/safety/sos', { method: 'POST', body: JSON.stringify({ bookingId: jobId, lat: job.address.lat, lng: job.address.lng }) });
          Alert.alert('SOS sent', 'Safety team alerted. Stay where you feel safe — they will call you now.');
        }} />
        <Btn kind="ghost" title="Report an issue" onPress={async () => {
          await api('/v1/support/tickets', {
            method: 'POST',
            body: JSON.stringify({ subject: `Worker issue on job ${String(jobId).slice(-6)}`, body: 'Reported from active job screen', bookingId: jobId }),
          });
          Alert.alert('Reported', 'Ops team notified.');
        }} />
      </ScrollView>
    </View>
  );
}

function confirm(msg: string): Promise<boolean> {
  return new Promise(resolve =>
    Alert.alert('Confirm', msg, [
      { text: 'No', onPress: () => resolve(false) },
      { text: 'Yes', onPress: () => resolve(true) },
    ]),
  );
}
