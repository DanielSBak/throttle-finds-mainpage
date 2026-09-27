import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, AppState, FlatList, Image, Platform, Pressable, RefreshControl, Share, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Car, carTitle, fetchCars, imageUrl, setSold } from '../cars';
import { loadDraft } from '../drafts';
import { clearToken } from '../github';
import { colors, radius } from '../theme';
import { Button } from '../ui';
import * as SecureStore from 'expo-secure-store';
import { fetchSiteStatus, InventoryFilter, listingUrl, publicationStatus, SiteEntry, visibleCars } from '../inventory';
let rememberedQuery = '';
let rememberedFilter: InventoryFilter = 'All';
let rememberedView: 'Cards' | 'List' = 'Cards';


function formatNumber(v: string): string {
  const n = parseFloat(v);
  return isNaN(n) ? v : n.toLocaleString('en-US');
}

export function InventoryScreen(props: {
  onLoaded: (cars: Car[]) => void;
  onAdd: () => void;
  onEdit: (car: Car) => void;
  onSignedOut: () => void;
}) {
  const [cars, setCars] = useState<Car[]>([]);
  const [query, setQuery] = useState(rememberedQuery);
  const [filter, setFilter] = useState<InventoryFilter>(rememberedFilter);
  const [view, setView] = useState(rememberedView);
  const [site, setSite] = useState<SiteEntry[] | null>(null);
  const [checking, setChecking] = useState(false);
  const viewChosen = React.useRef(false);
  const statusRunning = React.useRef(false);
  const statusMounted = React.useRef(true);
  const refreshStatus = useCallback(async () => {
    if (statusRunning.current) return;
    statusRunning.current = true;
    if (statusMounted.current) setChecking(true);
    try { const data = await fetchSiteStatus(); if (statusMounted.current) setSite(data); }
    catch { if (statusMounted.current) setSite(null); }
    finally { statusRunning.current = false; if (statusMounted.current) setChecking(false); }
  }, []);
  useEffect(() => {
    statusMounted.current = true;
    void refreshStatus();
    void SecureStore.getItemAsync('inventory_view').then(value => {
      if (!viewChosen.current && (value === 'Cards' || value === 'List')) { rememberedView = value; setView(value); }
    }).catch(() => {});
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refreshStatus(); }, 30000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refreshStatus(); });
    return () => { statusMounted.current = false; clearInterval(timer); listener.remove(); };
  }, [refreshStatus]);
  function chooseView(value: 'Cards' | 'List') {
    viewChosen.current = true; rememberedView = value; setView(value);
    void SecureStore.setItemAsync('inventory_view', value).catch(() => {});
  }
  async function share(car: Car) {
    const url = listingUrl(car);
    if (!url) return;
    try { await Share.share(Platform.OS === 'ios' ? { message: carTitle(car), url } : { message: `${carTitle(car)}\n${url}` }); }
    catch { Alert.alert('Could not share', 'Please try again.'); }
  }
  const shown = visibleCars(cars, query, filter);

  const [loading, setLoading] = useState(true);
  const [hasDraft, setHasDraft] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [workingPath, setWorkingPath] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const loaded = await fetchCars();
      setCars(loaded); props.onLoaded(loaded);
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [props.onLoaded]);

  useEffect(() => { load(); void loadDraft('new').then((d) => setHasDraft(d !== null)).catch(() => setHasDraft(true)); }, [load]);

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
            void refreshStatus();
          } catch (e) {
            Alert.alert('Failed', String(e));
          } finally {
            setWorkingPath(null);
          }
        },
      },
    ]);
  }

  function listingActions(car: Car) {
    Alert.alert(carTitle(car), `Publication: ${publicationStatus(car, site)}`, [
      { text: 'Edit car', onPress: () => props.onEdit(car) },
      { text: 'Share', onPress: () => { void share(car); } },
      ...(workingPath === null ? [{ text: car.sold ? 'Restore to available' : 'Mark sold', onPress: () => { toggleSold(car); } }] : []),
      { text: 'Cancel', style: 'cancel' },
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

      <TextInput value={query} onChangeText={v => { rememberedQuery = v; setQuery(v); }}
        accessibilityLabel="Search inventory" placeholder="Search make, model, year or VIN" placeholderTextColor={colors.muted}
        autoCorrect={false} autoCapitalize="none" clearButtonMode="while-editing" style={styles.search} />
      <View style={styles.controls}>
        {(['All', 'Available', 'Sold'] as const).map(value => <Pressable key={value} accessibilityRole="button"
          accessibilityState={{ selected: filter === value }} onPress={() => { rememberedFilter = value; setFilter(value); }}
          style={[styles.control, filter === value && styles.selected]}>
          <Text style={styles.controlText}>{value} {value === 'All' ? cars.length : cars.filter(c => c.sold === (value === 'Sold')).length}</Text>
        </Pressable>)}
      </View>
      <View style={[styles.controls, { justifyContent: 'space-between' }]}>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{shown.length} cars · available first</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {(['Cards', 'List'] as const).map(value => <Pressable key={value} accessibilityRole="button"
            accessibilityState={{ selected: view === value }} onPress={() => chooseView(value)} style={[styles.control, view === value && styles.selected]}>
            <Text style={styles.controlText}>{value}</Text>
          </Pressable>)}
        </View>
      </View>
      {!!loadError && <Text style={{ color: '#ff8a8a', marginBottom: 12 }}>{loadError} Pull down to retry.</Text>}
      <FlatList
        data={shown}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        keyExtractor={(c) => c.path ?? carTitle(c)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); void refreshStatus(); }} tintColor={colors.muted} />}
        contentContainerStyle={{ paddingBottom: 110, gap: 14 }}
        ListEmptyComponent={
          loading || loadError ? null : <Text style={styles.empty}>{cars.length ? "No matching cars. Try another search or filter." : "No cars yet. Tap Add Car to get started."}</Text>
        }
        renderItem={({ item }) => view === 'List' ? (
          <View style={[styles.card, { flexDirection: 'row', alignItems: 'center' }]}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${carTitle(item)}`}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', padding: 10, gap: 10 }} onPress={() => props.onEdit(item)}>
              <Image source={{ uri: imageUrl(item.main_image) }} resizeMode="contain" style={{ width: 72, height: 48, borderRadius: 6, backgroundColor: '#000' }} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }} numberOfLines={2}>{carTitle(item)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>${formatNumber(item.price)} · {formatNumber(item.mileage)} mi</Text>
                <Text style={{ color: item.sold ? colors.muted : '#78d6a0', fontSize: 11 }}>
                  {item.sold ? 'SOLD' : 'AVAILABLE'} · {publicationStatus(item, site)}
                </Text>
              </View>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${carTitle(item)}`} onPress={() => listingActions(item)}
              style={{ width: 44, minHeight: 60, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.text, fontSize: 24 }}>···</Text></Pressable>
          </View>
        ) : (
          <Pressable style={[styles.card, item.sold && { opacity: 0.65 }]} onPress={() => props.onEdit(item)}>
            {item.main_image ? (
              <Image source={{ uri: imageUrl(item.main_image) }} resizeMode="contain" style={[styles.photo]} />
            ) : (
              <View style={[styles.photo, styles.noPhoto]}><Text style={{ color: colors.muted }}>No photo</Text></View>
            )}
            <View style={[styles.cardBody]}>
              <Text style={styles.carTitle} numberOfLines={2}>{carTitle(item)}</Text>
              <Text style={styles.price}>${formatNumber(item.price)} · {formatNumber(item.mileage)} mi</Text>
              <View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>
                {item.sold ? (
                  <View style={[styles.badge, styles.badgeSold]}><Text style={styles.badgeText}>SOLD</Text></View>
                ) : (
                  <View style={[styles.badge, styles.badgeLive]}><Text style={styles.badgeText}>AVAILABLE</Text></View>
                )}
              </View>
              <Pressable accessibilityRole="button" onPress={() => {
                Alert.alert('Publication status', 'Live: the website includes this saved version.\nUpdating: saved, but the website has not caught up yet.\nSaved: stored in inventory; website status could not be verified. Pull down to check again.');
              }} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ color: publicationStatus(item, site) === 'Live' ? '#78d6a0' : colors.muted, fontSize: 12 }}>
                  {checking ? '◌ Checking website…' : `${publicationStatus(item, site) === 'Live' ? '●' : '◌'} ${publicationStatus(item, site)}`}
                </Text>
              </Pressable>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                <Pressable accessibilityRole="button" style={styles.soldBtn} disabled={workingPath !== null} onPress={() => toggleSold(item)}>
                  <Text style={styles.soldBtnText}>{workingPath === item.path ? '…' : item.sold ? 'Restore' : 'Mark sold'}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.control} onPress={() => void share(item)}>
                  <Text style={styles.controlText}>Share</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        )}
      />

      <View style={styles.fabWrap}>
        <Button title={hasDraft ? "Continue Saved Draft" : "+  Add Car"} onPress={props.onAdd} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  search: { color: colors.text, backgroundColor: colors.card, borderRadius: radius.md, padding: 14, minHeight: 48, fontSize: 15, marginBottom: 8 },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 },
  control: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  selected: { backgroundColor: '#542326', borderColor: colors.red },
  controlText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  listCard: { flexDirection: 'row', alignItems: 'flex-start' },
  listPhoto: { width: 88, height: 66, margin: 10, borderRadius: 8 },
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
  photo: { width: '100%', aspectRatio: 3 / 2, backgroundColor: '#000' },
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
    minHeight: 44, justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.red,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  soldBtnText: { color: '#ff8a8a', fontWeight: '800', fontSize: 13 },
  fabWrap: { position: 'absolute', left: 16, right: 16, bottom: 24 },
});
