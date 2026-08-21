import { create } from 'zustand';
import { MetaPixel } from '@/core/analytics/metaPixel';
import { emptyUser, type AppUser } from '@/data/models';

interface UserState {
  user: AppUser;
  setUser: (user: AppUser) => void;
  setCoins: (coins: number) => void;
  spend: (amount: number) => void;
  earn: (amount: number) => void;
}

/** Holds the current authenticated user. Port of UserProvider. */
export const useUserStore = create<UserState>((set, get) => ({
  user: emptyUser,

  setUser: (user) => {
    // Badges are entirely server-driven with no dedicated "just earned"
    // signal of their own — this is the one place every page's user refresh
    // funnels through, so it's the only reliable spot to diff old vs new
    // state and catch the exact moment one flips from locked to earned.
    const previouslyEarned = new Set(
      get().user.badges.filter((b) => b.earned).map((b) => b.type),
    );
    for (const badge of user.badges) {
      if (badge.earned && !previouslyEarned.has(badge.type)) {
        MetaPixel.logUnlockedAchievement();
      }
    }
    set({ user });
  },

  setCoins: (coins) => set((s) => ({ user: { ...s.user, coins } })),
  spend: (amount) => set((s) => ({ user: { ...s.user, coins: s.user.coins - amount } })),
  earn: (amount) => set((s) => ({ user: { ...s.user, coins: s.user.coins + amount } })),
}));
