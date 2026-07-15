import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StatusBar as RNStatusBar, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Car } from './src/cars';
import { validateToken } from './src/github';
import { CarFormScreen } from './src/screens/CarFormScreen';
import { InventoryScreen } from './src/screens/InventoryScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { colors } from './src/theme';

type Screen =
  | { name: 'loading' }
  | { name: 'login' }
  | { name: 'inventory' }
  | { name: 'form'; car: Car | null };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'loading' });

  useEffect(() => {
    (async () => {
      try {
        setScreen((await validateToken()) ? { name: 'inventory' } : { name: 'login' });
      } catch {
        setScreen({ name: 'login' });
      }
    })();
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {screen.name === 'loading' && (
        <View style={styles.center}><ActivityIndicator color={colors.red} size="large" /></View>
      )}
      {screen.name === 'login' && <LoginScreen onSignedIn={() => setScreen({ name: 'inventory' })} />}
      {screen.name === 'inventory' && (
        <InventoryScreen
          onAdd={() => setScreen({ name: 'form', car: null })}
          onEdit={(car) => setScreen({ name: 'form', car })}
          onSignedOut={() => setScreen({ name: 'login' })}
        />
      )}
      {screen.name === 'form' && (
        <CarFormScreen
          car={screen.car}
          onDone={() => setScreen({ name: 'inventory' })}
          onCancel={() => setScreen({ name: 'inventory' })}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingTop: RNStatusBar.currentHeight ?? 0 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
