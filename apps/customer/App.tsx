import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from './src/icons';

import { api, loadToken } from './src/api';
import { useStore } from './src/store';
import { Loading, C } from './src/ui';

import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import ProfileSetupScreen from './src/screens/ProfileSetupScreen';
import LocationGateScreen from './src/screens/LocationGateScreen';
import HomeScreen from './src/screens/HomeScreen';
import AddAddressScreen from './src/screens/AddAddressScreen';
import TrackingScreen from './src/screens/TrackingScreen';
import BookingsScreen from './src/screens/BookingsScreen';
import BookingDetailScreen from './src/screens/BookingDetailScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AddressesScreen from './src/screens/AddressesScreen';
import ReferralScreen from './src/screens/ReferralScreen';
import SupportScreen from './src/screens/SupportScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';

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
            name={route.name === 'Home' ? 'home' : route.name === 'Bookings' ? 'receipt' : 'person'}
            size={size ?? 22}
            color={color}
          />
        ),
      })}>
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Bookings" component={BookingsScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const setUser = useStore(s => s.setUser);

  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (token) {
        try {
          const { user } = await api('/v1/auth/me');
          if (user) {
            setUser({ id: user.id, phone: user.phone, name: user.name, email: user.email });
            setLoggedIn(true);
          }
        } catch { /* token invalid → login flow */ }
      }
      setReady(true);
    })();
  }, []);

  if (!ready) return <Loading />;

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={loggedIn ? 'LocationGate' : 'Onboarding'}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        <Stack.Screen name="LocationGate" component={LocationGateScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="AddAddress" component={AddAddressScreen} options={{ headerShown: true, title: 'Add address' }} />
        <Stack.Screen name="Tracking" component={TrackingScreen} />
        <Stack.Screen name="BookingDetail" component={BookingDetailScreen} options={{ headerShown: true, title: 'Booking' }} />
        <Stack.Screen name="Addresses" component={AddressesScreen} options={{ headerShown: true, title: 'My addresses' }} />
        <Stack.Screen name="Referral" component={ReferralScreen} options={{ headerShown: true, title: 'Refer & earn' }} />
        <Stack.Screen name="Support" component={SupportScreen} options={{ headerShown: true, title: 'Support' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ headerShown: true, title: 'Notifications' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
