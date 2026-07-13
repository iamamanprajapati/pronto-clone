import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import { AppMap } from '../AppMap';
import { api } from '../api';
import { useStore } from '../store';
import { Btn, C, IconCircle, Muted } from '../ui';
import { Ionicons, MCI } from '../icons';

interface SearchResult {
  label: string;
  detail: string;
  lat: number;
  lng: number;
}

export default function AddAddressScreen({ navigation }: any) {
  const { addresses, setAddresses, setSelectedAddress, selectedAddress, currentLocation } = useStore();
  // Start at the user's live location; fall back to their saved address, then demo zone.
  const start = currentLocation ?? selectedAddress ?? { lat: 12.9121, lng: 77.6401 };
  const [pin, setPin] = useState({ latitude: start.lat, longitude: start.lng });
  const [flat, setFlat] = useState('');
  const [landmark, setLandmark] = useState('');
  const [tag, setTag] = useState('Home');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // If we opened without a live fix, grab the freshest position we can.
  useEffect(() => {
    if (currentLocation) return;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const p = await Location.getLastKnownPositionAsync();
        if (p) setPin({ latitude: p.coords.latitude, longitude: p.coords.longitude });
      } catch { /* keep fallback */ }
    })();
  }, []);

  const [noMatches, setNoMatches] = useState(false);

  // Debounced place search — Photon first (strongly biased to places near you),
  // Nominatim as fallback. Both are OpenStreetMap geocoders, no API key.
  useEffect(() => {
    if (query.trim().length < 3) { setResults([]); setNoMatches(false); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      setNoMatches(false);
      try {
        let items: SearchResult[] = [];
        try {
          const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=6&lat=${pin.latitude}&lon=${pin.longitude}&zoom=13&location_bias_scale=0.6&lang=en`;
          const j = await fetch(url).then(r => r.json());
          items = (j.features ?? []).map((f: any) => {
            const p = f.properties ?? {};
            const [lng, lat] = f.geometry.coordinates;
            return {
              label: p.name ?? p.street ?? 'Unnamed place',
              detail: [p.street, p.district, p.city, p.state].filter(v => v && v !== p.name).join(', '),
              lat, lng,
            };
          });
        } catch { /* fall through to nominatim */ }
        if (items.length === 0) {
          const d = 0.35; // ~35km box around you, preferred but not exclusive
          const url = `https://nominatim.openstreetmap.org/search?format=json&limit=6&countrycodes=in&q=${encodeURIComponent(query)}&viewbox=${pin.longitude - d},${pin.latitude + d},${pin.longitude + d},${pin.latitude - d}`;
          const j = await fetch(url, { headers: { 'Accept-Language': 'en' } }).then(r => r.json());
          items = (Array.isArray(j) ? j : []).map((n: any) => {
            const parts = String(n.display_name ?? '').split(', ');
            return {
              label: parts[0] ?? 'Unnamed place',
              detail: parts.slice(1, 4).join(', '),
              lat: Number(n.lat), lng: Number(n.lon),
            };
          });
        }
        setResults(items);
        setNoMatches(items.length === 0);
      } catch { setResults([]); setNoMatches(true); }
      finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  function pick(r: SearchResult) {
    setPin({ latitude: r.lat, longitude: r.lng });
    setQuery(r.label);
    setResults([]);
    if (!landmark) setLandmark(r.label);
    Keyboard.dismiss();
  }

  async function useMyLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Location', 'Permission is needed to use your current location.');
      const p = await Location.getLastKnownPositionAsync() ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (p) { setPin({ latitude: p.coords.latitude, longitude: p.coords.longitude }); setResults([]); setQuery(''); }
    } catch { Alert.alert('Location', 'Could not get your position. Tap the map instead.'); }
  }

  async function save() {
    try {
      const { address } = await api('/v1/users/addresses', {
        method: 'POST',
        body: JSON.stringify({ tag, lat: pin.latitude, lng: pin.longitude, flat, landmark: landmark || undefined }),
      });
      setAddresses([...addresses, address]);
      setSelectedAddress(address);
      navigation.goBack();
    } catch (e) { Alert.alert('Error', (e as Error).message); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* search box */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, zIndex: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderWidth: 1, borderColor: C.border, borderRadius: 16, paddingHorizontal: 12 }}>
          <Ionicons name="search" size={17} color={C.muted} />
          <TextInput
            style={{ flex: 1, padding: 12, fontSize: 15, color: C.text }}
            placeholder="Search area, street, landmark…"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {searching
            ? <ActivityIndicator size="small" color={C.accent} />
            : query.length > 0 && (
              <Pressable onPress={() => { setQuery(''); setResults([]); }} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={C.muted} />
              </Pressable>
            )}
        </View>

        {/* suggestions dropdown — "your location" always offered first while typing */}
        {query.trim().length > 0 && (
          <View style={{ position: 'absolute', top: 62, left: 16, right: 16, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: C.border, overflow: 'hidden', elevation: 6, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, zIndex: 20 }}>
            <Pressable onPress={useMyLocation}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: results.length > 0 || noMatches ? 1 : 0, borderBottomColor: C.border }}>
              <IconCircle size={32}><MCI name="crosshairs-gps" size={16} color={C.accent} /></IconCircle>
              <Text style={{ fontWeight: '700', color: C.accent }}>Use my current location</Text>
            </Pressable>
            {results.map((r, i) => (
              <Pressable key={`${r.lat}-${r.lng}-${i}`} onPress={() => pick(r)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: i < results.length - 1 ? 1 : 0, borderBottomColor: C.border }}>
                <IconCircle size={32}><MCI name="map-marker" size={16} color={C.accent} /></IconCircle>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: C.text }} numberOfLines={1}>{r.label}</Text>
                  {!!r.detail && <Text numberOfLines={1} style={{ color: C.muted, fontSize: 13 }}>{r.detail}</Text>}
                </View>
              </Pressable>
            ))}
            {noMatches && !searching && (
              <View style={{ padding: 12 }}>
                <Text style={{ color: C.muted, fontSize: 13 }}>No places found — try a bigger landmark or area name.</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={{ height: 240, marginHorizontal: 16, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
        <AppMap
          center={{ lat: pin.latitude, lng: pin.longitude }}
          delta={0.008}
          markers={[
            { id: 'pin', lat: pin.latitude, lng: pin.longitude, kind: 'pin', label: 'Your entrance' },
            ...(currentLocation
              ? [{ id: 'me', lat: currentLocation.lat, lng: currentLocation.lng, kind: 'me' as const, label: 'You are here' }]
              : []),
          ]}
          onPress={p => setPin({ latitude: p.lat, longitude: p.lng })}
        />
        {/* use-my-location button */}
        <Pressable onPress={useMyLocation}
          style={{ position: 'absolute', bottom: 10, right: 10, backgroundColor: 'white', borderRadius: 999, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } }}>
          <MCI name="crosshairs-gps" size={20} color={C.accent} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
        <Muted>Search above, tap the map, or use the GPS button — then place the pin at your entrance.</Muted>
        <TextInput style={inp} placeholder="Flat / house no. & building *" value={flat} onChangeText={setFlat} />
        <TextInput style={inp} placeholder="Landmark (optional)" value={landmark} onChangeText={setLandmark} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {['Home', 'Work', 'Other'].map(t => (
            <Text key={t} onPress={() => setTag(t)}
              style={{ paddingVertical: 8, paddingHorizontal: 16, borderRadius: 16, overflow: 'hidden', backgroundColor: tag === t ? C.accent : 'white', color: tag === t ? 'white' : C.text, fontWeight: '700', borderWidth: 1, borderColor: C.border }}>
              {t}
            </Text>
          ))}
        </View>
        <Btn title="Save address" onPress={save} disabled={!flat.trim()} />
      </ScrollView>
    </View>
  );
}

const inp = {
  backgroundColor: 'white', borderWidth: 1, borderColor: C.border,
  borderRadius: 16, padding: 12, fontSize: 15, color: C.text,
} as const;
