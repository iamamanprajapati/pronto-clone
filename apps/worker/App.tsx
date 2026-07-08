import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from './src/icons';

import { api, loadToken } from './src/api';
import { useStore } from './src/store';
import { Loading, C } from './src/ui';

import LoginScreen from './src/screens/LoginScreen';
import RegistrationScreen from './src/screens/RegistrationScreen';
import StatusGateScreen from './src/screens/StatusGateScreen';
import TrainingScreen from './src/screens/TrainingScreen';
import HomeScreen from './src/screens/HomeScreen';
import ActiveJobScreen from './src/screens/ActiveJobScreen';
import EarningsScreen from './src/screens/EarningsScreen';
import ShiftsScreen from './src/screens/ShiftsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import PerformanceScreen from './src/screens/PerformanceScreen';
import JobOfferOverlay from './src/screens/JobOfferOverlay';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: C.accent,
        tabBarIcon: ({ color, size }) => (
          <Ionicons
            name={({ Duty: 'home', Earnings: 'wallet', Shifts: 'calendar', Me: 'person' } as const)[route.name as 'Duty' | 'Earnings' | 'Shifts' | 'Me']}
            size={size ?? 22}
            color={color}
          />
        ),
      })}>
      <Tabs.Screen name="Duty" component={HomeScreen} />
      <Tabs.Screen name="Earnings" component={EarningsScreen} />
      <Tabs.Screen name="Shifts" component={ShiftsScreen} />
      <Tabs.Screen name="Me" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

/** Route by worker lifecycle status: NEW→register, UNDER_REVIEW→gate, TRAINING→training, ACTIVE→tabs. */
export function routeForStatus(status: string): string {
  if (status === 'NEW') return 'Registration';
  if (status === 'UNDER_REVIEW' || status === 'SUSPENDED' || status === 'TERMINATED') return 'StatusGate';
  if (status === 'TRAINING') return 'Training';
  return 'Main';
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [initial, setInitial] = useState('Login');
  const setProfile = useStore(s => s.setProfile);

  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (token) {
        try {
          const { worker } = await api('/v1/workforce/me');
          setProfile(worker);
          setInitial(routeForStatus(worker.status));
        } catch { /* token invalid */ }
      }
      setReady(true);
    })();
  }, []);

  if (!ready) return <Loading />;

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initial}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Registration" component={RegistrationScreen} />
        <Stack.Screen name="StatusGate" component={StatusGateScreen} />
        <Stack.Screen name="Training" component={TrainingScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="ActiveJob" component={ActiveJobScreen} />
        <Stack.Screen name="Performance" component={PerformanceScreen} options={{ headerShown: true, title: 'My performance' }} />
      </Stack.Navigator>
      <JobOfferOverlay />
    </NavigationContainer>
  );
}
