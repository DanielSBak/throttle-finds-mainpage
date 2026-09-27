import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Keyboard, Modal, PanResponder, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DraftImage, photoUri } from './drafts';
import { imageUrl } from './cars';
import { cropPhoto } from './photos';
import { clamp, cropRectangle, movePhoto } from './photoGeometry';
import { colors, radius } from './theme';

function Action({ title, onPress, disabled = false }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={({'←': 'Move photo left', '↑': 'Move photo up', '↓': 'Move photo down', '→': 'Move photo right'} as Record<string, string>)[title] ?? title} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.action, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}>
    <Text style={styles.actionText}>{title}</Text>
  </Pressable>;
}
const uriFor = (photo: DraftImage, draftKey: string, original = false) => {
  const file = original ? photo.originalFile ?? photo.localFile : photo.localFile;
  return file ? photoUri(draftKey, file) : imageUrl(original ? photo.originalRepoPath ?? photo.repoPath : photo.repoPath);
};

function DragHandle({ onStart, onMove, onEnd, onCancel }: {
  onStart: () => void; onMove: (dx: number, dy: number) => void;
  onEnd: (dx: number, dy: number) => void; onCancel: () => void;
}) {
  const current = useRef({ onStart, onMove, onEnd, onCancel });
  current.current = { onStart, onMove, onEnd, onCancel };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => current.current.onStart(),
    onPanResponderMove: (_, g) => current.current.onMove(g.dx, g.dy),
    onPanResponderRelease: (_, g) => current.current.onEnd(g.dx, g.dy),
    onPanResponderTerminate: () => current.current.onCancel(),
    onPanResponderTerminationRequest: () => false,
  })).current;
  return <View {...pan.panHandlers} accessibilityLabel="Drag to reorder. You can also open the photo and use Move left or Move right." style={styles.handle}>
    <Text style={styles.handleText}>≡ Move</Text>
  </View>;
}

export function PhotoEditor(props: {
  images: DraftImage[]; draftKey: string; onChange: (images: DraftImage[]) => Promise<void>;
  onAdd: () => void; onDragging: (dragging: boolean) => void;
}) {
  const { images, draftKey } = props;
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [cropping, setCropping] = useState(false);
  const [previewSize, setPreviewSize] = useState({ width: 1, height: 250 });
  const [drag, setDrag] = useState<{ from: number; to: number; dx: number; dy: number } | null>(null);
  const cell = (width - 16) / 3;
  const row = cell * 2 / 3 + 44 + 8;
  const index = images.findIndex(p => p.id === selected);
  const photo = images[index];
  const change = (next: DraftImage[]) => { void props.onChange(next).catch(() => Alert.alert('Draft not saved', 'Free up space and try again before leaving.')); };
  const target = (from: number, dx: number, dy: number) => {
    const col = clamp(Math.round(from % 3 + dx / (cell + 8)), 0, 2);
    const r = clamp(Math.round(Math.floor(from / 3) + dy / row), 0, Math.floor((images.length - 1) / 3));
    return clamp(r * 3 + col, 0, images.length - 1);
  };
  function stop() { setDrag(null); props.onDragging(false); }
  function remove() {
    Alert.alert('Remove photo?', 'This removes the photo from this draft. Publish your changes to update the website.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => {
        change(images.filter(p => p.id !== selected)); setSelected(null);
      } },
    ]);
  }
  return <View>
    <Text style={styles.heading}>Photos · {images.length}/10</Text>
    <Text style={styles.help}>First photo is the cover. Tap to view or crop. Drag the Move handle to reorder.</Text>
    <View onLayout={e => setWidth(e.nativeEvent.layout.width)} style={styles.grid}>
      {width > 0 && images.map((p, i) => <View key={p.id}
        style={[styles.cell, { width: cell, zIndex: drag?.from === i ? 10 : 0,
          borderColor: drag?.to === i ? colors.red : colors.cardBorder },
          drag?.from === i && { transform: [{ translateX: drag.dx }, { translateY: drag.dy }], opacity: 0.85 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open photo ${i + 1}${i === 0 ? ', cover' : ''}`}
          onPress={() => { Keyboard.dismiss(); setSelected(p.id); }}>
          <Image source={{ uri: uriFor(p, draftKey) }} resizeMode="contain" style={{ width: '100%', aspectRatio: 1.5, backgroundColor: '#000' }} />
          <View style={styles.tag}><Text style={styles.tagText}>{i === 0 ? 'COVER' : i + 1}</Text></View>
        </Pressable>
        <DragHandle onStart={() => { props.onDragging(true); setDrag({ from: i, to: i, dx: 0, dy: 0 }); }}
          onMove={(dx, dy) => setDrag({ from: i, to: target(i, dx, dy), dx, dy })}
          onEnd={(dx, dy) => { const to = target(i, dx, dy); stop(); if (to !== i) change(movePhoto(images, i, to)); }} onCancel={stop} />
      </View>)}
    </View>
    {images.length < 10 && <Action title="＋ Add photos" onPress={props.onAdd} />}
    <Modal visible={!!photo} animationType="slide" onRequestClose={() => { if (!cropping) setSelected(null); }}>
      <SafeAreaView style={styles.modal}>
        {photo && (cropping ? <CropEditor photo={photo} draftKey={draftKey} onCancel={() => setCropping(false)}
          onSave={async next => {
            // Cropping explicitly chooses this image as the cover.
            await props.onChange([next, ...images.filter(p => p.id !== photo.id)]);
            setSelected(next.id); setCropping(false);
          }} /> : <>
          <View style={styles.bar}><Text style={styles.heading}>Photo {index + 1} of {images.length}{index === 0 ? ' · Cover' : ''}</Text>
            <Action title="Done" onPress={() => setSelected(null)} /></View>
          <View style={{ flex: 1 }} onLayout={e => setPreviewSize(e.nativeEvent.layout)}>
          <ScrollView style={StyleSheet.absoluteFill} centerContent
            minimumZoomScale={1} maximumZoomScale={3} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}
            key={photo.id}>
            <Image source={{ uri: uriFor(photo, draftKey) }} resizeMode="contain" style={{ width: previewSize.width, height: previewSize.height }}
              accessibilityLabel={`Photo ${index + 1}`} />
          </ScrollView>
          </View>
          <ScrollView style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ padding: 16, gap: 8 }}>
            <View style={styles.bar}><Action title="‹ Previous" disabled={index === 0} onPress={() => setSelected(images[index - 1].id)} />
              <Action title="Next ›" disabled={index === images.length - 1} onPress={() => setSelected(images[index + 1].id)} /></View>
            <View style={styles.bar}><Action title="Make cover" disabled={index === 0} onPress={() => change(movePhoto(images, index, 0))} />
              <Action title="Crop cover · 3:2" onPress={() => setCropping(true)} /></View>
            <View style={styles.bar}><Action title="Move left" disabled={index === 0} onPress={() => change(movePhoto(images, index, index - 1))} />
              <Action title="Move right" disabled={index === images.length - 1} onPress={() => change(movePhoto(images, index, index + 1))} /></View>
            <Action title="Remove photo" onPress={remove} />
          </ScrollView>
        </>)}
      </SafeAreaView>
    </Modal>
  </View>;
}

function CropEditor({ photo, draftKey, onCancel, onSave }: {
  photo: DraftImage; draftKey: string; onCancel: () => void; onSave: (p: DraftImage) => Promise<void>;
}) {
  const uri = uriFor(photo, draftKey, true);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState('');
  const [frame, setFrame] = useState(0);
  const [position, setPosition] = useState({ x: 0.5, y: 0.5, zoom: 1 });
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const latest = useRef({ size, frame, position, busy }); latest.current = { size, frame, position, busy };
  const start = useRef(position);
  useEffect(() => {
    let active = true;
    Image.getSize(uri, (width, height) => { if (active) setSize({ width, height }); }, () => { if (active) setError('Could not open photo. Check your connection and try again.'); });
    return () => { active = false; };
  }, [uri]);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !latest.current.busy,
    onMoveShouldSetPanResponder: () => !latest.current.busy,
    onPanResponderGrant: () => { start.current = latest.current.position; },
    onPanResponderMove: (_, g) => {
      const { size: s, frame: f } = latest.current;
      if (!s || !f || latest.current.busy) return;
      const rect = cropRectangle(s.width, s.height, start.current.zoom, start.current.x, start.current.y);
      const scale = f / rect.width;
      setPosition({ ...start.current,
        x: s.width > rect.width ? clamp(start.current.x - g.dx / (scale * (s.width - rect.width)), 0, 1) : 0.5,
        y: s.height > rect.height ? clamp(start.current.y - g.dy / (scale * (s.height - rect.height)), 0, 1) : 0.5 });
    },
    onPanResponderTerminationRequest: () => false,
  })).current;
  const rect = size && cropRectangle(size.width, size.height, position.zoom, position.x, position.y);
  const scale = rect && frame ? frame / rect.width : 1;
  async function save() {
    if (!rect || locked.current) return;
    locked.current = true; setBusy(true);
    try { await onSave(await cropPhoto(photo, uri, draftKey, rect)); }
    catch (e) { Alert.alert('Could not crop photo', e instanceof Error ? e.message : String(e)); }
    finally { locked.current = false; setBusy(false); }
  }
  return <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
    <Text style={styles.heading}>Frame your cover · 3:2</Text>
    <Text style={styles.help}>Drag the photo to keep the whole car inside the frame. Use the arrows for fine adjustments and + to zoom in. Your original stays available in this draft.</Text>
    {!!error && <Text style={styles.help}>{error}</Text>}
    <View onLayout={e => setFrame(e.nativeEvent.layout.width)} {...pan.panHandlers}
      style={{ width: '100%', aspectRatio: 1.5, overflow: 'hidden', backgroundColor: '#000', borderRadius: 12 }}>
      {size && rect ? <Image source={{ uri }} style={{ position: 'absolute', width: size.width * scale, height: size.height * scale,
        left: -rect.originX * scale, top: -rect.originY * scale }} /> : !error && <ActivityIndicator color={colors.red} />}
      {[1, 2].map(n => <React.Fragment key={n}>
        <View pointerEvents="none" style={{ position: 'absolute', left: `${n * 100 / 3}%`, top: 0, bottom: 0, width: 1, backgroundColor: '#ffffff88' }} />
        <View pointerEvents="none" style={{ position: 'absolute', top: `${n * 100 / 3}%`, left: 0, right: 0, height: 1, backgroundColor: '#ffffff88' }} />
      </React.Fragment>)}
    </View>
    <View style={styles.bar}>
      <Action title="− Zoom out" disabled={busy || position.zoom <= 1} onPress={() => setPosition(p => ({ ...p, zoom: Math.max(1, p.zoom - 0.25) }))} />
      <Action title="＋ Zoom in" disabled={busy || position.zoom >= 3} onPress={() => setPosition(p => ({ ...p, zoom: Math.min(3, p.zoom + 0.25) }))} />
    </View>
    <View style={styles.bar}>
      <Action title="←" disabled={busy} onPress={() => setPosition(p => ({ ...p, x: clamp(p.x + 0.1, 0, 1) }))} />
      <Action title="↑" disabled={busy} onPress={() => setPosition(p => ({ ...p, y: clamp(p.y + 0.1, 0, 1) }))} />
      <Action title="↓" disabled={busy} onPress={() => setPosition(p => ({ ...p, y: clamp(p.y - 0.1, 0, 1) }))} />
      <Action title="→" disabled={busy} onPress={() => setPosition(p => ({ ...p, x: clamp(p.x - 0.1, 0, 1) }))} />
    </View>
    <Action title="Reset framing" disabled={busy} onPress={() => setPosition({ x: 0.5, y: 0.5, zoom: 1 })} />
    <Action title={busy ? 'Saving crop…' : 'Use as cover'} disabled={!size || busy} onPress={save} />
    <Action title="Cancel" disabled={busy} onPress={onCancel} />
  </ScrollView>;
}
const styles = StyleSheet.create({
  heading: { color: colors.text, fontSize: 17, fontWeight: '800' },
  help: { color: colors.muted, fontSize: 13, lineHeight: 20, marginVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  cell: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  handle: { height: 44, justifyContent: 'center', alignItems: 'center' },
  handleText: { color: colors.muted, fontWeight: '600', fontSize: 12 },
  tag: { position: 'absolute', top: 5, left: 5, backgroundColor: '#000b', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 4 },
  tagText: { color: '#fff', fontWeight: '800', fontSize: 10 },
  modal: { flex: 1, backgroundColor: colors.bg },
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  action: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.card, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  actionText: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
