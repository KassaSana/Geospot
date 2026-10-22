import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { handleAuthError } from '../api';
import { fetchTodaysSpot, formatCountdown, openWalkingDirections, REFETCH_INTERVAL_MS } from '../todaysSpot';

// react-native-maps has no web support; Metro picks this file for web builds only.
// Shows today's spot (or the countdown to its reveal) without the map.
const MapScreen = () => {
  const navigation = useNavigation();
  const [today, setToday] = useState(null);
  const [message, setMessage] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const lastFetchAt = useRef(0);

  const loadToday = useCallback(() => {
    lastFetchAt.current = Date.now();
    fetchTodaysSpot()
      .then((result) => {
        setToday(result.today);
        setMessage(result.offline ? "Offline: showing the last copy of today's spot." : result.message ?? null);
      })
      .catch((error) => handleAuthError(error, navigation));
  }, [navigation]);

  useFocusEffect(loadToday);

  // Tick the countdown, and ask the server for the spot once its reveal time has passed
  useEffect(() => {
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      const waitingForReveal = today && !today.spot && current >= Date.parse(today.revealAt);
      if (waitingForReveal && current - lastFetchAt.current >= REFETCH_INTERVAL_MS) {
        loadToday();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [today, loadToday]);

  const spot = today?.spot;
  let body;
  if (spot) {
    body = (
      <>
        <Text style={styles.label}>📍 Today&apos;s spot</Text>
        <Text style={styles.spotName}>{spot.name}</Text>
        {spot.description ? <Text style={styles.hint}>{spot.description}</Text> : null}
        <TouchableOpacity
          style={styles.directionsButton}
          onPress={() => openWalkingDirections({ latitude: spot.coordinates.lat, longitude: spot.coordinates.lng })}
        >
          <Text style={styles.directionsButtonText}>🚶 Directions</Text>
        </TouchableOpacity>
      </>
    );
  } else if (today) {
    const remaining = Date.parse(today.revealAt) - now;
    body = remaining > 0 ? (
      <>
        <Text style={styles.label}>Today&apos;s spot is revealed in</Text>
        <Text style={styles.countdown}>{formatCountdown(remaining)}</Text>
        <Text style={styles.hint}>at 9:00 AM Gainesville time</Text>
      </>
    ) : (
      <Text style={styles.label}>📍 Revealing today&apos;s spot...</Text>
    );
  } else {
    body = <Text style={styles.label}>{message || "Loading today's spot..."}</Text>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {body}
        {today && message ? <Text style={styles.note}>{message}</Text> : null}
      </View>
      <Text style={styles.footer}>Open GeoSpot on your phone to find the spot on the map and post a photo.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2d3748', padding: 20 },
  card: {
    backgroundColor: '#4a5568',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 420,
  },
  label: { color: '#e2e8f0', fontSize: 16, textAlign: 'center' },
  spotName: { color: '#68d391', fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginTop: 8 },
  countdown: { color: '#68d391', fontSize: 40, fontWeight: 'bold', marginTop: 8, fontVariant: ['tabular-nums'] },
  hint: { color: '#cbd5e0', fontSize: 15, textAlign: 'center', marginTop: 10 },
  note: { color: '#f6ad55', fontSize: 13, textAlign: 'center', marginTop: 12 },
  directionsButton: {
    backgroundColor: '#00BFFF',
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 15,
  },
  directionsButtonText: { color: 'white', fontSize: 15, fontWeight: 'bold' },
  footer: { color: '#a0aec0', fontSize: 13, textAlign: 'center', marginTop: 20, maxWidth: 420 },
});

export default MapScreen;
