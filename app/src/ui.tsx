import React, { useState } from 'react';
import { suggestions } from './suggestions';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
  type KeyboardTypeOptions,
} from 'react-native';
import { colors, radius } from './theme';

export function Button(props: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'ghost' | 'danger';
  busy?: boolean;
  disabled?: boolean;
}) {
  const kind = props.kind ?? 'primary';
  const disabled = props.disabled || props.busy;
  return (
    <Pressable
      onPress={props.onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        kind === 'primary' && { backgroundColor: colors.red },
        kind === 'ghost' && styles.btnGhost,
        kind === 'danger' && styles.btnDanger,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      {props.busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={[styles.btnText, kind === 'ghost' && { color: colors.text }]}>{props.title}</Text>
      )}
    </Pressable>
  );
}

export function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  suggestions?: string[];
}) {
  const [focused, setFocused] = useState(false);
  const options = focused ? suggestions(props.value, props.suggestions ?? []) : [];
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={[styles.input, props.multiline && { minHeight: 90, textAlignVertical: 'top' }]}
        value={props.value}
        onChangeText={props.onChange}
        accessibilityLabel={props.label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={props.placeholder}
        placeholderTextColor="#5f656d"
        keyboardType={props.keyboardType}
        multiline={props.multiline}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {options.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {options.map(option => <Pressable key={option} accessibilityRole="button" accessibilityLabel={`Use ${option}`}
          onPress={() => props.onChange(option)} style={({ pressed }) => [styles.chip, { minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.6 : 1 }]}>
          <Text style={{ color: colors.text }}>{option}</Text>
        </Pressable>)}
      </View>}
    </View>
  );
}

export function ChipSelect(props: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.chipRow}>
        {props.options.map((opt) => {
          const active = opt === props.value;
          return (
            <Pressable
              key={opt}
              onPress={() => props.onChange(opt)}
              style={[styles.chip, active && { backgroundColor: colors.red, borderColor: colors.red }]}
            >
              <Text style={[styles.chipText, active && { color: '#fff' }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  btnDanger: { backgroundColor: '#3a1516', borderWidth: 1, borderColor: '#6e2223' },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  field: { marginBottom: 16 },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  input: {
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.card,
    paddingVertical: 9,
    paddingHorizontal: 15,
  },
  chipText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
});
