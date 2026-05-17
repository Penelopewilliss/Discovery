import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type LoggedInUser = {
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
  setUser: (u: LoggedInUser) => void;
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
};

const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
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
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [visitedPlaces, setVisitedPlaces] = useState<VisitedPlace[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [mapPins, setMapPins] = useState<MapPin[]>([]);
  const [tripStories, setTripStories] = useState<TripStory[]>([]);

  // Load persisted map pins on mount
  useEffect(() => {
    AsyncStorage.getItem('mapPins').then((raw) => {
      if (raw) setMapPins(JSON.parse(raw));
    });
  }, []);

  const savePins = (pins: MapPin[]) => {
    setMapPins(pins);
    AsyncStorage.setItem('mapPins', JSON.stringify(pins));
  };

  const markVisited = (place: VisitedPlace) => {
    setVisitedPlaces((prev) =>
      prev.find((p) => p.id === place.id) ? prev : [...prev, place]
    );
  };

  const removeVisited = (id: string) => {
    setVisitedPlaces((prev) => prev.filter((p) => p.id !== id));
  };

  const isVisited = (id: string) => visitedPlaces.some((p) => p.id === id);

  const createTrip = (trip: Trip) => setTrips((prev) => [trip, ...prev]);
  const deleteTrip = (id: string) => setTrips((prev) => prev.filter((t) => t.id !== id));

  const addMapPin = (pin: MapPin) => savePins([...mapPins, pin]);
  const updateMapPin = (id: string, label: string, note: string) =>
    savePins(mapPins.map((p) => (p.id === id ? { ...p, label, note } : p)));
  const deleteMapPin = (id: string) => savePins(mapPins.filter((p) => p.id !== id));

  const addTripStory = (s: TripStory) => setTripStories((prev) => [s, ...prev]);

  return (
    <UserContext.Provider value={{
      user, setUser,
      visitedPlaces, markVisited, removeVisited, isVisited,
      trips, createTrip, deleteTrip,
      mapPins, addMapPin, updateMapPin, deleteMapPin,
      tripStories, addTripStory,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

