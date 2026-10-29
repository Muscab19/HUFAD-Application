// src/hooks/useNetworkStatus.ts
import { useEffect, useRef, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

/**
 * Returns { isOnline, isConnected, isInternetReachable }.
 *
 * We treat "online" as: connected to a network AND (if known) the internet
 * is reachable. Weak WiFi still counts as online — the sync loop handles
 * failures by retrying on the next network event.
 */
export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const wasOnlineRef = useRef<boolean>(true);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      const connected = !!state.isConnected;
      const reachable =
        state.isInternetReachable === null
          ? connected
          : !!state.isInternetReachable;
      const next = connected && reachable;
      wasOnlineRef.current = isOnline;
      setIsOnline(next);
    });

    // Also hydrate initial state once
    NetInfo.fetch().then((state) => {
      const connected = !!state.isConnected;
      const reachable =
        state.isInternetReachable === null
          ? connected
          : !!state.isInternetReachable;
      setIsOnline(connected && reachable);
    });

    return () => unsub();
  }, []);

  return { isOnline };
};