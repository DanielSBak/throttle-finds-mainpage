import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { Car, carTitle, fetchCars, imageUrl, setSold } from '../cars';
import { clearToken } from '../github';
import { colors, radius } from '../theme';
import { Button } from '../ui';

function formatNumber(v: string): string {
  const n = parseFloat(v);
  return isNaN(n) ? v : n.toLocaleString('en-US');
}

export function InventoryScreen(props: {
  onAdd: () => void;
  onEdit: (car: Car) => void;
  onSignedOut: () => void;
}) {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingPath, setWorkingPath] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCars(await fetchCars());
    } catch (e) {
      Alert.alert('Could not load inventory', String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleSold(car: Car) {
    const next = !car.sold;
    const verb = next ? 'Mark as SOLD' : 'Mark as available';
    Alert.alert(verb, `${carTitle(car)} — are you sure?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes',
        onPress: async () => {
          setWorkingPath(car.path ?? null);
          try {
            await setSold(car, next);
            await load();
          } catch (e) {
            Alert.alert('Failed', String(e));
          } finally {
            setWorkingPath(null);
          }
        },
      },
    ]);
  }

  function signOut() {
    Alert.alert('Sign out', 'Remove your access token from this phone?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await clearToken(); props.onSignedOut(); } },
    ]);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        <Pressable onPress={signOut}><Text style={styles.signOut}>Sign out</Text></Pressable>
      </View>

      <FlatList
        data={cars}
        keyExtractor={(c) => c.path ?? carTitle(c)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.muted} />}
        contentContainerStyle={{ paddingBottom: 110, gap: 14 }}
        ListEmptyComponent={
          loading ? null : <Text style={styles.empty}>No cars yet. Tap “Add Car” to publish the first one.</Text>
        }
        renderItem={({ item }) => (
          <Pressable style={[styles.card, item.sold && { opacity: 0.65 }]} onPress={() => props.onEdit(item)}>
            {item.main_image ? (
              <Image source={{ uri: imageUrl(item.main_image) }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.noPhoto]}><Text style={{ color: colors.muted }}>No photo</Text></View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.carTitle} numberOfLines={1}>{carTitle(item)}</Text>
              <Text style={styles.price}>${formatNumber(item.price)} · {formatNumber(item.mileage)} mi</Text>
              <View style={styles.row}>
                {item.sold ? (
                  <View style={[styles.badge, styles.badgeSold]}><Text style={styles.badgeText}>SOLD</Text></View>
                ) : (
                  <View style={[styles.badge, styles.badgeLive]}><Text style={styles.badgeText}>ON SITE</Text></View>
                )}
                <Pressable
                  style={styles.soldBtn}
                  disabled={workingPath === item.path}
                  onPress={() => toggleSold(item)}
                >
                  <Text style={styles.soldBtnText}>
                    {workingPath === item.path ? '…' : item.sold ? 'Put back on sale' : 'Mark sold'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        )}
      />

      <View style={styles.fabWrap}>
        <Button title="+  Add Car" onPress={props.onAdd} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', letterSpacing: 1 },
  signOut: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 60, paddingHorizontal: 30, lineHeight: 22 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  photo: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  noPhoto: { alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 14, gap: 6 },
  carTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  price: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  badge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 10 },
  badgeLive: { backgroundColor: 'rgba(46,158,91,0.18)', borderWidth: 1, borderColor: 'rgba(46,158,91,0.5)' },
  badgeSold: { backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  soldBtn: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.red,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  soldBtnText: { color: '#ff8a8a', fontWeight: '800', fontSize: 13 },
  fabWrap: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});
