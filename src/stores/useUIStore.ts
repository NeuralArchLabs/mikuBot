import { create } from 'zustand';

interface UIState {
    activeOverlays: Set<string>;
    isOverlayActive: boolean;
    setOverlayActive: (id: string, active: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
    activeOverlays: new Set<string>(),
    isOverlayActive: false,
    setOverlayActive: (id, active) => set((state) => {
        const newOverlays = new Set(state.activeOverlays);
        if (active) {
            newOverlays.add(id);
        } else {
            newOverlays.delete(id);
        }
        return {
            activeOverlays: newOverlays,
            isOverlayActive: newOverlays.size > 0
        };
    }),
}));
