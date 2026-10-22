import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState('');
  const navigation = useNavigation();

  const requestCode = async () => {
    setError('');
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }
    try {
      await api('/forgotPassword', { method: 'POST', body: { email: email.trim() } });
      setCodeSent(true);
    } catch (err) {
      setError(err.message || 'Could not send a reset code. Please try again.');
    }
  };

  const resetPassword = async () => {
    setError('');
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    try {
      await api('/resetPassword', {
        method: 'POST',
        body: { email: email.trim(), code: code.trim(), newPassword },
      });
      Alert.alert('Password updated', 'You can log in with your new password.');
      navigation.navigate('Login');
    } catch (err) {
      setError(err.message || 'Could not reset your password. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>

      <FontAwesome name="lock" size={50} color="#68d391" style={styles.icon} />

      <View style={styles.form}>
        {!codeSent ? (
          <>
            <Text style={styles.instruction}>
              Enter your email and we&apos;ll send you a reset code.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={requestCode} style={styles.button}>
              <Text style={styles.buttonText}>Send Reset Code</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.instruction}>
              If {email.trim()} has an account, a 6-digit code is on its way. It expires in 15 minutes.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="6-digit code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TextInput
              style={styles.input}
              placeholder="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <TouchableOpacity onPress={resetPassword} style={styles.button}>
              <Text style={styles.buttonText}>Set New Password</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={requestCode}>
              <Text style={styles.link}>Send a new code</Text>
            </TouchableOpacity>
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Back to Login</Text>
        </TouchableOpacity>
      </View>
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
  },
  icon: {
    marginBottom: 20,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#4a5568',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  instruction: {
    color: 'gray',
    marginBottom: 10,
    fontSize: 14,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#48bb78',
    color: 'black',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    width: '100%',
  },
  button: {
    backgroundColor: '#48bb78',
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 18,
  },
  error: {
    color: '#feb2b2',
    marginTop: 10,
    textAlign: 'center',
  },
  link: {
    color: '#3182ce',
    textDecorationLine: 'underline',
    marginTop: 20,
  },
});

export default ForgotPassword;
