import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { setToken } from '../api';
import { resetSocket } from '../socket';
import { useStore } from '../store';
import { C, Card, H1, IconCircle, Muted } from '../ui';
import { Ionicons, MCI } from '../icons';

type IonName = React.ComponentProps<typeof Ionicons>['name'];

export default function ProfileScreen({ navigation }: any) {
  const { user } = useStore();

  const items: Array<[IonName, string, () => void]> = [
    ['location-outline', 'Manage addresses', () => navigation.navigate('Addresses')],
    ['gift-outline', 'Refer & earn', () => navigation.navigate('Referral')],
    ['notifications-outline', 'Notifications', () => navigation.navigate('Notifications')],
    ['headset-outline', 'Help & support', () => navigation.navigate('Support')],
    ['document-text-outline', 'Terms & privacy', () => Alert.alert('Legal', 'Terms and privacy policy content goes here.')],
  ];

  async function logout() {
    await setToken(null);
    resetSocket();
    navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingTop: 56, gap: 10 }}>
      <H1>Profile</H1>
      <Card>
        <Text style={{ fontWeight: '800', fontSize: 17, color: C.text }}>{user?.name ?? 'Guest'}</Text>
        <Muted>+91 {user?.phone}</Muted>
        {user?.email && <Muted>{user.email}</Muted>}
      </Card>
      {items.map(([icon, label, fn]) => (
        <Pressable key={label} onPress={fn}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconCircle size={40}><Ionicons name={icon} size={20} color={C.accent} /></IconCircle>
            <Text style={{ flex: 1, fontWeight: '600', color: C.text }}>{label}</Text>
            <MCI name="chevron-right" size={20} color={C.muted} />
          </Card>
        </Pressable>
      ))}
      <Pressable onPress={logout}>
        <Card><Text style={{ color: C.red, fontWeight: '700', textAlign: 'center' }}>Log out</Text></Card>
      </Pressable>
    </ScrollView>
  );
}
