import React, { useEffect } from 'react';
import { View } from 'react-native';
import { MCI } from '../icons';
import { api } from '../api';
import { useStore } from '../store';
import { Btn, C, H1, Muted } from '../ui';
import { routeForStatus } from '../../App';

/** Waiting room for UNDER_REVIEW / SUSPENDED / TERMINATED workers. Polls for status changes. */
export default function StatusGateScreen({ navigation }: any) {
  const { profile, setProfile } = useStore();

  async function refresh() {
    const { worker } = await api('/v1/workforce/me');
    setProfile(worker);
    const route = routeForStatus(worker.status);
    if (route !== 'StatusGate') navigation.reset({ index: 0, routes: [{ name: route }] });
  }

  useEffect(() => {
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, []);

  const status = profile?.status ?? 'UNDER_REVIEW';
  const copy: Record<string, [React.ComponentProps<typeof MCI>['name'], string, string, string]> = {
    UNDER_REVIEW: ['timer-sand', C.amber, 'Application under review', 'Our team is verifying your documents. This usually takes 1–2 working days.'],
    SUSPENDED: ['alert-circle-outline', C.amber, 'Account suspended', 'Contact your hub supervisor or support for details.'],
    TERMINATED: ['cancel', C.red, 'Account deactivated', 'This account is no longer active on the platform.'],
  };
  const [iconName, iconColor, title, body] = copy[status] ?? copy.UNDER_REVIEW;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
      <MCI name={iconName} size={64} color={iconColor} />
      <H1>{title}</H1>
      <Muted style={{ textAlign: 'center', marginBottom: 8 }}>{body}</Muted>
      {profile?.kycStatus === 'REJECTED' && (
        <Muted style={{ color: C.red, marginBottom: 8 }}>A document was rejected — please contact your hub to resubmit.</Muted>
      )}
      <Btn title="Check again" onPress={refresh} style={{ alignSelf: 'stretch', marginTop: 12 }} />
    </View>
  );
}
