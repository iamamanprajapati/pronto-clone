import React, { useCallback, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { Btn, C, Card, H1, Muted } from '../ui';

export default function ShiftsScreen() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');

  const load = () => Promise.all([
    api('/v1/workforce/shifts').then(r => setShifts(r.shifts)),
    api('/v1/workforce/attendance').then(r => setAttendance(r.attendance)),
    api('/v1/workforce/leave').then(r => setLeaves(r.leaves)),
  ]);
  useFocusEffect(useCallback(() => { load(); }, []));

  async function applyLeave() {
    try {
      await api('/v1/workforce/leave', {
        method: 'POST',
        body: JSON.stringify({
          fromDate: new Date(`${from}T00:00:00`).toISOString(),
          toDate: new Date(`${to || from}T23:59:59`).toISOString(),
          reason,
        }),
      });
      setLeaveOpen(false); setFrom(''); setTo(''); setReason('');
      load();
    } catch (e) { Alert.alert('Leave', (e as Error).message); }
  }

  const fmt = (d: string) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const fmtD = (d: string) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56, gap: 12 }}>
      <H1>Shifts & Attendance</H1>

      <Text style={{ fontWeight: '800', color: C.text }}>My shifts</Text>
      {shifts.map(s => (
        <Card key={s.id}>
          <Text style={{ fontWeight: '700', color: C.text }}>{s.hub.name}</Text>
          <Muted>{fmt(s.startAt)} → {fmt(s.endAt)}</Muted>
        </Card>
      ))}
      {shifts.length === 0 && <Muted>No rostered shifts — you can go on duty anytime (dev mode).</Muted>}

      <Text style={{ fontWeight: '800', color: C.text, marginTop: 6 }}>Attendance (30 days)</Text>
      {attendance.slice(0, 10).map(a => (
        <Card key={a.id}>
          <Muted>{fmt(a.checkinAt)} → {a.checkoutAt ? fmt(a.checkoutAt) : 'on duty'}</Muted>
        </Card>
      ))}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
        <Text style={{ fontWeight: '800', color: C.text }}>Leave</Text>
        <Btn title="Apply" onPress={() => setLeaveOpen(true)} />
      </View>
      {leaves.map(l => (
        <Card key={l.id}>
          <Text style={{ fontWeight: '700', color: C.text }}>{fmtD(l.fromDate)} – {fmtD(l.toDate)}</Text>
          <Muted>{l.reason} · <Text style={{ color: l.status === 'APPROVED' ? C.accent : l.status === 'REJECTED' ? C.red : C.amber }}>{l.status}</Text></Muted>
        </Card>
      ))}

      <Modal visible={leaveOpen} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, gap: 10 }}>
            <Text style={{ fontWeight: '800', fontSize: 17, color: C.text }}>Apply for leave</Text>
            <TextInput style={inp} placeholder="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} />
            <TextInput style={inp} placeholder="To (YYYY-MM-DD, optional)" value={to} onChangeText={setTo} />
            <TextInput style={inp} placeholder="Reason" value={reason} onChangeText={setReason} />
            <Btn title="Submit" onPress={applyLeave} disabled={!from || reason.length < 3} />
            <Btn kind="ghost" title="Cancel" onPress={() => setLeaveOpen(false)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const inp = { backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 12, color: C.text } as const;
