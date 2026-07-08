import * as Location from 'expo-location';
import { api } from './api';

/**
 * On-duty location pinger. Foreground watcher via expo-location; in a
 * production build this becomes an Android foreground service + iOS
 * background-location task so pings continue with the app backgrounded.
 */
let sub: Location.LocationSubscription | null = null;

export async function startPinger() {
  if (sub) return;
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;
  sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 10_000, distanceInterval: 25 },
    pos => {
      api('/v1/location/batch', {
        method: 'POST',
        body: JSON.stringify({ points: [{ lat: pos.coords.latitude, lng: pos.coords.longitude }] }),
      }).catch(() => { /* offline — the server treats stale workers as gone via TTL */ });
    },
  );
}

export function stopPinger() {
  sub?.remove();
  sub = null;
}

export async function currentPosition() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { lat: 12.9116, lng: 77.6389 }; // hub fallback for demo
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}
