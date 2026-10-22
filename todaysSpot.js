import { Alert, Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, ApiError } from './api';

// Today's spot helpers shared by the mobile map (screens/Map.jsx) and its web stand-in (screens/Map.web.jsx)

const TODAY_CACHE_KEY = 'todaysSpot';
const DAY_MS = 24 * 60 * 60 * 1000;
// How often to ask for the spot once its reveal time has passed
export const REFETCH_INTERVAL_MS = 15 * 1000;

// Walking directions in Apple Maps (iOS) or Google Maps, so the app needs no maps API key
export function openWalkingDirections({ latitude, longitude }) {
  const url = Platform.OS === 'ios'
    ? `http://maps.apple.com/?daddr=${latitude},${longitude}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=walking`;
  Linking.openURL(url).catch(() => Alert.alert('Could not open maps'));
}

// Today's spot from the server, falling back to the cached copy when offline.
// A 401 is rethrown so the screen can send the user back to Login.
export async function fetchTodaysSpot() {
  try {
    const today = await api('/api/locations/today');
    await AsyncStorage.setItem(TODAY_CACHE_KEY, JSON.stringify({ ...today, cachedAt: new Date().toISOString() }));
    return { today, offline: false };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) throw error;
      return { today: null, offline: false, message: error.message };
    }

    const cached = JSON.parse((await AsyncStorage.getItem(TODAY_CACHE_KEY)) || 'null');
    // The cached spot is still today's until the next day's reveal
    const stillToday = cached && Date.now() < Date.parse(cached.revealAt) + DAY_MS;
    return { today: stillToday ? cached : null, offline: true, cachedAt: cached?.cachedAt };
  }
}

export const formatCountdown = (ms) => {
  const pad = (n) => String(n).padStart(2, '0');
  const hrs = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hrs}:${pad(mins)}:${pad(secs)}`;
};
