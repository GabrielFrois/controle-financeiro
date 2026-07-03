import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

export interface FamilyMember {
  id: number;
  name: string;
  color: string;
}

export interface Family {
  id: number;
  name: string;
  members: FamilyMember[];
}

type ViewMode = 'personal' | number;

interface FamilyContextType {
  families: Family[];
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  activeUserIds: number[];
  activeLabel: string;
  reload: () => void;
}

const FamilyContext = createContext<FamilyContextType | null>(null);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [families, setFamilies] = useState<Family[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('personal');

  const reload = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await api.get<Family[]>('/families/my');
      setFamilies(data);
    } catch {
      setFamilies([]);
    }
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  const activeUserIds: number[] = (() => {
    if (viewMode === 'personal') return user ? [user.id] : [];
    const fam = families.find((f) => f.id === viewMode);
    return fam ? fam.members.map((m) => m.id) : user ? [user.id] : [];
  })();

  const activeLabel: string = (() => {
    if (viewMode === 'personal') return 'Só eu';
    const fam = families.find((f) => f.id === viewMode);
    return fam ? fam.name : 'Só eu';
  })();

  return (
    <FamilyContext.Provider value={{ families, viewMode, setViewMode, activeUserIds, activeLabel, reload }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily deve ser usado dentro de FamilyProvider');
  return ctx;
}