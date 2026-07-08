import React, { useState } from 'react';
import { Dimensions, ScrollView, Text, View } from 'react-native';
import { Btn, C } from '../ui';
import { MCI } from '../icons';

const SLIDES = [
  { icon: 'flash' as const, title: 'House help in 10 minutes', body: 'Trained experts near you, ready when you are.' },
  { icon: 'broom' as const, title: 'Book time, not tasks', body: 'Dishes + kitchen + laundry in one booking. You choose the duration.' },
  { icon: 'shield-check' as const, title: 'Verified & trusted', body: 'Background-checked, trained, uniformed experts. Track them live.' },
];

export default function OnboardingScreen({ navigation }: any) {
  const [page, setPage] = useState(0);
  const width = Dimensions.get('window').width;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {SLIDES.map((s, i) => (
          <View key={i} style={{ width, flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
            <MCI name={s.icon} size={80} color={C.accent} />
            <Text style={{ fontSize: 26, fontWeight: '800', color: C.text, textAlign: 'center', marginTop: 24 }}>{s.title}</Text>
            <Text style={{ fontSize: 16, color: C.muted, textAlign: 'center', marginTop: 12 }}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
        {SLIDES.map((_, i) => (
          <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === page ? C.accent : C.border }} />
        ))}
      </View>
      <View style={{ padding: 20 }}>
        <Btn title="Get started" onPress={() => navigation.navigate('Login')} />
      </View>
    </View>
  );
}
