import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from "@react-navigation/native";
import { getSessionUser } from "../api";

const ProfileCreationCompletePage = () => {
  const navigation = useNavigation();

  // Signup already logged the user in, so go straight to their profile
  const handleContinue = async () => {
    const user = await getSessionUser();
    navigation.reset({
      index: 0,
      routes: user
        ? [{ name: 'HomeTabs', params: { screen: 'UserProfilePage', params: { email: user.email } } }]
        : [{ name: 'Login' }],
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile Creation Complete!</Text>
      <Text style={styles.subtitle}>You&apos;re all set! Click below to continue.</Text>

      <TouchableOpacity onPress={handleContinue} style={styles.button}>
        <Text style={styles.buttonText}>Go to My Profile</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center', 
    alignItems: 'center',      
    backgroundColor: '#2d3748',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#68d391',
    marginBottom: 20,
    textAlign: 'center',  
  },
  subtitle: {
    fontSize: 18,
    color: 'white',
    marginBottom: 40,
    textAlign: 'center',  
  },
  button: {
    backgroundColor: '#68d391',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 300,
  },
  buttonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 18,
  },
});

export default ProfileCreationCompletePage;
