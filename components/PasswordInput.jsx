import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// A password field with an eye button to show or hide what was typed.
// `style` is the screen's usual input style; other props go to the TextInput.
const PasswordInput = ({ style, ...inputProps }) => {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[style, styles.row]}>
      <TextInput
        {...inputProps}
        style={styles.input}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        hitSlop={8}
      >
        <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color="black" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, color: 'black', padding: 0, marginRight: 8 },
});

export default PasswordInput;
