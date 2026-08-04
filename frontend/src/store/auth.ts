import { create } from "zustand";
import type { TokenResponse, User } from "../types";
import { api, clearToken, getToken, setToken } from "../api/client";

interface AuthState {
  user: User | null;
  token: string | null;
  loaded: boolean;
  setAuth: (data: TokenResponse) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: getToken(),
  loaded: false,
  setAuth: (data) => {
    setToken(data.token);
    set({ user: data.user, token: data.token });
  },
  logout: () => {
    clearToken();
    set({ user: null, token: null });
  },
  hydrate: async () => {
    if (!getToken()) {
      set({ loaded: true });
      return;
    }
    try {
      const data = await api.get<TokenResponse>("/auth/me");
      set({ user: data.user, token: getToken(), loaded: true });
    } catch {
      clearToken();
      set({ user: null, token: null, loaded: true });
    }
  },
  setUser: (user) => set({ user }),
}));
