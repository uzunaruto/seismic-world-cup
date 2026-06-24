'use client';

import { useEffect, useState } from 'react';

export interface SessionUser {
  discord_id: string;
  username: string;
  global_name: string | null;
  pfp_url: string;
  magnitude: number | null;
  is_default_avatar: boolean;
}

const STORAGE_KEY = 'swc_user';

interface SessionState {
  user: SessionUser | null;
  loading: boolean;
  backendReady: boolean;
  saveSession: (u: SessionUser) => void;
  clearSession: () => void;
}

export function useSession(): SessionState {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [backendReady, setBackendReady] = useState(true);

  // 1. Read cached user from localStorage immediately (sync, no flicker)
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        setUser(JSON.parse(cached));
      }
    } catch {
      // localStorage may be unavailable (private mode, SSR)
    }
    setLoading(false);
  }, []);

  // 2. Refresh from API in the background to sync with server state
  useEffect(() => {
    fetch('/api/auth/discord/session', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.backend_ready === false) {
          // Backend not configured yet - keep localStorage user if any
          setBackendReady(false);
          return;
        }
        if (d.user) {
          setUser(d.user);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(d.user));
          } catch {}
        } else {
          // Server says logged out - clear cached
          setUser(null);
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {}
        }
      })
      .catch(() => {
        // Network error - leave localStorage as-is
      });
  }, []);

  const saveSession = (u: SessionUser) => {
    setUser(u);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    } catch {}
  };

  const clearSession = () => {
    setUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return { user, loading, backendReady, saveSession, clearSession };
}