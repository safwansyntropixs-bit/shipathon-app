import { create } from "zustand";
import { friendService, FriendProfile, FriendRequest } from "@/services/social/friendService";
import { formatUserErrorMessage } from "@/utils/errorUtils";
import { useNotificationStore } from "../notifications/notificationStore";

interface FriendState {
  friends: FriendProfile[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  searchResults: FriendProfile[];
  isLoading: boolean;
  isSearching: boolean;
  error: string | null;

  loadFriends: (userId: string) => Promise<void>;
  loadRequests: (userId: string) => Promise<void>;
  searchUsers: (query: string, currentUserId: string) => Promise<void>;
  clearSearch: () => void;
  sendRequest: (senderId: string, receiverId: string) => Promise<void>;
  acceptRequest: (requestId: string, senderId: string, receiverId: string) => Promise<void>;
  rejectRequest: (requestId: string, currentUserId: string) => Promise<void>;
  removeFriend: (userId: string, friendId: string) => Promise<void>;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  incomingRequests: [],
  outgoingRequests: [],
  searchResults: [],
  isLoading: false,
  isSearching: false,
  error: null,

  loadFriends: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const friends = await friendService.getFriends(userId);
      set({ friends, isLoading: false, error: null });
    } catch (error: any) {
      set({ error: formatUserErrorMessage(error, "Could not load friends list."), isLoading: false });
    }
  },

  loadRequests: async (userId: string) => {
    set({ isLoading: true, error: null });
    try {
      const reqs = await friendService.getPendingRequests(userId);
      set({ incomingRequests: reqs.incoming, outgoingRequests: reqs.outgoing, isLoading: false, error: null });
    } catch (error: any) {
      set({ error: formatUserErrorMessage(error, "Could not load friend requests."), isLoading: false });
    }
  },

  searchUsers: async (query: string, currentUserId: string) => {
    if (!query || query.length < 2) {
      set({ searchResults: [] });
      return;
    }
    set({ isSearching: true, error: null });
    try {
      const results = await friendService.searchUsers(query, currentUserId);
      const { friends } = get();
      const friendIds = new Set(friends.map(f => f.id));
      const filtered = results.filter(r => !friendIds.has(r.id));
      set({ searchResults: filtered, isSearching: false, error: null });
    } catch (error: any) {
      set({ error: formatUserErrorMessage(error, "Could not search users."), isSearching: false });
    }
  },
  
  clearSearch: () => {
    set({ searchResults: [], isSearching: false, error: null });
  },

  sendRequest: async (senderId: string, receiverId: string) => {
    try {
      const result = await friendService.sendFriendRequest(senderId, receiverId);
      if (result && result.autoAccepted) {
        // It was a mutual request, so they are now friends!
        await Promise.all([
          get().loadFriends(senderId),
          get().loadRequests(senderId)
        ]);
      } else {
        await get().loadRequests(senderId);
      }
    } catch (error: any) {
      set({ error: formatUserErrorMessage(error, "Could not send friend request.") });
    }
  },

  acceptRequest: async (requestId: string, senderId: string, receiverId: string) => {
    try {
      await friendService.acceptRequest(requestId, senderId, receiverId);
      await Promise.all([
        get().loadFriends(receiverId),
        get().loadRequests(receiverId)
      ]);
    } catch (error: any) {
      set({ error: formatUserErrorMessage(error, "Could not accept friend request.") });
    }
  },

  rejectRequest: async (requestId: string, currentUserId: string) => {
    // Optimistic Update: instantly remove the request card without loading spinner
    set((state) => ({
      incomingRequests: state.incomingRequests.filter(r => r.id !== requestId),
      outgoingRequests: state.outgoingRequests.filter(r => r.id !== requestId)
    }));

    try {
      await friendService.rejectRequest(requestId);
    } catch (error: any) {
      console.error("Reject request failed", error);
      // If it fails on backend, reload the real state
      await get().loadRequests(currentUserId);
    }
  },

  removeFriend: async (userId: string, friendId: string) => {
    // Optimistic Update
    set((state) => ({
      friends: state.friends.filter(f => f.id !== friendId)
    }));
    try {
      await friendService.removeFriend(userId, friendId);
    } catch (error: any) {
      console.error("Remove friend failed", error);
      await get().loadFriends(userId);
    }
  }
}));
