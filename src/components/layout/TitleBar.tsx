import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../common/Common';
import { useTranslation } from 'react-i18next';
import { useUIStore } from '../../stores/useUIStore';

interface MenuOption {
    label?: string;
    action?: string;
    role?: string;
    icon?: string;
    separator?: boolean;
    submenu?: MenuOption[];
}

interface TitleBarProps {
    activeTab?: string;
}

export const TitleBar: React.FC<TitleBarProps> = ({ activeTab }) => {
    const { t } = useTranslation();
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const isOverlayActive = useUIStore((state) => state.isOverlayActive);

    const handleAction = (action?: string, role?: string) => {
        if (action) {
            (window as any).electron?.sendMenuAction(action);
        } else if (role) {
            (window as any).electron?.sendMenuRole(role);
        }
        setActiveMenu(null);
    };

    const menuItems: { [key: string]: { label: string, options: MenuOption[] } } = {
        'file': {
            label: t('titlebar.file'),
            options: [
                { label: t('titlebar.options.new_session'), action: 'new-session', icon: 'plus' },
                { separator: true },
                { label: t('titlebar.options.export_config'), action: 'export-config', icon: 'file-export' },
                { label: t('titlebar.options.load_config'), action: 'load-config', icon: 'file-import' },
                { separator: true },
                { label: t('titlebar.options.open_sessions'), action: 'open-sessions-folder', icon: 'folder-open' },
                { separator: true },
                { label: t('titlebar.options.exit'), action: 'exit', icon: 'power-off' }
            ]
        },
        'edit': {
            label: t('titlebar.edit'),
            options: [
                { label: t('titlebar.options.undo'), role: 'undo', icon: 'undo' },
                { label: t('titlebar.options.redo'), role: 'redo', icon: 'redo' },
                { separator: true },
                { label: t('titlebar.options.cut'), role: 'cut', icon: 'cut' },
                { label: t('titlebar.options.copy'), role: 'copy', icon: 'copy' },
                { label: t('titlebar.options.paste'), role: 'paste', icon: 'paste' },
                { separator: true },
                { label: t('titlebar.options.select_all'), role: 'selectAll', icon: 'mouse-pointer' }
            ]
        },
        'view': {
            label: t('titlebar.view'),
            options: [
                { label: t('titlebar.options.reload'), role: 'reload', icon: 'sync-alt' },
                { label: t('titlebar.options.force_reload'), role: 'force-reload', icon: 'redo-alt' },
                { label: t('titlebar.options.toggle_devtools'), role: 'toggle-devtools', icon: 'code' },
                { separator: true },
                { label: t('titlebar.options.toggle_fullscreen'), role: 'toggle-fullscreen', icon: 'expand' }
            ]
        },
        'engine': {
            label: t('titlebar.neural_engine'),
            options: [
                { label: t('titlebar.options.sync_models'), action: 'sync-models', icon: 'brain' },
                { separator: true },
                { label: t('titlebar.options.reset_config'), action: 'reset-config', icon: 'trash-alt' }
            ]
        },
        'help': {
            label: t('titlebar.help'),
            options: [
                { label: t('titlebar.options.documentation'), action: 'documentation', icon: 'book' },
                { label: t('titlebar.options.about'), action: 'about', icon: 'info-circle' }
            ]
        }
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenu(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className={`h-[35px] flex items-center px-4 select-none relative z-[100] shadow-[0_8px_40px_-2px_rgba(0,0,0,0.8)] shadow-black/60 app-region-drag transition-all duration-500 ${activeTab === 'chat' ? 'titlebar-active-chat' : 'titlebar-active-standard'} ${isOverlayActive ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} style={{ backgroundColor: 'var(--background-color)' }}>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--border-color)] via-[5%] to-transparent opacity-40" />

            {/* Menu Buttons */}
            <div ref={menuRef} className="flex h-full app-region-no-drag">
                {Object.entries(menuItems).map(([id, menu]) => (
                    <div key={id} className="relative h-full flex items-center">
                        <button
                            onClick={() => setActiveMenu(activeMenu === id ? null : id)}
                            onMouseEnter={() => activeMenu && setActiveMenu(id)}
                            className={`px-3 py-1 text-xs font-medium transition-all rounded-md mx-0.5 ${activeMenu === id
                                ? 'text-[var(--primary-color)] shadow-[0_0_15px_-3px_var(--primary-color)] scale-105'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                            style={{ backgroundColor: activeMenu === id ? 'var(--surface-color)' : 'transparent' }}
                        >
                            {menu.label}
                        </button>

                        {/* Dropdown Menu */}
                        {activeMenu === id && (
                            <div className="absolute top-[35px] left-0.5 backdrop-blur-xl border rounded-lg shadow-2xl py-2 min-w-[220px] z-[110] animate-in fade-in zoom-in duration-150 origin-top overflow-hidden"
                                style={{ backgroundColor: 'var(--surface-color)', borderColor: 'var(--border-color)' }}>
                                {menu.options.map((option, idx) => (
                                    option.separator ? (
                                        <div key={`sep-${idx}`} className="h-px bg-slate-700/50 my-1 mx-2" />
                                    ) : (
                                        <button
                                            key={option.label}
                                            onClick={() => handleAction(option.action, option.role)}
                                            className="w-full text-left px-5 py-2 text-xs transition-colors flex items-center justify-between group hover:bg-[var(--hover-color)]"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            <span className="group-hover:text-[var(--primary-color)] transition-colors">{option.label}</span>
                                            {option.submenu && <Icon name="chevron-right" className="text-[10px] opacity-50 group-hover:text-[var(--primary-color)]" />}
                                        </button>
                                    )
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Placeholder for center title (empty as per user request to remove it) */}
            <div className="flex-1 h-full" />

            {/* Spacer for native window controls (top right) */}
            <div className="w-[130px] h-full" />
        </div>
    );
};

