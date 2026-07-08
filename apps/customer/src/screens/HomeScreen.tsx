import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useStore } from '../store';
import { api } from '../api';
import { getSocket, subscribe, unsubscribe } from '../socket';
import { Btn, C, Card, IconCircle, Muted } from '../ui';
import { Ionicons, MCI, ServiceIcon } from '../icons';
import BookingSheet from './BookingSheet';

const MAP_EXPANDED = 320;
const MAP_COLLAPSED = 52;

interface SnapWorker { lat: number; lng: number; duty: string; skills: string[] }

export default function HomeScreen({ navigation }: any) {
  const { zone, selectedAddress, services, activeBookingId } = useStore();
  const [workers, setWorkers] = useState<SnapWorker[]>([]);
  const [counts, setCounts] = useState({ idle: 0 });
  const [eta, setEta] = useState<number | null>(null);
  const [banners, setBanners] = useState<any[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const mapH = useRef(new Animated.Value(MAP_EXPANDED)).current;

  // live worker snapshots for this zone — unsubscribed when sheet is closed/backgrounded
  useEffect(() => {
    if (!zone) return;
    const channel = `zone:${zone.id}:workers`;
    const socket = getSocket();
    subscribe(channel);
    const onSnap = (snap: any) => {
      if (snap.zoneId !== zone.id) return;
      setWorkers(snap.workers);
      setCounts(snap.counts);
      setEta(snap.bestEtaMin);
    };
    socket.on('zone.snapshot', onSnap);
    return () => { socket.off('zone.snapshot', onSnap); unsubscribe(channel); };
  }, [zone?.id]);

  useEffect(() => { api('/v1/catalog/banners').then(r => setBanners(r.banners)).catch(() => {}); }, []);

  function setMap(c: boolean) {
    setCollapsed(c);
    Animated.timing(mapH, { toValue: c ? MAP_COLLAPSED : MAP_EXPANDED, duration: 220, useNativeDriver: false }).start();
  }

  const center = selectedAddress ?? { lat: 12.9116, lng: 77.6389 };
  const categories = [...new Set(services.map(s => s.category))];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* address bar */}
      <Pressable
        onPress={() => navigation.navigate('Addresses')}
        style={{ paddingTop: 56, paddingHorizontal: 16, paddingBottom: 8, backgroundColor: 'white', flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
          <Ionicons name="location" size={16} color={C.accent} />
          <Text style={{ fontWeight: '700', color: C.text, flex: 1 }} numberOfLines={1}>
            {selectedAddress ? `${selectedAddress.tag} — ${selectedAddress.flat}` : 'Add your address'}
          </Text>
        </View>
        <Ionicons name="notifications-outline" size={20} color={C.text} onPress={() => navigation.navigate('Notifications')} />
      </Pressable>

      {/* collapsible live map */}
      <Animated.View style={{ height: mapH, overflow: 'hidden' }}>
        {collapsed ? (
          <Pressable
            onPress={() => setMap(false)}
            style={{ flex: 1, backgroundColor: C.tint, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MCI name="flash" size={16} color={C.accent} />
              <Text style={{ fontWeight: '700', color: C.accent }}>
                {counts.idle} expert{counts.idle === 1 ? '' : 's'} nearby{eta ? ` · ~${eta} min` : ''}
              </Text>
            </View>
            <MCI name="chevron-down" size={18} color={C.muted} />
          </Pressable>
        ) : (
          <View style={{ flex: 1 }}>
            <MapView
              style={{ flex: 1 }}
              region={{ latitude: center.lat, longitude: center.lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }}>
              <Marker coordinate={{ latitude: center.lat, longitude: center.lng }} title="You" pinColor={C.accent} />
              {workers.map((w, i) => (
                <Marker key={i} coordinate={{ latitude: w.lat, longitude: w.lng }} title="Expert nearby">
                  <View style={{ backgroundColor: C.accent, borderRadius: 16, padding: 5, borderWidth: 2, borderColor: 'white' }}>
                    <MCI name="account-wrench" size={16} color="white" />
                  </View>
                </Marker>
              ))}
            </MapView>
            <View style={{ position: 'absolute', top: 10, alignSelf: 'center', backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, elevation: 3, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <MCI name="flash" size={15} color={C.accent} />
              <Text style={{ fontWeight: '700', color: C.text }}>
                {counts.idle} expert{counts.idle === 1 ? '' : 's'} near you{eta ? ` · ~${eta} min away` : ''}
              </Text>
            </View>
            <Pressable onPress={() => setMap(true)} style={{ position: 'absolute', bottom: 8, alignSelf: 'center', backgroundColor: 'white', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 }}>
              <MCI name="chevron-up" size={18} color={C.muted} />
            </Pressable>
          </View>
        )}
      </Animated.View>

      {/* content */}
      <ScrollView
        style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}
        onScrollBeginDrag={() => setMap(true)}>
        {activeBookingId && (
          <Card style={{ backgroundColor: C.tint, borderColor: C.tint }}>
            <Text style={{ fontWeight: '700', color: C.accent }}>You have an active booking</Text>
            <Btn title="Track your expert" style={{ marginTop: 10 }} onPress={() => navigation.navigate('Tracking', { bookingId: activeBookingId })} />
          </Card>
        )}

        <Text style={{ fontSize: 17, fontWeight: '800', color: C.text }}>What do you need help with?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {services.map(s => (
            <Pressable key={s.id} onPress={() => setSheetOpen(true)}
              style={{ width: '30.5%', backgroundColor: 'white', borderRadius: 20, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: C.border }}>
              <IconCircle size={48}><ServiceIcon icon={s.icon} size={24} /></IconCircle>
              <Text style={{ fontSize: 12, fontWeight: '600', color: C.text, textAlign: 'center', marginTop: 8 }}>{s.name}</Text>
            </Pressable>
          ))}
        </View>

        <Btn title="Book now — expert in ~10 min" onPress={() => setSheetOpen(true)} />

        {banners.map(b => (
          <Card key={b.id} style={{ backgroundColor: C.tint, borderColor: C.tint, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconCircle size={36} color="white"><MCI name="tag" size={18} color={C.accent} /></IconCircle>
            <Text style={{ fontWeight: '700', color: C.accent, flex: 1 }}>{b.title}</Text>
          </Card>
        ))}
        <Muted style={{ textAlign: 'center', marginBottom: 20 }}>
          {categories.length} categories · verified experts · transparent pricing
        </Muted>
      </ScrollView>

      <BookingSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} navigation={navigation} />
    </View>
  );
}
