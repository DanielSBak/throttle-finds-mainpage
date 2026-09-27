import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';

type Props = { uri: string; previewUri?: string; thumbnail?: boolean; style: StyleProp<ViewStyle>; accessibilityLabel?: string; onLoad?: () => void };
export function CachedPhoto(props: Props) {
  // A recycled inventory cell must not retain another car's loading/error state.
  return <Photo key={`${props.uri}:${props.previewUri}:${props.thumbnail}`} {...props} />;
}
function Photo({ uri, previewUri, thumbnail, style, accessibilityLabel, onLoad }: Props) {
  const [fallback, setFallback] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const source = thumbnail && previewUri && !fallback ? previewUri : uri;
  return <View style={[style, { overflow: 'hidden' }]}>
    {!thumbnail && !loaded && previewUri && <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill}
      contentFit="contain" cachePolicy="memory-disk" transition={0} />}
    {!failed && <Image key={attempt} source={{ uri: source }} recyclingKey={source} style={StyleSheet.absoluteFill}
      contentFit="contain" cachePolicy="memory-disk" transition={0} allowDownscaling={!!thumbnail}
      accessibilityLabel={accessibilityLabel} priority={thumbnail ? 'normal' : 'high'}
      onLoad={() => { setLoaded(true); onLoad?.(); }}
      onError={() => { if (source !== uri) setFallback(true); else setFailed(true); }} />}
    {failed && <Pressable accessibilityRole="button" accessibilityLabel="Retry loading photo" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', minHeight: 44 }]}
      onPress={() => { setFailed(false); setAttempt(n => n + 1); }}>
      <Text style={{ color: '#b8bec7', fontSize: 12 }}>Tap to retry</Text>
    </Pressable>}
  </View>;
}
