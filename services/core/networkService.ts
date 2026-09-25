import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { create } from "zustand";

export interface NetworkStatus {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string | null;
}

interface NetworkStoreState extends NetworkStatus {
  setNetworkState: (status: Partial<NetworkStatus>) => void;
}

export const useNetworkStore = create<NetworkStoreState>((set) => ({
  isConnected: true,
  isInternetReachable: true,
  type: null,
  setNetworkState: (status) => set((prev) => ({ ...prev, ...status })),
}));

let currentNetworkStatus: NetworkStatus = {
  isConnected: true,
  isInternetReachable: true,
  type: null,
};

const listeners = new Set<(status: NetworkStatus) => void>();

// Subscribe to NetInfo native updates
NetInfo.addEventListener((state: NetInfoState) => {
  const newStatus: NetworkStatus = {
    isConnected: state.isConnected ?? false,
    isInternetReachable: state.isInternetReachable ?? false,
    type: state.type,
  };

  currentNetworkStatus = newStatus;
  useNetworkStore.getState().setNetworkState(newStatus);

  listeners.forEach((listener) => {
    try {
      listener(newStatus);
    } catch (e) {
      console.error("[networkService] Listener error:", e);
    }
  });
});

export const networkService = {
  /**
   * Synchronous check to see if the internet is reachable
   */
  isInternetReachable(): boolean {
    return Boolean(currentNetworkStatus.isInternetReachable);
  },

  /**
   * Synchronous check to see if network interface is connected
   */
  isConnected(): boolean {
    return Boolean(currentNetworkStatus.isConnected);
  },

  /**
   * Get the current snapshot of network status
   */
  getStatus(): NetworkStatus {
    return { ...currentNetworkStatus };
  },

  /**
   * Asynchronously fetch the freshest network status from native module
   */
  async refresh(): Promise<NetworkStatus> {
    try {
      const state = await NetInfo.fetch();
      const status: NetworkStatus = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? false,
        type: state.type,
      };
      currentNetworkStatus = status;
      useNetworkStore.getState().setNetworkState(status);
      return status;
    } catch (e) {
      console.error("[networkService] Failed to fetch NetInfo:", e);
      return currentNetworkStatus;
    }
  },

  /**
   * Register a callback triggered whenever network status changes
   */
  subscribe(callback: (status: NetworkStatus) => void): () => void {
    listeners.add(callback);
    return () => {
      listeners.delete(callback);
    };
  },
};
