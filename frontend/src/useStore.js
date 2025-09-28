import { create } from "zustand";

const saved = (() => {
  try {
    return JSON.parse(localStorage.getItem("auth") || "null");
  } catch {
    return null;
  }
})();

export const useStore = create((set, get) => ({
  token: saved?.token || null,
  user: saved?.user || null,

  setAuth: (token, user) => {
    const state = { token, user };
    localStorage.setItem("auth", JSON.stringify(state));
    set(state);
  },

  logout: () => {
    localStorage.removeItem("auth");
    set({ token: null, user: null });
  },
}));
