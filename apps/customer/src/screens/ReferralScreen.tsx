import React, { useEffect, useState } from 'react';
import { Share, Text, View } from 'react-native';
import { api, rupees } from '../api';
import { Btn, C, Card, H1, Muted } from '../ui';
import { Ionicons } from '../icons';

export default function ReferralScreen() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api('/v1/users/referral').then(setData); }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 20 }}>
      <Ionicons name="gift" size={64} color={C.accent} style={{ alignSelf: 'center', marginTop: 20 }} />
      <H1>Refer friends, earn credits</H1>
      <Muted>Your friend gets 50% off their first booking. You get ₹100 in credits when they complete it.</Muted>
      {data && (
        <>
          <Card style={{ marginTop: 20, alignItems: 'center' }}>
            <Muted>Your referral code</Muted>
            <Text style={{ fontSize: 26, fontWeight: '900', letterSpacing: 3, color: C.accent }}>{data.code}</Text>
          </Card>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Card style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: C.text }}>{data.referredCount}</Text>
              <Muted>friends joined</Muted>
            </Card>
            <Card style={{ flex: 1, alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: C.green }}>{rupees(data.creditsPaise)}</Text>
              <Muted>credits earned</Muted>
            </Card>
          </View>
          <Btn title="Share your code" style={{ marginTop: 16 }} onPress={() =>
            Share.share({ message: `Get 50% off house help in 10 minutes on Pronto! Use my code ${data.code} 🧹⚡` })
          } />
        </>
      )}
    </View>
  );
}
