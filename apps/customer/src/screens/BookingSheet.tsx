import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { DURATION_BLOCKS_MIN } from '@pronto/shared';
import { api, rupees } from '../api';
import { useStore } from '../store';
import { Btn, C, Card, IconCircle, Muted } from '../ui';
import { MCI, ServiceIcon } from '../icons';

/** The 3-step booking flow: Tasks → Duration & slot → Review, as a sheet over Home. */
export default function BookingSheet({ visible, onClose, navigation }: {
  visible: boolean; onClose: () => void; navigation: any;
}) {
  const { services, zone, selectedAddress, draftTasks, toggleTask, draftDuration, setDraftDuration,
    draftScheduledAt, setDraftScheduledAt, clearDraft, setActiveBookingId } = useStore();
  const [step, setStep] = useState(0);
  const [quote, setQuote] = useState<any>(null);
  const [coupon, setCoupon] = useState('');
  const [instructions, setInstructions] = useState('');
  const [paying, setPaying] = useState(false);

  const suggestedMin = services
    .filter(s => draftTasks.includes(s.slug))
    .reduce((sum, s) => sum + s.baseMinutes, 0);

  useEffect(() => {
    if (step !== 2 || !zone) return;
    api(`/v1/catalog/quote?cityId=${zone.cityId}&durationMin=${draftDuration}${coupon ? `&coupon=${coupon}` : ''}`)
      .then(setQuote)
      .catch(e => { setQuote(null); if (coupon) Alert.alert('Coupon', e.message); });
  }, [step, draftDuration, coupon]);

  async function book() {
    if (!selectedAddress) { Alert.alert('Address needed', 'Add a delivery address first.'); navigation.navigate('AddAddress'); return; }
    setPaying(true);
    try {
      const { booking } = await api('/v1/bookings', {
        method: 'POST',
        body: JSON.stringify({
          addressId: selectedAddress.id,
          tasks: draftTasks,
          durationMin: draftDuration,
          scheduledAt: draftScheduledAt ?? undefined,
          instructions: instructions || undefined,
          coupon: coupon || undefined,
          idempotencyKey: `bk-${Date.now()}`,
        }),
      });
      // mock payment provider completes instantly and dispatch starts
      await api('/v1/payments/intent', {
        method: 'POST',
        body: JSON.stringify({ bookingId: booking.id, method: 'upi', idempotencyKey: `pay-${booking.id}` }),
      });
      clearDraft(); setStep(0); setCoupon(''); setInstructions('');
      setActiveBookingId(booking.id);
      onClose();
      navigation.navigate('Tracking', { bookingId: booking.id });
    } catch (e) {
      Alert.alert('Booking failed', (e as Error).message);
    } finally { setPaying(false); }
  }

  const slots = [0, 1, 2, 3, 4].map(i => {
    const d = new Date(Date.now() + (i + 1) * 60 * 60_000);
    d.setMinutes(0, 0, 0);
    return d;
  });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }} onPress={onClose} />
      <View style={{ backgroundColor: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '82%', padding: 18 }}>
        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: C.border, alignSelf: 'center', marginBottom: 12 }} />
        <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 10 }}>
          {['1 · Pick your tasks', '2 · Duration & time', '3 · Review & pay'][step]}
        </Text>

        <ScrollView style={{ flexGrow: 0 }}>
          {step === 0 && (
            <View style={{ gap: 8 }}>
              {services.map(s => {
                const on = draftTasks.includes(s.slug);
                return (
                  <Pressable key={s.id} onPress={() => toggleTask(s.slug)}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: on ? C.tint : 'white', borderWidth: 1.5, borderColor: on ? C.accent : C.border, borderRadius: 18, padding: 12, gap: 10 }}>
                    <IconCircle size={40} color={on ? 'white' : C.tint}><ServiceIcon icon={s.icon} size={20} /></IconCircle>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: C.text }}>{s.name}</Text>
                      <Muted>~{s.baseMinutes} min</Muted>
                    </View>
                    <MCI name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={on ? C.accent : C.border} />
                  </Pressable>
                );
              })}
            </View>
          )}

          {step === 1 && (
            <View>
              {suggestedMin > 0 && <Muted style={{ marginBottom: 8 }}>Suggested for your tasks: ~{suggestedMin} min</Muted>}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {DURATION_BLOCKS_MIN.map(m => (
                  <Pressable key={m} onPress={() => setDraftDuration(m)}
                    style={{ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, backgroundColor: draftDuration === m ? C.accent : 'white', borderWidth: 1, borderColor: C.border }}>
                    <Text style={{ fontWeight: '700', color: draftDuration === m ? 'white' : C.text }}>{m} min</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ fontWeight: '700', color: C.text, marginBottom: 8 }}>When?</Text>
              <Pressable onPress={() => setDraftScheduledAt(null)}
                style={{ backgroundColor: !draftScheduledAt ? '#FDE9F3' : 'white', borderWidth: 1.5, borderColor: !draftScheduledAt ? C.accent : C.border, borderRadius: 16, padding: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <MCI name="flash" size={18} color={C.accent} />
                <Text style={{ fontWeight: '700', color: C.text }}>Now — expert in ~10 min</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {slots.map(d => {
                  const iso = d.toISOString();
                  const on = draftScheduledAt === iso;
                  return (
                    <Pressable key={iso} onPress={() => setDraftScheduledAt(iso)}
                      style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, backgroundColor: on ? C.accent : 'white', borderWidth: 1, borderColor: C.border }}>
                      <Text style={{ color: on ? 'white' : C.text }}>{d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: 10 }}>
              <Card>
                <Text style={{ fontWeight: '700', color: C.text }}>
                  {services.filter(s => draftTasks.includes(s.slug)).map(s => s.name).join(' + ')}
                </Text>
                <Muted>{draftDuration} min · {draftScheduledAt ? new Date(draftScheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Now (~10 min)'}</Muted>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MCI name="map-marker" size={14} color={C.muted} />
                  <Muted>{selectedAddress ? `${selectedAddress.flat}` : 'No address — add one'}</Muted>
                </View>
              </Card>
              <TextInput
                style={{ backgroundColor: 'white', borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 12, color: C.text }}
                placeholder="Instructions (gate code, supplies, pets…)" value={instructions} onChangeText={setInstructions}
              />
              <TextInput
                style={{ backgroundColor: 'white', borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 12, color: C.text }}
                placeholder="Coupon code (try FIRST50)" value={coupon} onChangeText={t => setCoupon(t.toUpperCase())} autoCapitalize="characters"
              />
              {quote && (
                <Card>
                  <Row l="Base" r={rupees(quote.basePaise)} />
                  {quote.discountPaise > 0 && <Row l={`Coupon ${quote.couponCode}`} r={`− ${rupees(quote.discountPaise)}`} green />}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <Text style={{ color: C.text, fontWeight: '800' }}>Total</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {quote.discountPaise > 0 && (
                        <Text style={{ color: C.muted, textDecorationLine: 'line-through' }}>{rupees(quote.basePaise)}</Text>
                      )}
                      <Text style={{ color: C.accent, fontWeight: '800', fontSize: 16 }}>{rupees(quote.totalPaise)}</Text>
                    </View>
                  </View>
                  <Muted style={{ marginTop: 4 }}>Free cancellation until 30 min before start.</Muted>
                </Card>
              )}
            </View>
          )}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
          {step > 0 && <Btn kind="ghost" title="Back" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
          {step < 2
            ? <Btn title="Continue" onPress={() => setStep(step + 1)} disabled={step === 0 && draftTasks.length === 0} style={{ flex: 2 }} />
            : <Btn title={paying ? 'Booking…' : `Slide to book · ${quote ? rupees(quote.totalPaise) : ''}`} onPress={book} disabled={paying || !quote} style={{ flex: 2 }} />}
        </View>
      </View>
    </Modal>
  );
}

function Row({ l, r, bold, green }: { l: string; r: string; bold?: boolean; green?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginVertical: 2 }}>
      <Text style={{ color: C.muted, fontWeight: bold ? '800' : '400' }}>{l}</Text>
      <Text style={{ color: green ? C.green : C.text, fontWeight: bold ? '800' : '600' }}>{r}</Text>
    </View>
  );
}
