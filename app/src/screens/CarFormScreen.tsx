import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import {
  Car, DRIVE_OPTIONS, FUEL_OPTIONS, TITLE_OPTIONS, carTitle,
  imageUrl, removeCar, validateCar,
} from '../cars';
import { pickPhotos } from '../photos';
import { Draft, createDraft, deleteDraft, draftKey, loadDraft, photoUri, prepareDraft, saveDraft } from '../drafts';
import { publishDraft } from '../publish';
import { colors, radius } from '../theme';
import { Button, ChipSelect, Field } from '../ui';

export function CarFormScreen(props: { car: Car | null; onDone: () => void; onCancel: () => void }) {
  const editing = props.car !== null;
  const key = draftKey(props.car);
  const [draft, setDraft] = useState(() => createDraft(props.car));
  const current = useRef(draft);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [progress, setProgress] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const saveGeneration = useRef(0);
  const { car, images } = draft;

  function apply(next: Draft): Promise<void> {
    current.current = next;
    setDraft(next);
    setDraftStatus('Saving draft…');
    const generation = ++saveGeneration.current;
    const job = saveDraft(key, next);
    void job.then(() => {
      if (generation === saveGeneration.current) setDraftStatus('Draft saved on this phone');
    }, () => {
      if (generation === saveGeneration.current) setDraftStatus('Draft could not be saved. Free up space and try again before leaving.');
    });
    return job;
  }

  useEffect(() => {
    let active = true;
    loadDraft(key).then((saved) => {
      if (!active) return;
      if (!saved) { setReady(true); return; }
      const restore = () => {
        current.current = saved;
        setDraft(saved);
        setDraftStatus('Saved draft restored');
        setReady(true);
      };
      if (props.car && saved.car.sha !== props.car.sha) {
        Alert.alert('Listing changed', 'Someone updated this listing after your draft was saved. Keep your draft for reference, or discard it and open the latest version. Publishing an outdated draft will not overwrite their changes.', [
          { text: 'Keep draft', onPress: restore },
          { text: 'Use latest', style: 'destructive', onPress: () => {
            void deleteDraft(key).then(() => { setReady(true); }, (e) => Alert.alert('Could not clear draft', String(e)));
          } },
        ], { cancelable: false });
      } else restore();
    }).catch((e) => {
      if (active) Alert.alert('Could not open draft', String(e), [{ text: 'Back', onPress: props.onCancel }]);
    });
    return () => { active = false; };
  }, []);

  function set<K extends keyof Car>(field: K, value: Car[K]) {
    if (locked.current) return;
    void apply({ ...current.current, car: { ...current.current.car, [field]: value } });
  }

  async function addPhotos() {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try {
      await pickPhotos(10 - current.current.images.length, key, async (photo) => {
        await apply({ ...current.current, images: [...current.current.images, photo] });
      }, setProgress);
    } catch (e) {
      Alert.alert('Could not add photo', e instanceof Error ? e.message : String(e));
    } finally { locked.current = false; setBusy(false); setProgress(''); }
  }

  function removePhoto(index: number) {
    if (!locked.current) void apply({ ...current.current, images: current.current.images.filter((_, i) => i !== index) });
  }
  function makeCover(index: number) {
    if (!locked.current) void apply({ ...current.current, images: [current.current.images[index], ...current.current.images.filter((_, i) => i !== index)] });
  }

  async function leave() {
    if (locked.current) return;
    locked.current = true; setBusy(true);
    try { await saveDraft(key, current.current); props.onCancel(); }
    catch (e) { Alert.alert('Draft not saved', 'Could not save this draft. Free up space and try again before leaving.'); }
    finally { locked.current = false; setBusy(false); }
  }

  function discard() {
    Alert.alert('Discard draft?', 'Remove the unsaved changes and local photos from this phone? Published listings will stay on the website.', [
      { text: 'Keep draft', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: async () => {
        if (locked.current) return;
        locked.current = true; setBusy(true);
        try { await deleteDraft(key); props.onCancel(); }
        catch (e) { Alert.alert('Could not discard draft', String(e)); }
        finally { locked.current = false; setBusy(false); }
      } },
    ]);
  }

  async function save() {
    if (locked.current) return;
    const problem = validateCar(current.current.car, current.current.images.length);
    if (problem) { Alert.alert('Almost there', problem); return; }
    locked.current = true; setBusy(true);
    try {
      const prepared = prepareDraft(current.current);
      await apply(prepared);
      await publishDraft(key, prepared, setProgress);
      try { await deleteDraft(key); }
      catch { /* Publishing succeeded. An unchanged retained draft is safe to retry. */ }
      Alert.alert('Published!', 'The website will update after GitHub finishes rebuilding it.');
      props.onDone();
    } catch (e) {
      Alert.alert('Could not publish', e instanceof Error ? e.message : String(e));
    } finally { locked.current = false; setBusy(false); setProgress(''); }
  }

  function confirmDelete() {
    Alert.alert('Delete listing', `Remove ${carTitle(car)} from the website completely? For sold cars, use “Mark sold” instead.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (locked.current) return;
          locked.current = true; setBusy(true);
          try {
            await removeCar(current.current.car);
            await deleteDraft(key);
            props.onDone();
          } catch (e) {
            Alert.alert('Delete failed', String(e));
          } finally {
            locked.current = false; setBusy(false);
          }
        },
      },
    ]);
  }

  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.red} /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable disabled={busy} onPress={leave}><Text style={styles.cancel}>‹ Back</Text></Pressable>
          <Text style={styles.title}>{editing ? 'Edit Car' : 'Add Car'}</Text>
          <View style={{ width: 50 }} />
        </View>

        <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, marginBottom: 12 }}>{progress || draftStatus}</Text>
        <View pointerEvents={busy ? 'none' : 'auto'}>
        <Text style={styles.sectionLabel}>Photos (first one is the cover)</Text>
        <View style={styles.photoGrid}>
          {images.map((img, i) => (
            <View key={img.id} style={styles.photoCell}>
              <Image source={{ uri: img.localFile ? photoUri(key, img.localFile) : imageUrl(img.repoPath) }} style={styles.photo} />
              {i === 0 && <View style={styles.coverTag}><Text style={styles.coverTagText}>COVER</Text></View>}
              <View style={styles.photoActions}>
                {i !== 0 && (
                  <Pressable onPress={() => makeCover(i)} style={styles.photoAction}>
                    <Text style={styles.photoActionText}>★</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => removePhoto(i)} style={styles.photoAction}>
                  <Text style={styles.photoActionText}>✕</Text>
                </Pressable>
              </View>
            </View>
          ))}
          {images.length < 10 && (
            <Pressable onPress={addPhotos} style={[styles.photoCell, styles.addPhoto]}>
              <Text style={{ color: colors.muted, fontSize: 30 }}>＋</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.rowFields}>
          <View style={{ flex: 1 }}><Field label="Year" value={car.year} onChange={(v) => set('year', v)} placeholder="2020" keyboardType="number-pad" /></View>
          <View style={{ flex: 1.4 }}><Field label="Make" value={car.make} onChange={(v) => set('make', v)} placeholder="BMW" /></View>
          <View style={{ flex: 1.4 }}><Field label="Model" value={car.model} onChange={(v) => set('model', v)} placeholder="M5" /></View>
        </View>
        <View style={styles.rowFields}>
          <View style={{ flex: 1 }}><Field label="Price ($)" value={car.price} onChange={(v) => set('price', v)} placeholder="67000" keyboardType="number-pad" /></View>
          <View style={{ flex: 1 }}><Field label="Mileage" value={car.mileage} onChange={(v) => set('mileage', v)} placeholder="12000" keyboardType="number-pad" /></View>
        </View>
        <Field label="VIN" value={car.vin} onChange={(v) => set('vin', v)} placeholder="WBS83CH0..." />
        <Field label="Engine" value={car.engine} onChange={(v) => set('engine', v)} placeholder="4.4L V8 Twin Turbo" />
        <Field label="Transmission" value={car.transmission} onChange={(v) => set('transmission', v)} placeholder="8-Speed Automatic" />
        <ChipSelect label="Fuel" options={FUEL_OPTIONS} value={car.fuel} onChange={(v) => set('fuel', v)} />
        <ChipSelect label="Drivetrain" options={DRIVE_OPTIONS} value={car.drive} onChange={(v) => set('drive', v)} />
        <ChipSelect label="Title Status" options={TITLE_OPTIONS} value={car.title_status} onChange={(v) => set('title_status', v)} />
        <View style={styles.rowFields}>
          <View style={{ flex: 1 }}><Field label="Exterior Color" value={car.exterior_color} onChange={(v) => set('exterior_color', v)} placeholder="Black" /></View>
          <View style={{ flex: 1 }}><Field label="Interior Color" value={car.interior_color} onChange={(v) => set('interior_color', v)} placeholder="Red" /></View>
        </View>
        <Field label="Description & Mechanic Notes" value={car.body} onChange={(v) => set('body', v)} placeholder="Condition, work done, known issues..." multiline />

        </View>
        <Button title={editing ? 'Save Changes' : 'Publish to Website'} onPress={save} busy={busy} />
        <View style={{ marginTop: 12 }}><Button title="Discard Draft" kind="ghost" onPress={discard} disabled={busy} /></View>
        {editing && (
          <View style={{ marginTop: 12 }}>
            <Button title="Delete Listing" kind="danger" onPress={confirmDelete} disabled={busy} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  cancel: { color: colors.muted, fontSize: 16, fontWeight: '700', width: 50 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  sectionLabel: {
    color: colors.muted, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  photoCell: {
    width: '31%', aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder,
  },
  photo: { width: '100%', height: '100%' },
  addPhoto: { alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
  coverTag: {
    position: 'absolute', top: 6, left: 6, backgroundColor: colors.red,
    borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2,
  },
  coverTagText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  photoActions: { position: 'absolute', top: 4, right: 4, flexDirection: 'row', gap: 4 },
  photoAction: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoActionText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  rowFields: { flexDirection: 'row', gap: 10 },
});
