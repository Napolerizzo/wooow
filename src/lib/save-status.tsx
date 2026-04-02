'use client';

import { createContext, useContext, useState, useCallback, useRef } from 'react';

export type SaveStatus = 'idle' | 'pending' | 'saved' | 'error';

interface SaveStatusCtx {
  status: SaveStatus;
  setStatus: (s: SaveStatus) => void;
}

const SaveStatusContext = createContext<SaveStatusCtx>({
  status: 'idle',
  setStatus: () => {},
});

export function SaveStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setRaw] = useState<SaveStatus>('idle');
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStatus = useCallback((s: SaveStatus) => {
    setRaw(s);
    if (clearTimer.current) clearTimeout(clearTimer.current);
    if (s === 'saved') {
      clearTimer.current = setTimeout(() => setRaw('idle'), 2200);
    }
  }, []);

  return (
    <SaveStatusContext.Provider value={{ status, setStatus }}>
      {children}
    </SaveStatusContext.Provider>
  );
}

export function useSaveStatus() {
  return useContext(SaveStatusContext);
}
