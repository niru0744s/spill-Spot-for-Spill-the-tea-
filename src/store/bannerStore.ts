/**
 * store/bannerStore.ts
 * --------------------
 * Zustand store to manage global state for the in-app notification banner.
 * Allows triggering sliding banner notifications from anywhere (e.g. background sync listener)
 * and rendering them at the root stack level.
 */

import { create } from 'zustand';

interface BannerState {
  visible: boolean;
  title: string;
  message: string;
  photoURL: string | null;
  onPress: (() => void) | null;
}

interface BannerActions {
  showBanner: (title: string, message: string, photoURL: string | null, onPress: () => void) => void;
  hideBanner: () => void;
}

const initialState: BannerState = {
  visible: false,
  title: '',
  message: '',
  photoURL: null,
  onPress: null,
};

export const useBannerStore = create<BannerState & BannerActions>((set) => ({
  ...initialState,

  showBanner: (title, message, photoURL, onPress) => {
    set({
      visible: true,
      title,
      message,
      photoURL,
      onPress,
    });
  },

  hideBanner: () => {
    set({ visible: false });
  },
}));
