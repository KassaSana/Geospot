import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// react-native-maps has no web support; Metro picks this file for web builds only
const MapScreen = () => (
  <View style={styles.container}>
    <Text style={styles.text}>The map is only available in the mobile app.</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#2d3748', padding: 20 },
  text: { color: '#68d391', fontSize: 18, textAlign: 'center' },
});

export default MapScreen;
