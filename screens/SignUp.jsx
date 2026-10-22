import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome } from '@expo/vector-icons';
import { useNavigation } from "@react-navigation/native";
import { api, saveSession } from '../api';
import PasswordInput from '../components/PasswordInput';
import { isValidEmail, newPasswordProblem, MAX_USERNAME_LENGTH } from '../validation';


const SignUp = () => {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigation = useNavigation();
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
  
    const name = username.trim();
    if (!name) {
      setError("Username is required.");
      return;
    }
    if (name.length > MAX_USERNAME_LENGTH) {
      setError(`Username must be ${MAX_USERNAME_LENGTH} characters or fewer.`);
      return;
    }
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    const passwordError = newPasswordProblem(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    try {
      const session = await api('/signup', { method: 'POST', body: { username: name, email: email.trim(), password } });
      await saveSession(session);
      navigation.navigate('CreateProfile', { email: email.trim() });
    } catch (err) {
      setError(err.message || "An error occurred. Please try again.");
    }
  };
  
  

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create an Account</Text>

      <FontAwesome name="user-plus" size={50} color="#68d391" style={styles.icon} />

      <View style={styles.form}>
        <TextInput
          placeholder="Username"
          placeholderTextColor="black"
          style={styles.input}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={MAX_USERNAME_LENGTH}
        />
        <TextInput
          placeholder="Email"
          placeholderTextColor="black"
          style={styles.input}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
        />
        <PasswordInput
          placeholder="Password"
          placeholderTextColor="black"
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          autoComplete="new-password"
          onSubmitEditing={handleSubmit}
        />

        {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

        <TouchableOpacity onPress={handleSubmit} style={styles.button}>
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>
          Already have an account? Log in
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2d3748",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#68d391",
    marginBottom: 20,
  },
  icon: {
    marginBottom: 20,
  },
  form: {
    width: "90%",
    maxWidth: 400,
    backgroundColor: "#4a5568",
    borderRadius: 12,
    padding: 20,
  },
  input: {
    backgroundColor: "#48bb78",
    color: "black",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#48bb78",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "black",
    fontWeight: "bold",
    fontSize: 18,
  },
  link: {
    color: "#3182ce",
    marginTop: 20,
    textDecorationLine: "underline",
  },
  errorText: {
    color: "red",
    marginBottom: 10,
    textAlign: "center",
  },  
});

export default SignUp;
