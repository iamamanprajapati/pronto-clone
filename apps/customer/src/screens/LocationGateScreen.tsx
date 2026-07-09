import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import * as Location from 'expo-location';
import { MCI } from '../icons';
import { api } from '../api';
import { useStore } from '../store';
import { Btn, C, H1, Loading, Muted } from '../ui';

// Seeded HSR Layout center — used if GPS is denied so the demo still works.
const FALLBACK = { lat: 12.9121, lng: 77.6401 };

export default function LocationGateScreen({ navigation }: any) {
  const [state, setState] = useState<'checking' | 'denied' | 'waitlist'>('checking');
  const { setZone, setAddresses, setSelectedAddress, setServices, setCurrentLocation } = useStore();

  async function check(lat: number, lng: number) {
    const r = await api(`/v1/catalog/serviceability?lat=${lat}&lng=${lng}`);
    if (!r.serviceable) return setState('waitlist');
    setCurrentLocation({ lat, lng });      // remember real GPS so the map auto-centers on it
    setZone(r.zone);
    const [{ services }, { addresses }] = await Promise.all([
      api('/v1/catalog/services'),
      api('/v1/users/addresses'),
    ]);
    setServices(services);
    setAddresses(addresses);
    setSelectedAddress(addresses[0] ?? null);
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  }

  async function locate() {
    setState('checking');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        await check(FALLBACK.lat, FALLBACK.lng); // demo fallback
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await check(pos.coords.latitude, pos.coords.longitude);
    } catch {
      setState('denied');
    }
  }

  useEffect(() => { locate(); }, []);

  if (state === 'checking') return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
      {state === 'waitlist' ? (
        <>
          <MCI name="map-marker-off-outline" size={64} color={C.muted} />
          <H1>We're not in your area yet</H1>
          <Muted style={{ textAlign: 'center', marginBottom: 20 }}>
            We're expanding fast. We'll notify you the moment experts go live near you.
          </Muted>
          <Btn title="Notify me" onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] })} style={{ alignSelf: 'stretch' }} />
          <View style={{ height: 10 }} />
          <Btn
            kind="ghost"
            title="Use demo area (HSR Layout)"
            onPress={() => { setState('checking'); check(FALLBACK.lat, FALLBACK.lng).catch(() => setState('denied')); }}
            style={{ alignSelf: 'stretch' }}
          />
        </>
      ) : (
        <>
          <MCI name="map-marker-radius" size={64} color={C.accent} />
          <H1>Location needed</H1>
          <Muted style={{ textAlign: 'center', marginBottom: 20 }}>We use your location to find experts near you.</Muted>
          <Btn title="Try again" onPress={locate} style={{ alignSelf: 'stretch' }} />
        </>
      )}
    </View>
  );
}
