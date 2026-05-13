import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Place } from '../types';
import { theme } from '../theme';
import { toggleFollowPlace } from '../data/mockData';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;

interface PlaceCardProps {
  place: Place;
  onUpdate: () => void;
}

export default function PlaceCard({ place, onUpdate }: PlaceCardProps) {
  const [followed, setFollowed] = useState(place.followed);
  const [followers, setFollowers] = useState(place.followersCount);

  const handleFollow = () => {
    toggleFollowPlace(place.id);
    setFollowers((prev) => (followed ? prev - 1 : prev + 1));
    setFollowed((prev) => !prev);
    onUpdate();
  };

  const formatFollowers = (n: number) => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  };

  return (
    <View style={[styles.card, { width: CARD_WIDTH }]}>
      <Image source={{ uri: place.coverImage }} style={styles.image} resizeMode="cover" />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.85)']}
        style={styles.gradient}
      />
      <View style={styles.content}>
        <Text style={styles.name}>{place.name}</Text>
        <Text style={styles.country}>{place.country}</Text>
        <View style={styles.footer}>
          <Text style={styles.followers}>👥 {formatFollowers(followers)}</Text>
          <TouchableOpacity
            onPress={handleFollow}
            style={[styles.followBtn, followed && styles.followBtnActive]}
          >
            <LinearGradient
              colors={followed ? [theme.colors.surface, theme.colors.surface] : theme.colors.gradientPrimary as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.followBtnGradient}
            >
              <Text style={[styles.followBtnText, followed && styles.followBtnTextActive]}>
                {followed ? 'Following' : 'Follow'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 200,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    marginRight: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: theme.spacing.md,
  },
  name: {
    color: theme.colors.text,
    ...theme.typography.h2,
  },
  country: {
    color: theme.colors.textSecondary,
    ...theme.typography.caption,
    marginBottom: theme.spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  followers: {
    color: theme.colors.textSecondary,
    ...theme.typography.caption,
  },
  followBtn: {
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  followBtnActive: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
  },
  followBtnGradient: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
  },
  followBtnText: {
    color: '#fff',
    ...theme.typography.caption,
    fontWeight: '700',
  },
  followBtnTextActive: {
    color: theme.colors.textMuted,
  },
});
