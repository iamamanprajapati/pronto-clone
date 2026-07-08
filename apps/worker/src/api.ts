import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// On a physical device "localhost" is the phone itself, so when the configured
// URL points at localhost we swap in the dev machine's IP — the phone already
// knows it (it's where Metro is served from, via expo hostUri).
const configured: string = Constants.expoConfig?.extra?.apiUrl ?? 'http://localhost:4000';
const devHost = Constants.expoConfig?.hostUri?.split(':')[0];
export const API: string =
  configured.includes('localhost') && devHost ? `http://${devHost}:4000` : configured;

let _token: string | null = null;
export async function loadToken() {
  _token = await AsyncStorage.getItem('worker_token');
  return _token;
}
export async function setToken(t: string | null) {
  _token = t;
  if (t) await AsyncStorage.setItem('worker_token', t);
  else await AsyncStorage.removeItem('worker_token');
}
export const getToken = () => _token;

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
      ...(opts.headers as Record<string, string>),
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as T;
}

export const rupees = (paise: number) => `₹${(paise / 100).toFixed(paise % 100 ? 2 : 0)}`;
