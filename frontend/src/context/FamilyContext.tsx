import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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

  // Recalcula (e só recalcula) quando viewMode/families/user de fato mudam.
  // Antes, esses arrays/objetos eram recriados em TODO re-render do
  // FamilyProvider — inclusive quando o re-render vinha de algo alheio à
  // família, como o toggle de tema no topo da árvore. Como a nova
  // referência entrava no array de dependências dos useEffect que buscam
  // transações/investimentos/orçamentos, isso disparava um refetch
  // completo dos dados a cada troca de tema, dando a sensação de reload.
  const activeUserIds: number[] = useMemo(() => {
    if (viewMode === 'personal') return user ? [user.id] : [];
    const fam = families.find((f) => f.id === viewMode);
    return fam ? fam.members.map((m) => m.id) : user ? [user.id] : [];
  }, [viewMode, families, user]);

  const activeLabel: string = useMemo(() => {
    if (viewMode === 'personal') return 'Só eu';
    const fam = families.find((f) => f.id === viewMode);
    return fam ? fam.name : 'Só eu';
  }, [viewMode, families]);

  const value = useMemo(
    () => ({ families, viewMode, setViewMode, activeUserIds, activeLabel, reload }),
    [families, viewMode, activeUserIds, activeLabel, reload]
  );

  return (
    <FamilyContext.Provider value={value}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily deve ser usado dentro de FamilyProvider');
  return ctx;
}