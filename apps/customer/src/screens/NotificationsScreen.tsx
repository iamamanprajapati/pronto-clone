import React, { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { api } from '../api';
import { C, Card, Muted } from '../ui';

export default function NotificationsScreen() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    api('/v1/users/notifications').then(r => setItems(r.notifications));
    api('/v1/users/notifications/read', { method: 'POST' }).catch(() => {});
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, gap: 8 }}>
      {items.map(n => (
        <Card key={n.id} style={{ opacity: n.read ? 0.75 : 1 }}>
          <Text style={{ fontWeight: '700', color: C.text }}>{n.title}</Text>
          <Muted>{n.body}</Muted>
          <Muted style={{ marginTop: 2 }}>{new Date(n.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</Muted>
        </Card>
      ))}
      {items.length === 0 && <Muted style={{ textAlign: 'center', marginTop: 40 }}>No notifications yet</Muted>}
    </ScrollView>
  );
}
