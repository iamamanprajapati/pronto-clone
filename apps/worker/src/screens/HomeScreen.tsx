import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, rupees } from '../api';
import { getSocket } from '../socket';
import { useStore } from '../store';
import { currentPosition, startPinger, stopPinger } from '../location';
import { Btn, C, Card, H1, IconCircle, Muted } from '../ui';
import { MCI } from '../icons';

export default function HomeScreen({ navigation }: any) {
  const { profile, setProfile, setOffer, setActiveJobId } = useStore();
  const [jobs, setJobs] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const onDuty = profile?.duty !== 'OFF_DUTY';

  const load = () => Promise.all([
    api('/v1/workforce/me').then(r => setProfile(r.worker)),
    api('/v1/workforce/jobs').then(r => setJobs(r.jobs)),
    api('/v1/earnings/summary').then(setSummary).catch(() => {}),
    api('/v1/workforce/announcements').then(r => setAnnouncements(r.announcements)).catch(() => {}),
  ]);

  useFocusEffect(useCallback(() => { load(); }, []));

  // job offers arrive on the worker's own channel (auto-joined server-side)
  useEffect(() => {
    const socket = getSocket();
    const onOffer = (o: any) => setOffer(o);
    const onWithdrawn = () => setOffer(null);
    const onUpdate = () => load();
    socket.on('job.offer', onOffer);
    socket.on('job.offer_withdrawn', onWithdrawn);
    socket.on('booking.update', onUpdate);
    return () => {
      socket.off('job.offer', onOffer);
      socket.off('job.offer_withdrawn', onWithdrawn);
      socket.off('booking.update', onUpdate);
    };
  }, []);

  async function toggleDuty(on: boolean) {
    setBusy(true);
    try {
      const pos = await currentPosition();
      await api('/v1/workforce/duty', { method: 'POST', body: JSON.stringify({ on, ...pos }) });
      if (on) startPinger(); else stopPinger();
      await load();
    } catch (e) {
      Alert.alert('Duty', (e as Error).message);
    } finally { setBusy(false); }
  }

  const activeJob = jobs.find(j => ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS'].includes(j.status));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56, gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <H1>Hi {profile?.name?.split(' ')[0] ?? 'Expert'}</H1>
        <Pressable onPress={async () => {
          const pos = await currentPosition();
          await api('/v1/safety/sos', { method: 'POST', body: JSON.stringify({ ...pos, bookingId: activeJob?.id }) });
          Alert.alert('SOS sent', 'Our safety team has been alerted and will call you immediately.');
        }}>
          <View style={{ backgroundColor: C.red, flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 }}>
            <MCI name="alarm-light" size={15} color="white" />
            <Text style={{ color: 'white', fontWeight: '800' }}>SOS</Text>
          </View>
        </Pressable>
      </View>

      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text style={{ fontWeight: '800', fontSize: 16, color: onDuty ? C.accent : C.muted }}>
            {onDuty ? '● ON DUTY' : '○ OFF DUTY'}
          </Text>
          <Muted>Hub: {profile?.hub?.name ?? 'not assigned'} · {profile?.duty.replace(/_/g, ' ')}</Muted>
        </View>
        <Switch value={onDuty} onValueChange={toggleDuty} disabled={busy || profile?.status !== 'ACTIVE'} trackColor={{ true: C.accent }} />
      </Card>

      {summary && (
        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View><Text style={[num, { color: C.green }]}>{rupees(summary.todayPaise)}</Text><Muted>earned today</Muted></View>
            <View><Text style={num}>{summary.jobsToday}</Text><Muted>jobs done</Muted></View>
            <View><Text style={num}>★ {profile?.rating.toFixed(1)}</Text><Muted>rating</Muted></View>
          </View>
          {summary.incentiveProgress.target > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <MCI name="target" size={14} color={C.accent} />
              <Muted>
                Streak bonus: {summary.incentiveProgress.done}/{summary.incentiveProgress.target} jobs → {rupees(summary.incentiveProgress.bonusPaise)}
              </Muted>
            </View>
          )}
        </Card>
      )}

      {activeJob ? (
        <Card style={{ backgroundColor: C.tint, borderColor: C.tint }}>
          <Text style={{ fontWeight: '800', color: C.accent }}>ACTIVE JOB — {activeJob.status.replace(/_/g, ' ')}</Text>
          <Text style={{ fontWeight: '700', color: C.text, marginTop: 4 }}>{activeJob.tasks.join(' + ')} · {activeJob.durationMin} min</Text>
          <Muted>{activeJob.address.flat}</Muted>
          <Btn title="Open job" style={{ marginTop: 10 }} onPress={() => { setActiveJobId(activeJob.id); navigation.navigate('ActiveJob', { jobId: activeJob.id }); }} />
        </Card>
      ) : onDuty ? (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <IconCircle size={56}><MCI name="radar" size={28} color={C.accent} /></IconCircle>
          <Text style={{ fontWeight: '700', color: C.text, marginTop: 10 }}>Waiting for jobs…</Text>
          <Muted>Stay near your hub for faster assignments</Muted>
        </Card>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <IconCircle size={56} color={C.soft}><MCI name="sleep" size={28} color={C.muted} /></IconCircle>
          <Muted style={{ marginTop: 10 }}>Go on duty to start receiving jobs</Muted>
        </Card>
      )}

      {jobs.filter(j => j.scheduledAt && j.status === 'ASSIGNED').length > 0 && (
        <>
          <Text style={{ fontWeight: '800', color: C.text }}>Scheduled today</Text>
          {jobs.filter(j => j.scheduledAt && j.status === 'ASSIGNED').map(j => (
            <Card key={j.id}>
              <Text style={{ fontWeight: '700', color: C.text }}>
                {new Date(j.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {j.tasks.join(' + ')}
              </Text>
              <Muted>{j.durationMin} min · {j.address.flat}</Muted>
            </Card>
          ))}
        </>
      )}

      {announcements.length > 0 && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MCI name="bullhorn-outline" size={16} color={C.text} />
            <Text style={{ fontWeight: '800', color: C.text }}>Notices</Text>
          </View>
          {announcements.map(a => (
            <Card key={a.id}>
              <Text style={{ fontWeight: '700', color: C.text }}>{a.title}</Text>
              <Muted>{a.body}</Muted>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const num = { fontSize: 20, fontWeight: '800' as const, color: C.text };
