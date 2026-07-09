import React, { useState } from 'react';
import { Alert, Text, TextInput, View } from 'react-native';
import { AppMap } from '../AppMap';
import { api } from '../api';
import { useStore } from '../store';
import { Btn, C, Muted } from '../ui';

export default function AddAddressScreen({ navigation }: any) {
  const { addresses, setAddresses, setSelectedAddress, selectedAddress } = useStore();
  const start = selectedAddress ?? { lat: 12.9121, lng: 77.6401 };
  const [pin, setPin] = useState({ latitude: start.lat, longitude: start.lng });
  const [flat, setFlat] = useState('');
  const [landmark, setLandmark] = useState('');
  const [tag, setTag] = useState('Home');

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
      <View style={{ height: 260 }}>
        <AppMap
          center={{ lat: pin.latitude, lng: pin.longitude }}
          delta={0.01}
          markers={[{ id: 'pin', lat: pin.latitude, lng: pin.longitude, kind: 'pin', label: 'Your entrance' }]}
          onPress={p => setPin({ latitude: p.lat, longitude: p.lng })}
        />
      </View>
      <View style={{ padding: 16, gap: 10 }}>
        <Muted>Tap the map to place the pin at your entrance</Muted>
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
      </View>
    </View>
  );
}

const inp = {
  backgroundColor: 'white', borderWidth: 1, borderColor: C.border,
  borderRadius: 16, padding: 12, fontSize: 15, color: C.text,
} as const;
