import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export type LoggedInUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUri: string | null;
  bio: string;
  homeCountry: string;
  interests: string[];
};

export type VisitedPlace = {
  id: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  coverImage: string;
  visitedAt: string;
};

export type TripStop = {
  name: string;
  country: string;
  lat: number;
  lon: number;
};

export type Trip = {
  id: string;
  name: string;
  stops: TripStop[];
  createdAt: string;
};

export type MapPin = {
  id: string;
  lat: number;
  lon: number;
  label: string;
  note: string;
  createdAt: string;
};

export type LiveTripPin = {
  id: string;
  latitude: number;
  longitude: number;
  photoUri?: string;        // optional photo attached to this stop
  note: string;
  placeName: string;        // user-typed place / landmark name
  timestamp: number;        // ms
  addToVisited?: 'now' | 'end' | 'no'; // when to add this stop to visited places
};

export type LiveTrip = {
  id: string;
  name: string;
  startedAt: number;        // ms
  pins: LiveTripPin[];
  privacy: 'public' | 'followers' | 'close-friends';
  status: 'active' | 'paused';
};

export type CompletedLiveTrip = LiveTrip & { endedAt: number; source?: 'live' | 'manual' };

export type TripStory = {
  id: string;
  username: string;
  avatar: string | null;
  bgImage: string;       // travel bg or static map URL
  mapIncluded?: boolean; // true = bgImage is the static map
  tripName: string;
  stops: string[];
  caption: string;
  createdAt: number; // ms timestamp
};

type UserContextType = {
  user: LoggedInUser | null;
  setUser: (u: LoggedInUser | null) => void;
  authLoading: boolean;
  visitedPlaces: VisitedPlace[];
  markVisited: (place: VisitedPlace) => void;
  removeVisited: (id: string) => void;
  isVisited: (id: string) => boolean;
  trips: Trip[];
  createTrip: (trip: Trip) => void;
  deleteTrip: (id: string) => void;
  mapPins: MapPin[];
  addMapPin: (pin: MapPin) => void;
  updateMapPin: (id: string, label: string, note: string) => void;
  deleteMapPin: (id: string) => void;
  tripStories: TripStory[];
  addTripStory: (s: TripStory) => void;
  activeLiveTrip: LiveTrip | null;
  startLiveTrip: (name: string, privacy: LiveTrip['privacy']) => void;
  addLiveTripPin: (pin: LiveTripPin) => void;
  pauseLiveTrip: () => void;
  resumeLiveTrip: () => void;
  endLiveTrip: () => void;
  completedLiveTrips: CompletedLiveTrip[];
  deleteCompletedTrip: (id: string) => void;
  addManualTrip: (trip: CompletedLiveTrip) => void;
};

const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
  authLoading: true,
  visitedPlaces: [],
  markVisited: () => {},
  removeVisited: () => {},
  isVisited: () => false,
  trips: [],
  createTrip: () => {},
  deleteTrip: () => {},
  mapPins: [],
  addMapPin: () => {},
  updateMapPin: () => {},
  deleteMapPin: () => {},
  tripStories: [],
  addTripStory: () => {},
  activeLiveTrip: null,
  startLiveTrip: () => {},
  addLiveTripPin: () => {},
  pauseLiveTrip: () => {},
  resumeLiveTrip: () => {},
  endLiveTrip: () => {},
  completedLiveTrips: [],
  deleteCompletedTrip: () => {},
  addManualTrip: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [visitedPlaces, setVisitedPlaces] = useState<VisitedPlace[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [mapPins, setMapPins] = useState<MapPin[]>([]);
  const [tripStories, setTripStories] = useState<TripStory[]>([]);
  const [activeLiveTrip, setActiveLiveTrip] = useState<LiveTrip | null>(null);
  const [completedLiveTrips, setCompletedLiveTrips] = useState<CompletedLiveTrip[]>([]);

  // Firebase auth listener — auto login/logout
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (snap.exists()) {
          setUser(snap.data() as LoggedInUser);
        } else {
          // Firebase Auth session exists but no Firestore profile yet —
          // build a minimal user so the app stays functional
          setUser({
            id: firebaseUser.uid,
            name: firebaseUser.displayName ?? '',
            username: (firebaseUser.email ?? 'traveler').split('@')[0],
            email: firebaseUser.email ?? '',
            avatarUri: firebaseUser.photoURL ?? null,
            bio: '',
            homeCountry: '',
            interests: [],
          });
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, [];

  // Load persisted data on mount
  useEffect(() => {
    AsyncStorage.getItem('mapPins').then((raw) => {
      if (raw) setMapPins(JSON.parse(raw));
    });
    AsyncStorage.getItem('activeLiveTrip').then((raw) => {
      if (raw) setActiveLiveTrip(JSON.parse(raw));
    });
    AsyncStorage.getItem('visitedPlaces').then((raw) => {
      if (raw) setVisitedPlaces(JSON.parse(raw));
    });
    AsyncStorage.getItem('completedLiveTrips').then((raw) => {
      if (raw) setCompletedLiveTrips(JSON.parse(raw));
    });
  }, []);

  // Persist live trip whenever it changes
  useEffect(() => {
    if (activeLiveTrip) {
      AsyncStorage.setItem('activeLiveTrip', JSON.stringify(activeLiveTrip));
    } else {
      AsyncStorage.removeItem('activeLiveTrip');
    }
  }, [activeLiveTrip]);

  const savePins = (pins: MapPin[]) => {
    setMapPins(pins);
    AsyncStorage.setItem('mapPins', JSON.stringify(pins));
  };

  const markVisited = (place: VisitedPlace) => {
    setVisitedPlaces((prev) => {
      if (prev.find((p) => p.id === place.id)) return prev;
      const next = [...prev, place];
      AsyncStorage.setItem('visitedPlaces', JSON.stringify(next));
      return next;
    });
  };

  const removeVisited = (id: string) => {
    setVisitedPlaces((prev) => {
      const next = prev.filter((p) => p.id !== id);
      AsyncStorage.setItem('visitedPlaces', JSON.stringify(next));
      return next;
    });
  };

  const isVisited = (id: string) => visitedPlaces.some((p) => p.id === id);

  const createTrip = (trip: Trip) => setTrips((prev) => [trip, ...prev]);
  const deleteTrip = (id: string) => setTrips((prev) => prev.filter((t) => t.id !== id));

  const addMapPin = (pin: MapPin) => {
    savePins([...mapPins, pin]);
    // Auto-add to visited places when a pin is dropped
    const vp: VisitedPlace = {
      id: `pin_${pin.id}`,
      name: pin.label,
      country: '',          // pins don't carry country — shown as "Pinned location"
      lat: pin.lat,
      lon: pin.lon,
      coverImage: '',
      visitedAt: pin.createdAt,
    };
    setVisitedPlaces((prev) => {
      if (prev.find((p) => p.id === vp.id)) return prev;
      const next = [...prev, vp];
      AsyncStorage.setItem('visitedPlaces', JSON.stringify(next));
      return next;
    });
  };
  const updateMapPin = (id: string, label: string, note: string) =>
    savePins(mapPins.map((p) => (p.id === id ? { ...p, label, note } : p)));
  const deleteMapPin = (id: string) => savePins(mapPins.filter((p) => p.id !== id));

  const addTripStory = (s: TripStory) => setTripStories((prev) => [s, ...prev]);

  const startLiveTrip = (name: string, privacy: LiveTrip['privacy']) =>
    setActiveLiveTrip({ id: `live_${Date.now()}`, name, startedAt: Date.now(), pins: [], privacy, status: 'active' });

  const addLiveTripPin = (pin: LiveTripPin) =>
    setActiveLiveTrip((prev) => prev ? { ...prev, pins: [...prev.pins, pin] } : prev);

  const pauseLiveTrip = () =>
    setActiveLiveTrip((prev) => prev ? { ...prev, status: 'paused' } : prev);

  const resumeLiveTrip = () =>
    setActiveLiveTrip((prev) => prev ? { ...prev, status: 'active' } : prev);

  const endLiveTrip = () => {
    setActiveLiveTrip((prev) => {
      if (prev) {
        const completed: CompletedLiveTrip = { ...prev, endedAt: Date.now() };
        setCompletedLiveTrips((existing) => {
          const next = [completed, ...existing];
          AsyncStorage.setItem('completedLiveTrips', JSON.stringify(next));
          return next;
        });
      }
      return null;
    });
  };

  const deleteCompletedTrip = (id: string) => {
    setCompletedLiveTrips((prev) => {
      const next = prev.filter((t) => t.id !== id);
      AsyncStorage.setItem('completedLiveTrips', JSON.stringify(next));
      return next;
    });
  };

  const addManualTrip = (trip: CompletedLiveTrip) => {
    setCompletedLiveTrips((prev) => {
      const next = [trip, ...prev];
      AsyncStorage.setItem('completedLiveTrips', JSON.stringify(next));
      return next;
    });
  };

  return (
    <UserContext.Provider value={{
      user, setUser, authLoading,
      visitedPlaces, markVisited, removeVisited, isVisited,
      trips, createTrip, deleteTrip,
      mapPins, addMapPin, updateMapPin, deleteMapPin,
      tripStories, addTripStory,
      activeLiveTrip, startLiveTrip, addLiveTripPin, pauseLiveTrip, resumeLiveTrip, endLiveTrip,
      completedLiveTrips, deleteCompletedTrip, addManualTrip,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

