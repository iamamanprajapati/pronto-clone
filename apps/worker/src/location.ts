import * as Location from 'expo-location';
import { api } from './api';

/**
 * On-duty location pinger.
 * Two mechanisms keep the worker "live" on the server (Redis liveness TTL 90s):
 *  1. a position watcher with distanceInterval 0 — fires on a time basis even
 *     when the phone is stationary (distance-gated watchers go silent indoors,
 *     which made workers vanish from the map and from dispatch);
 *  2. a 20s keepalive that re-posts the last known position in case the OS
 *     throttles the watcher.
 * In a production build this becomes an Android foreground service + iOS
 * background-location task so pings continue with the app backgrounded.
 */
let sub: Location.LocationSubscription | null = null;
let keepalive: ReturnType<typeof setInterval> | null = null;
let last: { lat: number; lng: number } | null = null;

function post(p: { lat: number; lng: number }) {
  api('/v1/location/batch', {
    method: 'POST',
    body: JSON.stringify({ points: [p] }),
  }).catch(() => { /* offline — server drops stale workers via TTL */ });
}

export async function startPinger() {
  if (sub) return;
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return;

  // immediate first ping so the worker appears on maps right away
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    last = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    post(last);
  } catch { /* watcher below will supply positions */ }

  sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, timeInterval: 10_000, distanceInterval: 0 },
    pos => {
      last = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      post(last);
    },
  );

  keepalive = setInterval(() => {
    if (last) post(last);
  }, 20_000);
}

export function stopPinger() {
  sub?.remove();
  sub = null;
  if (keepalive) {
    clearInterval(keepalive);
    keepalive = null;
  }
  last = null;
}

export async function currentPosition() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { lat: 12.9116, lng: 77.6389 }; // hub fallback for demo
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}
