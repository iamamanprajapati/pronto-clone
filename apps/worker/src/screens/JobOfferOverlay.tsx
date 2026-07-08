import React, { useEffect, useState } from 'react';
import { Alert, Modal, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api, rupees } from '../api';
import { useStore } from '../store';
import { Btn, C, IconCircle, Muted } from '../ui';
import { MCI } from '../icons';

/** Full-screen job offer takeover with live countdown — must be impossible to miss. */
export default function JobOfferOverlay() {
  const { offer, setOffer, setActiveJobId } = useStore();
  const navigation = useNavigation<any>();
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!offer) return;
    const tick = () => {
      const s = Math.max(0, Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) setOffer(null);
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [offer?.offerId]);

  if (!offer) return null;

  async function respond(accept: boolean) {
    const current = offer!;
    setOffer(null);
    try {
      const r = await api(`/v1/dispatch/offers/${current.offerId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ accept, reason: accept ? undefined : 'declined from app' }),
      });
      if (accept && r.bookingId) {
        setActiveJobId(r.bookingId);
        navigation.navigate('ActiveJob', { jobId: r.bookingId });
      }
    } catch (e) { Alert.alert('Offer', (e as Error).message); }
  }

  return (
    <Modal visible transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(10,14,25,0.92)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: 'white', borderRadius: 22, padding: 24, alignItems: 'center' }}>
          <IconCircle size={52}><MCI name="bell-ring" size={26} color={C.accent} /></IconCircle>
          <Text style={{ fontSize: 15, fontWeight: '800', color: C.accent, marginTop: 8 }}>NEW JOB</Text>
          <Text style={{ fontSize: 42, fontWeight: '900', color: left <= 5 ? C.red : C.text }}>0:{String(left).padStart(2, '0')}</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, textAlign: 'center', marginTop: 8 }}>
            {offer.tasks.join(' + ')}
          </Text>
          <Muted style={{ marginTop: 4 }}>{offer.durationMin} min · {offer.distanceM}m away</Muted>
          <Muted>{offer.address.landmark ?? 'See address after accepting'}</Muted>
          <Text style={{ fontSize: 24, fontWeight: '900', color: C.green, marginVertical: 10 }}>
            Earn {rupees(offer.payoutPaise)}
          </Text>
          <Muted>Customer: {offer.customerFirstName}</Muted>
          <Btn title="ACCEPT JOB" onPress={() => respond(true)} style={{ alignSelf: 'stretch', marginTop: 16 }} />
          <Btn kind="ghost" title="Can't take this one" onPress={() => respond(false)} style={{ alignSelf: 'stretch', marginTop: 10 }} />
        </View>
      </View>
    </Modal>
  );
}
