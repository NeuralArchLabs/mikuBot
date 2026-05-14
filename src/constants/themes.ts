/**
 * Theme Definitions
 * CSS variable mappings for each theme
 */

export interface ThemeColors {
  '--primary-color': string;
  '--secondary-color': string;
  '--background-color': string;
  '--surface-color': string;
  '--text-primary': string;
  '--text-secondary': string;
  '--accent-color': string;
  '--border-color': string;
  '--hover-color': string;
  '--sidebar-bg': string;
  '--sidebar-hover': string;
  '--glass-glow': string;
}

export const THEMES: Record<string, ThemeColors> = {
  miku: {
    '--primary-color': '#60a5fa', // Blue-400
    '--secondary-color': '#38bdf8', // Sky-400
    '--background-color': '#0f172a', // Slate-900
    '--surface-color': 'rgba(30, 41, 59, 0.7)', // Slate-800
    '--text-primary': '#f8fafc', // Slate-50
    '--text-secondary': '#94a3b8', // Slate-400
    '--accent-color': '#94a3b8', // Light Gray Emphasis
    '--border-color': 'rgba(51, 65, 85, 0.5)',
    '--hover-color': 'rgba(96, 165, 250, 0.1)',
    '--sidebar-bg': 'rgba(15, 23, 42, 0.8)',
    '--sidebar-hover': 'rgba(30, 41, 59, 0.5)',
    '--glass-glow': 'rgba(6, 182, 212, 0.15)',
  },
  midnight: {
    '--primary-color': '#94a3b8',
    '--secondary-color': '#64748b',
    '--background-color': '#020617', // Slate-950
    '--surface-color': 'rgba(15, 23, 42, 0.7)',
    '--text-primary': '#f8fafc',
    '--text-secondary': '#64748b',
    '--accent-color': '#94a3b8',
    '--border-color': 'rgba(30, 41, 59, 0.5)',
    '--hover-color': 'rgba(148, 163, 184, 0.1)',
    '--sidebar-bg': 'rgba(2, 6, 17, 0.9)',
    '--sidebar-hover': 'rgba(15, 23, 42, 0.6)',
    '--glass-glow': 'rgba(59, 130, 246, 0.15)',
  },
  cloud: {
    '--primary-color': '#2563eb', // Blue-600
    '--secondary-color': '#06b6d4', // Cyan-500 (Consistent with other accents)
    '--background-color': '#f8fafc', // Slate-50
    '--surface-color': 'rgba(255, 255, 255, 0.9)', 
    '--text-primary': '#334155', // Slate-700
    '--text-secondary': '#64748b', // Slate-500
    '--accent-color': '#94a3b8', // Light Gray (Slate-400)
    '--border-color': 'rgba(203, 213, 225, 1)', // Slate-200
    '--hover-color': 'rgba(37, 99, 235, 0.08)',
    '--sidebar-bg': 'rgba(241, 245, 249, 0.95)',
    '--sidebar-hover': 'rgba(226, 232, 240, 0.7)',
    '--glass-glow': 'rgba(6, 182, 212, 0.15)',
  },
  cyberpunk: {
    '--primary-color': '#d946ef', // Fuchsia-500
    '--secondary-color': '#facc15', // Yellow-400
    '--background-color': '#1a103d', // Deep Purple
    '--surface-color': 'rgba(45, 27, 105, 0.9)',
    '--text-primary': '#ffffff',
    '--text-secondary': '#22d3ee', // Cyan-400
    '--accent-color': '#22d3ee',
    '--border-color': 'rgba(217, 70, 239, 0.3)',
    '--hover-color': 'rgba(217, 70, 239, 0.1)',
    '--sidebar-bg': 'rgba(26, 16, 61, 0.8)',
    '--sidebar-hover': 'rgba(45, 27, 105, 0.5)',
    '--glass-glow': 'rgba(217, 70, 239, 0.2)',
  },
  forest: {
    '--primary-color': '#10b981', // Emerald-500
    '--secondary-color': '#84cc16', // Lime-500
    '--background-color': '#064e3b', // Emerald-900
    '--surface-color': 'rgba(6, 78, 59, 0.6)', 
    '--text-primary': '#ecfdf5',
    '--text-secondary': '#fbbf24', // Amber-400
    '--accent-color': '#fbbf24',
    '--border-color': 'rgba(16, 185, 129, 0.2)',
    '--hover-color': 'rgba(16, 185, 129, 0.1)',
    '--sidebar-bg': 'rgba(2, 44, 34, 0.85)',
    '--sidebar-hover': 'rgba(16, 185, 129, 0.1)',
    '--glass-glow': 'rgba(16, 185, 129, 0.2)',
  }
};
