import React, { createContext, useContext, useState } from 'react';

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

type UserContextType = {
  user: LoggedInUser | null;
  setUser: (u: LoggedInUser) => void;
  visitedPlaces: VisitedPlace[];
  markVisited: (place: VisitedPlace) => void;
  removeVisited: (id: string) => void;
  isVisited: (id: string) => boolean;
};

const UserContext = createContext<UserContextType>({
  user: null,
  setUser: () => {},
  visitedPlaces: [],
  markVisited: () => {},
  removeVisited: () => {},
  isVisited: () => false,
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LoggedInUser | null>(null);
  const [visitedPlaces, setVisitedPlaces] = useState<VisitedPlace[]>([]);

  const markVisited = (place: VisitedPlace) => {
    setVisitedPlaces((prev) =>
      prev.find((p) => p.id === place.id) ? prev : [...prev, place]
    );
  };

  const removeVisited = (id: string) => {
    setVisitedPlaces((prev) => prev.filter((p) => p.id !== id));
  };

  const isVisited = (id: string) => visitedPlaces.some((p) => p.id === id);

  return (
    <UserContext.Provider value={{ user, setUser, visitedPlaces, markVisited, removeVisited, isVisited }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

