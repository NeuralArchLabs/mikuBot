import React, { useEffect } from 'react';
import { THEMES } from '../../constants/themes';
import { useUIStore } from '../../stores/useUIStore';

interface ThemeManagerProps {
  theme?: string;
  chatFont?: string;
}

/**
 * ThemeManager
 * Injects CSS variables into the document root based on the selected theme and preferences.
 */
export const ThemeManager: React.FC<ThemeManagerProps> = ({ theme = 'miku', chatFont = 'Outfit' }) => {
  const isOverlayActive = useUIStore((state) => state.isOverlayActive);

  useEffect(() => {
    const selectedTheme = THEMES[theme] || THEMES.miku;
    const root = document.documentElement;

    // Apply color variables
    Object.entries(selectedTheme).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    // Apply font variables
    let fallbacks = 'sans-serif';
    const serifFonts = ['Playfair Display', 'Lora', 'Merriweather'];
    const monoFonts = ['JetBrains Mono', 'Fira Code'];
    const cursiveFonts = ['Sacramento', 'Architects Daughter'];
    
    if (serifFonts.includes(chatFont)) fallbacks = 'serif';
    else if (monoFonts.includes(chatFont)) fallbacks = 'monospace';
    else if (cursiveFonts.includes(chatFont)) fallbacks = 'cursive';

    root.style.setProperty('--chat-font', chatFont === 'Outfit' ? "'Outfit', sans-serif" : `'${chatFont}', ${fallbacks}`);
    
    // Add a class for specific theme targeting if needed
    document.body.className = `theme-${theme}`;

    // Update native window controls color (Windows only)
    if ((window as any).electron?.updateTitleBar && (window as any).electron?.platform === 'win32') {
      if (isOverlayActive) {
        // Hide native buttons by making them transparent when an overlay is active
        (window as any).electron.updateTitleBar({
          color: '#00000000',
          symbolColor: '#00000000',
          height: 35
        });
      } else {
        // Standard theme-based colors
        (window as any).electron.updateTitleBar({
          color: selectedTheme['--background-color'],
          symbolColor: theme === 'cloud' ? '#334155' : selectedTheme['--text-secondary'],
          height: 35
        });
      }
    }

  }, [theme, chatFont, isOverlayActive]);

  return null; // This component doesn't render anything UI-wise
};
