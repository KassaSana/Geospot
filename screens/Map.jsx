import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Alert } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import polyline from '@mapbox/polyline';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { api, ApiError, handleAuthError } from '../api';

function getDistanceInMiles(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; 
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = R * c;
  const distanceMiles = distanceKm * 0.621371;
  return distanceMiles.toFixed(2);
}


const TODAY_CACHE_KEY = 'todaysSpot';
const DAY_MS = 24 * 60 * 60 * 1000;
const REFETCH_INTERVAL_MS = 15 * 1000;

async function fetchWalkingRoute(from, to) {
  const origin = `${from.latitude},${from.longitude}`;
  const dest = `${to.latitude},${to.longitude}`;
  const data = await api(`/directions?origin=${origin}&destination=${dest}`);
  if (!data.points) return [];
  return polyline.decode(data.points).map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
}

// Today's spot from the server, falling back to the cached copy when offline.
// A 401 is rethrown so the screen can send the user back to Login.
async function fetchTodaysSpot() {
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

const formatCountdown = (ms) => {
  const pad = (n) => String(n).padStart(2, '0');
  const hrs = Math.floor(ms / (1000 * 60 * 60));
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((ms % (1000 * 60)) / 1000);
  return `${hrs}:${pad(mins)}:${pad(secs)}`;
};

const MapScreen = () => {
  const navigation = useNavigation();
  const [location, setLocation] = useState(null);
  const [today, setToday] = useState(null);
  const [testSpot, setTestSpot] = useState(null);
  const [statusMessage, setStatusMessage] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [modalVisible, setModalVisible] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const [offlineMode, setOfflineMode] = useState(false);
  const [offlineModalVisible, setOfflineModalVisible] = useState(false);
  const [lastCacheUpdateTime, setLastCacheUpdateTime] = useState(null);
  const lastFetchAt = useRef(0);

  const spot = testSpot ?? today?.spot ?? null;
  const isRevealed = Boolean(spot);
  const destination = useMemo(
    () => (spot ? { latitude: spot.coordinates.lat, longitude: spot.coordinates.lng } : null),
    [spot]
  );

  const isNearDestination = location && destination && (
    Math.abs(location.latitude - destination.latitude) < 0.001 &&
    Math.abs(location.longitude - destination.longitude) < 0.001
  );

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission to access location was denied');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);

  const distanceToDestination = location && destination
    ? getDistanceInMiles(location.latitude, location.longitude, destination.latitude, destination.longitude)
    : null;

  useEffect(() => {
    let active = true;
    lastFetchAt.current = Date.now();
    fetchTodaysSpot()
      .then((result) => {
        if (!active) return;
        setToday(result.today);
        setOfflineMode(result.offline);
        setOfflineModalVisible(result.offline);
        setLastCacheUpdateTime(result.cachedAt ? new Date(result.cachedAt) : null);
        setStatusMessage(result.message ?? null);
      })
      .catch((error) => handleAuthError(error, navigation));
    return () => {
      active = false;
    };
  }, [refreshKey, navigation]);

  const handleRefreshData = () => setRefreshKey((key) => key + 1);

  // Tick the countdown, and ask the server for the spot once its reveal time has passed
  useEffect(() => {
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      const waitingForReveal = today && !today.spot && current >= Date.parse(today.revealAt);
      if (waitingForReveal && current - lastFetchAt.current >= REFETCH_INTERVAL_MS) {
        setRefreshKey((key) => key + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [today]);

  useEffect(() => {
    if (!location || !destination) return;

    let cancelled = false;
    fetchWalkingRoute(location, destination)
      .then(async (coords) => {
        if (cancelled) return;
        setRouteCoords([]);
        if (!coords.length) {
          console.warn('No route found');
          return;
        }
        // Animate the route in one point at a time
        for (let i = 1; i <= coords.length && !cancelled; i++) {
          setRouteCoords(coords.slice(0, i));
          await new Promise((res) => setTimeout(res, 20));
        }
      })
      .catch((err) => console.error('Failed to fetch directions:', err));

    return () => {
      cancelled = true;
    };
  }, [location, destination]);

  let revealLabel;
  if (testSpot) {
    revealLabel = `🧪 Test spot: ${testSpot.name}`;
  } else if (spot) {
    revealLabel = "📍 Today's spot is revealed!";
  } else if (today) {
    const remaining = Date.parse(today.revealAt) - now;
    revealLabel = remaining > 0
      ? `🕒 ${formatCountdown(remaining)} until reveal`
      : "📍 Revealing today's spot...";
  } else {
    revealLabel = statusMessage || "Loading today's spot...";
  }

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission Denied", "Please enable camera access in settings.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7, base64: true });
      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        Alert.alert("Error", "Image capture failed or base64 not found.");
        return;
      }

      const { imageUrl } = await api('/uploadPhoto', {
        method: 'POST',
        body: { image: `data:image/jpeg;base64,${asset.base64}` },
      });

      await api('/createPost', {
        method: 'POST',
        body: { imageUrl, location: 'Gainesville', description: `Found ${spot.name}!` },
      });
      Alert.alert("✅ Post created!", "Your photo has been uploaded.");
    } catch (err) {
      if (!(await handleAuthError(err, navigation))) {
        console.error("handlePickImage error:", err);
        Alert.alert("Something went wrong", err.message || "Unknown error");
      }
    }
  };

  // Development helpers (only rendered when __DEV__)
  const simulateArrival = () => {
    if (destination) setLocation(destination);
  };

  const pickRandomTestSpot = async () => {
    try {
      const locations = await api('/api/locations');
      if (!locations.length) {
        Alert.alert('No locations', 'Seed some with `npm run seed` in backend/.');
        return;
      }
      const next = locations[Math.floor(Math.random() * locations.length)];
      setTestSpot({ name: next.name, description: next.description, coordinates: next.coordinates });
    } catch (err) {
      Alert.alert('Could not load locations', err.message);
    }
  };

  if (!location) return <View style={styles.container}><Text>Loading map...</Text></View>;

  return (
    <View style={styles.container}>
      {offlineMode && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline Mode - Using Cached Data</Text>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleRefreshData}
          >
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      )}
      
      <MapView
        style={[styles.map, offlineMode && { marginTop: 30 }]}
        region={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        }}
        customMapStyle={mapStyles}
        showsUserLocation={true}
        followsUserLocation={true}
      >
        {isRevealed && routeCoords.length > 0 && (
          <Polyline coordinates={routeCoords} strokeColor="#00BFFF" strokeWidth={4} />
        )}
        {isRevealed && (
          <Marker coordinate={destination} title={spot.name} pinColor="green" />
        )}
      </MapView>

      <View style={[styles.overlay, offlineMode && { top: 70 }]}>
        <Text style={styles.revealLabel}>{revealLabel}</Text>
        {isRevealed && (
          <Text style={styles.distanceLabel}>
          📍 {distanceToDestination} miles away
          </Text>
        )}
      </View>

      

      {isRevealed && (
        <TouchableOpacity style={styles.hintButton} onPress={() => setModalVisible(true)}>
          <Text style={styles.buttonText}>?</Text>
        </TouchableOpacity>
      )}

      {isNearDestination && (
        <TouchableOpacity style={styles.cameraButton} onPress={handlePickImage}>
          <Text style={styles.buttonText}>📷</Text>
        </TouchableOpacity>
      )}

      {__DEV__ && (
      <View style={styles.testButtonsContainer}>
        <TouchableOpacity style={styles.testButton} onPress={pickRandomTestSpot}>
          <Text style={styles.testButtonText}> Random Test Spot</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.testButton} onPress={simulateArrival}>
          <Text style={styles.testButtonText}> Teleport to Spot</Text>
        </TouchableOpacity>
        {testSpot && (
          <TouchableOpacity style={styles.testButton} onPress={() => setTestSpot(null)}>
            <Text style={styles.testButtonText}> Back to Today&apos;s Spot</Text>
          </TouchableOpacity>
        )}
      </View>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{spot?.name}</Text>
            <Text style={styles.modalText}>{spot?.description || 'No hint for this spot yet.'}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      <Modal
        visible={offlineModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setOfflineModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Offline Mode</Text>
            <Text style={styles.modalText}>
              Unable to connect to the server. Showing the last copy of today&apos;s spot, if there is one.
            </Text>
            {lastCacheUpdateTime && (
              <Text style={styles.cacheTimeText}>
                Last updated: {lastCacheUpdateTime.toLocaleString()}
              </Text>
            )}
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.modalButton}
                onPress={handleRefreshData}
              >
                <Text style={styles.modalButtonText}>Try Again</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.continueButton]}
                onPress={() => setOfflineModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const mapStyles = [
  { elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4a5568' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#4a5568' }] },
  { featureType: 'road.local', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#1a202c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4e6d70' }] }
];


const styles = StyleSheet.create({
  container: { 
    flex: 1 
  },
  map: { 
    flex: 1 
  },
  overlay: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  revealLabel: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    padding: 10,
    borderRadius: 20,
    overflow: 'hidden',
  },
  distanceLabel: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: 'white',
    fontSize: 14,
    marginTop: 10,
    padding: 8,
    borderRadius: 15,
    overflow: 'hidden',
  },
  hintButton: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    backgroundColor: '#f6ad55',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    backgroundColor: '#4299e1',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  buttonText: {
    fontSize: 24,
    color: '#2d3748',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#4a5568',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalText: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 15,
  },
  closeButton: {
    backgroundColor: '#f6ad55',
    padding: 10,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  testButtonsContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
    gap: 10,
  },
  testButton: {
    backgroundColor: 'rgba(66, 153, 225, 0.6)',
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
  },
  testButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  offlineBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#e53e3e',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 8,
    zIndex: 100,
  },
  offlineText: {
    color: 'white',
    fontWeight: 'bold',
  },
  refreshButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cacheTimeText: {
    color: '#cbd5e0',
    fontSize: 12,
    marginBottom: 15,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    backgroundColor: '#4299e1',
    padding: 10,
    borderRadius: 5,
    minWidth: '45%',
    alignItems: 'center',
  },
  continueButton: {
    backgroundColor: '#48bb78',
  },
  modalButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default MapScreen;