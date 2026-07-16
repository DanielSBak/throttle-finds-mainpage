import React, { useState } from 'react';
import {
  Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import {
  Car, DRIVE_OPTIONS, FUEL_OPTIONS, TITLE_OPTIONS, carTitle, emptyCar,
  imageUrl, removeCar, saveCar, slugify,
} from '../cars';
import { putBinaryFile } from '../github';
import { PickedPhoto, pickPhotos } from '../photos';
import { colors, radius } from '../theme';
import { Button, ChipSelect, Field } from '../ui';

interface PendingImage {
  /** Preview URI (local for new photos, site URL for existing ones). */
  preview: string;
  /** Set only for freshly picked photos that still need uploading. */
  upload?: PickedPhoto;
  /** Set only for photos already in the repo. */
  repoPath?: string;
}

export function CarFormScreen(props: { car: Car | null; onDone: () => void; onCancel: () => void }) {
  const editing = props.car !== null;
  const [car, setCar] = useState<Car>(props.car ? { ...props.car } : emptyCar());
  const [images, setImages] = useState<PendingImage[]>(() => {
    if (!props.car) return [];
    const existing = [props.car.main_image, ...props.car.gallery].filter(Boolean);
    return existing.map((p) => ({ preview: imageUrl(p), repoPath: p }));
  });
  const [busy, setBusy] = useState(false);

  function set<K extends keyof Car>(key: K, value: Car[K]) {
    setCar((c) => ({ ...c, [key]: value }));
  }

  async function addPhotos() {
    const picked = await pickPhotos(10 - images.length);
    setImages((imgs) => [...imgs, ...picked.map((p) => ({ preview: p.uri, upload: p }))]);
  }

  function removePhoto(index: number) {
    setImages((imgs) => imgs.filter((_, i) => i !== index));
  }

  function makeCover(index: number) {
    setImages((imgs) => [imgs[index], ...imgs.filter((_, i) => i !== index)]);
  }

  function validate(): string | null {
    if (!car.year.trim() || !/^\d{4}$/.test(car.year.trim())) return 'Enter a 4-digit year';
    if (!car.make.trim()) return 'Enter the make (e.g. BMW)';
    if (!car.model.trim()) return 'Enter the model (e.g. M5)';
    if (!car.price.trim() || isNaN(parseFloat(car.price))) return 'Enter the price as a number';
    if (!car.mileage.trim() || isNaN(parseFloat(car.mileage))) return 'Enter the mileage as a number';
    if (images.length === 0) return 'Add at least one photo';
    return null;
  }

  async function save() {
    const problem = validate();
    if (problem) { Alert.alert('Almost there', problem); return; }
    setBusy(true);
    try {
      const slug = slugify(car);
      const stamp = Date.now().toString(36);
      const paths: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.repoPath) {
          paths.push(img.repoPath);
        } else if (img.upload) {
          const name = `${slug}-${stamp}-${i + 1}.jpg`;
          const path = `images/uploads/${name}`;
          await putBinaryFile(path, img.upload.base64, `Add photo for ${carTitle(car)} [via app]`);
          if (img.upload.thumbBase64) {
            await putBinaryFile(`images/uploads/thumbs/${name}`, img.upload.thumbBase64, `Add thumb for ${carTitle(car)} [via app]`);
          }
          paths.push(path);
        }
      }
      const toSave: Car = { ...car, main_image: paths[0], gallery: paths.slice(1) };
      await saveCar(toSave);
      Alert.alert('Published!', 'The website updates in about a minute.', [{ text: 'OK', onPress: props.onDone }]);
    } catch (e) {
      Alert.alert('Save failed', String(e));
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Delete listing', `Remove ${carTitle(car)} from the website completely? For sold cars, use “Mark sold” instead.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await removeCar(car);
            props.onDone();
          } catch (e) {
            Alert.alert('Delete failed', String(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable onPress={props.onCancel}><Text style={styles.cancel}>‹ Back</Text></Pressable>
          <Text style={styles.title}>{editing ? 'Edit Car' : 'Add Car'}</Text>
          <View style={{ width: 50 }} />
        </View>

        <Text style={styles.sectionLabel}>Photos (first one is the cover)</Text>
        <View style={styles.photoGrid}>
          {images.map((img, i) => (
            <View key={img.preview + i} style={styles.photoCell}>
              <Image source={{ uri: img.preview }} style={styles.photo} />
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

        <Button title={editing ? 'Save Changes' : 'Publish to Website'} onPress={save} busy={busy} />
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
