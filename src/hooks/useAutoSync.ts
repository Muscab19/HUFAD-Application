// src/hooks/useAutoSync.ts
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { api as apiClient } from '../api/client';
import {
  getPending,
  removeQueued,
  markFailed,
  QueueKind,
  initOfflineDb,
} from '../utils/offlineDb';
import { useNetworkStatus } from './useNetworkStatus';

// Module-level flags so multiple components don't fight each other
let isSyncing = false;
let hasRunInitial = false;

const syncKind = async (kind: QueueKind): Promise<void> => {
  const pending = await getPending(kind, 50);
  if (pending.length === 0) return;

  const endpoint =
    kind === 'attendance'
      ? '/teacher/attendance/bulk'
      : '/memorizations';

  for (const rec of pending) {
    try {
      // For attendance, the queue payload IS the full record body.
      // We append `clientId` so the server can upsert.
      const body =
        kind === 'attendance'
          ? rec.payload                 // { records, branchId, ... }
          : { ...rec.payload, clientId: rec.id };

      // Add clientId to every attendance record so the server can upsert
      if (kind === 'attendance' && Array.isArray(body.records)) {
        body.records = body.records.map((r: any) => ({
          ...r,
          clientId: r.clientId || rec.id,
        }));
      }

      await apiClient.post(endpoint, body);
      await removeQueued(kind, rec.id);
    } catch (err: any) {
      // Leave queued; bump retry count so we don't hammer on a bad row
      await markFailed(kind, rec.id, err?.message || 'unknown');
      // Break out — assume network is bad again; wait for next event
      break;
    }
  }
};

const runSync = async () => {
  if (isSyncing) return;
  isSyncing = true;
  try {
    await initOfflineDb();
    await syncKind('attendance');
    await syncKind('memorization');
  } catch (e) {
    console.warn('[autoSync] failed', e);
  } finally {
    isSyncing = false;
  }
};

/**
 * Call once from App root (or RoleNavigator). Silent — no UI.
 */
export const useAutoSync = () => {
  const { isOnline } = useNetworkStatus();
  const prevOnlineRef = useRef<boolean | null>(null);

  // Initial flush on mount
  useEffect(() => {
    if (hasRunInitial) return;
    hasRunInitial = true;
    if (isOnline) {
      // small delay so AuthContext restore finishes first
      const t = setTimeout(() => runSync(), 1500);
      return () => clearTimeout(t);
    }
  }, [isOnline]);

  // Trigger on offline → online transition
  useEffect(() => {
    const prev = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;
    if (prev === false && isOnline === true) {
      // small delay so the network is actually usable
      const t = setTimeout(() => runSync(), 1000);
      return () => clearTimeout(t);
    }
  }, [isOnline]);

  // Also try on foreground (user came back to the app)
  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (state === 'active' && isOnline) {
        setTimeout(() => runSync(), 800);
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [isOnline]);
};