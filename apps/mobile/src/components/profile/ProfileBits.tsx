/**
 * Small building blocks shared by the sighting, animal and person profiles:
 * an initials avatar (people's photos are never collected), a horizontal
 * photo strip with signed URLs, and a two-column stat grid.
 */
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, View } from 'react-native';
import { resolveAnimalPhotoUrl } from '../../services/storageService';
import { Text, useTheme } from '../../ui';

const TINTS = [
  ['#E6EEFB', '#2B4E9E'],
  ['#FDF1EA', '#9A3412'],
  ['#E9FAD6', '#144513'],
  ['#FBF1DD', '#7A4E00'],
  ['#F3E8FD', '#6B21A8'],
  ['#E0F5F2', '#0F5F55'],
  ['#FDE8EF', '#9D174D'],
  ['#ECEEF1', '#3A3F47'],
];

export function initials(name: string | null | undefined) {
  const parts = (name || '?').trim().split(/\s+/);
  return (
    (parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
}

/** Stable tint per account plus initials; the same colours as the research portal. */
export function Avatar({
  id,
  name,
  size = 44,
}: {
  id: string;
  name: string | null | undefined;
  size?: number;
}) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const [bg, fg] = TINTS[Math.abs(h) % TINTS.length];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        weight="600"
        style={{
          color: fg,
          fontSize: Math.round(size * 0.38),
          lineHeight: Math.round(size * 0.46),
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}

function SignedImage({ path, size, label }: { path: string; size: number; label: string }) {
  const { c, radius } = useTheme();
  const [url, setUrl] = useState('');
  useEffect(() => {
    let live = true;
    resolveAnimalPhotoUrl(path).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [path]);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.lg,
        backgroundColor: c.fill,
        overflow: 'hidden',
      }}
    >
      {url ? (
        <Image
          source={{ uri: url }}
          style={{ width: size, height: size }}
          accessibilityLabel={label}
        />
      ) : null}
    </View>
  );
}

/** Horizontal strip of photos (storage paths), first one larger. */
export function PhotoStrip({ paths, label }: { paths: string[]; label: (i: number) => string }) {
  if (!paths.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
      style={{ marginHorizontal: -20 }}
    >
      <View style={{ width: 10 }} />
      {paths.map((p, i) => (
        <SignedImage key={`${p}-${i}`} path={p} size={i === 0 ? 220 : 140} label={label(i)} />
      ))}
      <View style={{ width: 10 }} />
    </ScrollView>
  );
}

/** Two-column grid of big numbers with labels. */
export function StatGrid({ items }: { items: { value: string; label: string }[] }) {
  const { c, radius } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {items.map((it) => (
        <View
          key={it.label}
          accessible
          accessibilityLabel={`${it.value} ${it.label}`}
          style={{
            flexBasis: '47%',
            flexGrow: 1,
            backgroundColor: c.surface,
            borderRadius: radius.lg,
            padding: 14,
            gap: 2,
          }}
        >
          <Text variant="title2" tabular numberOfLines={1}>
            {it.value}
          </Text>
          <Text variant="footnote" tone="ink2" numberOfLines={2}>
            {it.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
