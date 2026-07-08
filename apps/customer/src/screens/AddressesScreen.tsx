import React, { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api } from '../api';
import { useStore } from '../store';
import { Btn, C, Card, Muted } from '../ui';

export default function AddressesScreen({ navigation }: any) {
  const { addresses, setAddresses, selectedAddress, setSelectedAddress } = useStore();

  useFocusEffect(useCallback(() => {
    api('/v1/users/addresses').then(r => setAddresses(r.addresses));
  }, []));

  async function remove(id: string) {
    await api(`/v1/users/addresses/${id}`, { method: 'DELETE' });
    const rest = addresses.filter(a => a.id !== id);
    setAddresses(rest);
    if (selectedAddress?.id === id) setSelectedAddress(rest[0] ?? null);
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 10 }}>
      {addresses.map(a => (
        <Pressable key={a.id} onPress={() => { setSelectedAddress(a); navigation.goBack(); }}>
          <Card style={{ borderColor: selectedAddress?.id === a.id ? C.accent : C.border, borderWidth: 1.5 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '800', color: C.text }}>{a.tag} {selectedAddress?.id === a.id && '✓'}</Text>
              <Text onPress={() => remove(a.id)} style={{ color: C.red }}>Delete</Text>
            </View>
            <Muted>{a.flat}{a.landmark ? `, ${a.landmark}` : ''}</Muted>
          </Card>
        </Pressable>
      ))}
      <Btn title="＋ Add new address" onPress={() => navigation.navigate('AddAddress')} />
    </ScrollView>
  );
}
