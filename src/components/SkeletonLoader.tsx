import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { theme } from '../theme';

interface SkeletonBoxProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonBoxProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as any, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function PostCardSkeleton() {
  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <SkeletonBox width={44} height={44} borderRadius={22} />
        <View style={styles.headerText}>
          <SkeletonBox width={120} height={14} />
          <SkeletonBox width={80} height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      {/* Image */}
      <SkeletonBox width="100%" height={280} borderRadius={0} style={{ marginVertical: 10 }} />
      {/* Caption */}
      <View style={{ paddingHorizontal: 16 }}>
        <SkeletonBox width="90%" height={14} />
        <SkeletonBox width="70%" height={14} style={{ marginTop: 8 }} />
        {/* Actions */}
        <View style={styles.actions}>
          <SkeletonBox width={48} height={24} borderRadius={12} />
          <SkeletonBox width={48} height={24} borderRadius={12} />
          <SkeletonBox width={48} height={24} borderRadius={12} />
        </View>
      </View>
    </View>
  );
}

export function PlaceCardSkeleton() {
  return (
    <View style={styles.placeCard}>
      <SkeletonBox width="100%" height={160} borderRadius={16} />
      <SkeletonBox width="70%" height={14} style={{ marginTop: 10 }} />
      <SkeletonBox width="50%" height={12} style={{ marginTop: 6 }} />
    </View>
  );
}

export function UserRowSkeleton() {
  return (
    <View style={styles.userRow}>
      <SkeletonBox width={48} height={48} borderRadius={24} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <SkeletonBox width={120} height={14} />
        <SkeletonBox width={80} height={12} style={{ marginTop: 6 }} />
      </View>
      <SkeletonBox width={72} height={30} borderRadius={15} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: theme.colors.surface,
  },
  card: {
    backgroundColor: theme.colors.background,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  headerText: { flex: 1 },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  placeCard: {
    width: 160,
    marginRight: 12,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
});
