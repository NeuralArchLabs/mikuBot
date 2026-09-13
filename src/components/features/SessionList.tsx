import React from 'react';
import { createPortal } from 'react-dom';
import { ProjectMetadata, SessionMetadata } from '../../types';
import { Icon } from '../common/Common';
import { useTranslation } from 'react-i18next';
import { ProjectCreateOptions, ProjectList } from './ProjectList';

interface SessionListProps {
    sessions: SessionMetadata[];
    loading: boolean;
    currentSessionId: string | null;
    onSelect: (id: string) => void;
    onDelete: (id: string) => void;
    onNew: (projectId?: string | null) => void;
    onExport: (id: string) => void;
    onImport: () => void;
    onExpand?: () => void;
    isModal?: boolean;
    askConfirm: (msg: string, position?: 'left' | 'right' | 'center') => Promise<boolean>;
    hideList?: boolean;
    sessionViewMode?: 'sessions' | 'projects';
    onSessionViewChange?: (mode: 'sessions' | 'projects') => void;
    projects?: ProjectMetadata[];
    loadingProjects?: boolean;
    activeProjectId?: string | null;
    onSelectProject?: (id: string | null) => void;
    onCreateProject?: (options: ProjectCreateOptions) => Promise<ProjectMetadata | null>;
    onOpenProject?: (path: string) => void;
    onRemoveProject?: (id: string, deleteFolder: boolean) => Promise<boolean>;
}

export const SessionList = React.memo(({ sessions, loading, currentSessionId, onSelect, onDelete, onNew, onExport, onImport, onExpand, isModal, askConfirm, hideList, sessionViewMode = 'sessions', onSessionViewChange, projects = [], loadingProjects = false, activeProjectId = null, onSelectProject, onCreateProject, onOpenProject, onRemoveProject }: SessionListProps) => {
    const { t } = useTranslation();
    const isProjectsView = sessionViewMode === 'projects';
    const [projectCreateRequest, setProjectCreateRequest] = React.useState(0);
    const [projectImportRequest, setProjectImportRequest] = React.useState(0);
    const [sessionContextMenu, setSessionContextMenu] = React.useState<{ session: SessionMetadata; x: number; y: number } | null>(null);

    React.useEffect(() => {
        if (!sessionContextMenu) return;
        const closeContextMenu = () => setSessionContextMenu(null);
        window.addEventListener('click', closeContextMenu);
        window.addEventListener('contextmenu', closeContextMenu);
        window.addEventListener('scroll', closeContextMenu, true);
        return () => {
            window.removeEventListener('click', closeContextMenu);
            window.removeEventListener('contextmenu', closeContextMenu);
            window.removeEventListener('scroll', closeContextMenu, true);
        };
    }, [sessionContextMenu]);

    const handleSessionContextMenu = (event: React.MouseEvent, session: SessionMetadata) => {
        event.preventDefault();
        event.stopPropagation();
        setSessionContextMenu({ session, x: event.clientX, y: event.clientY });
    };

    const deleteSessionFromContextMenu = async () => {
        const session = sessionContextMenu?.session;
        setSessionContextMenu(null);
        if (session && await askConfirm(t('common.delete_session_confirm'), 'left')) onDelete(session.id);
    };

    const openSessionFromContextMenu = () => {
        const sessionId = sessionContextMenu?.session.id;
        setSessionContextMenu(null);
        if (sessionId) onSelect(sessionId);
    };

    const exportSessionFromContextMenu = () => {
        const sessionId = sessionContextMenu?.session.id;
        setSessionContextMenu(null);
        if (sessionId) onExport(sessionId);
    };

    return (
        <div className="flex flex-col h-full">
            {!isModal && (
                <div className={`${hideList ? 'mb-0' : 'mb-0'}`}>
                    <div className="h-px flex-none relative z-10 bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent mb-3 opacity-70" />
                    <div className="flex items-center justify-between gap-2 px-1">
                        <div className="flex items-center gap-2 min-w-0">
                            {onSessionViewChange && <button
                                type="button"
                                onClick={() => onSessionViewChange(isProjectsView ? 'sessions' : 'projects')}
                                className="flex items-center rounded-lg border border-[var(--border-color)]/60 bg-[var(--background-color)]/20 p-0.5 shrink-0 cursor-pointer hover:border-[var(--primary-color)]/50 transition-colors"
                                title={isProjectsView ? t('projects.sessions_view', { defaultValue: 'Cambiar a vista de sesiones' }) : t('projects.projects_view', { defaultValue: 'Cambiar a vista de proyectos' })}
                                aria-label={isProjectsView ? t('projects.sessions_view', { defaultValue: 'Cambiar a vista de sesiones' }) : t('projects.projects_view', { defaultValue: 'Cambiar a vista de proyectos' })}
                                aria-pressed={isProjectsView}
                            >
                                <span className={`w-6 h-5 rounded-md flex items-center justify-center transition-all ${!isProjectsView ? 'bg-[var(--hover-color)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'} hover:bg-blue-400/10 hover:text-blue-300`}><Icon name="history" className="text-[9px]" /></span>
                                <span className={`w-6 h-5 rounded-md flex items-center justify-center transition-all ${isProjectsView ? 'bg-[var(--hover-color)] text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'} hover:bg-amber-400/10 hover:text-amber-300`}><Icon name="folder" className="text-[9px]" /></span>
                            </button>}
                            {onExpand ? (
                                <button
                                    onClick={onExpand}
                                    className="text-[10px] font-extrabold text-[var(--text-secondary)] hover:text-[var(--primary-color)] uppercase tracking-[0.18em] flex items-center gap-1.5 transition-colors group cursor-pointer truncate"
                                    title={t('sidebar.tooltips.sessions')}
                                >
                                    {isProjectsView ? t('projects.title', { defaultValue: 'Proyectos' }) : t('sidebar.tooltips.sessions')}
                                </button>
                            ) : (
                                <label className="text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-[0.18em] truncate">
                                    {isProjectsView ? t('projects.title', { defaultValue: 'Proyectos' }) : t('sidebar.tooltips.sessions')}
                                </label>
                            )}
                        </div>
                        {!hideList && (
                             <div className="flex items-center gap-1.5">
                                {isProjectsView ? <>
                                    <button
                                        type="button"
                                        onClick={() => setProjectImportRequest(request => request + 1)}
                                        className="w-6 h-6 flex items-center justify-center text-[var(--text-secondary)] hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all"
                                        title={t('projects.import_project', { defaultValue: 'Importar carpeta' })}
                                        aria-label={t('projects.import_project', { defaultValue: 'Importar carpeta' })}
                                    >
                                        <Icon name="download" className="text-[10px]" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setProjectCreateRequest(request => request + 1)}
                                        className="w-6 h-6 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--primary-color)] hover:bg-[var(--primary-color)]/10 rounded-lg transition-all"
                                        title={t('projects.new_project', { defaultValue: 'Nuevo proyecto' })}
                                        aria-label={t('projects.new_project', { defaultValue: 'Nuevo proyecto' })}
                                    >
                                        <Icon name="plus" className="text-[10px]" />
                                    </button>
                                </> : <>
                                    <button
                                        type="button"
                                        onClick={onImport}
                                        className="w-6 h-6 flex items-center justify-center text-[var(--text-secondary)] hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-all"
                                        title="Import Session"
                                    >
                                        <Icon name="download" className="text-[10px]" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onNew()}
                                        className="w-6 h-6 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--primary-color)] hover:bg-[var(--primary-color)]/10 rounded-lg transition-all"
                                        title="New Session"
                                    >
                                        <Icon name="plus" className="text-[10px]" />
                                    </button>
                                </>}
                            </div>
                        )}
                    </div>
                    {!hideList && <div className="h-px flex-none relative z-10 bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent mt-3 mb-0 opacity-70" />}
                </div>
            )}

            {!hideList && (
                <div className={`flex-1 overflow-y-auto overflow-x-visible custom-scrollbar chat-fade-mask px-4 -mx-4 pt-0 ${isModal ? 'space-y-2' : 'space-y-1'} pb-0 mb-0`}>
                {isProjectsView ? (
                    <ProjectList
                        projects={projects}
                        sessions={sessions}
                        loading={loadingProjects || loading}
                        currentSessionId={currentSessionId}
                        selectedProjectId={activeProjectId}
                        onSelectProject={onSelectProject || (() => {})}
                        onCreateProject={onCreateProject || (async () => null)}
                        onOpenProject={onOpenProject || (() => {})}
                        onNewSession={(projectId) => onNew(projectId)}
                        onSelectSession={onSelect}
                        onDeleteSession={onDelete}
                        onExportSession={onExport}
                        askConfirm={askConfirm}
                        isModal={isModal}
                        createRequest={projectCreateRequest}
                        importRequest={projectImportRequest}
                        onRemoveProject={onRemoveProject || (async () => false)}
                    />
                ) : loading && sessions.length === 0 ? (
                    <div className="text-center py-4 text-[var(--text-secondary)] animate-pulse">
                        <Icon name="spinner" className="animate-spin mb-1" />
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--surface-color)]/30">
                        <p className={`${isModal ? 'text-sm' : 'text-[10px]'} text-[var(--text-secondary)]`}>{t('common.no_active_history')}</p>
                    </div>
                ) : (
                    <>
                        {/* Buffer to clear the top fade mask when fully scrolled (only in sidebar) */}
                        {!isModal && <div className="h-4 w-full flex-shrink-0" />}
                        {sessions.map(ss => {
                            const isActive = currentSessionId === ss.id;
                            const sessionProject = ss.projectId ? projects.find(project => project.id === ss.projectId) : undefined;
    
                            if (isModal) {
                                // 🪟 ORIGINAL WINDOW MODE LAYOUT (Modal)
                                return (
                                    <div
                                        key={ss.id}
                                        className={`group relative flex flex-col gap-1.5 rounded-xl p-4 transition-all duration-300 cursor-pointer border border-transparent ${isActive
                                            ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)] shadow-lg shadow-black/10 sunken-active'
                                            : 'text-[var(--text-secondary)] hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)]'
                                            } hover:border-[var(--primary-color)]/30 hover:shadow-[0_0_20px_-5px_var(--primary-color)]/20`}
                                        onClick={() => onSelect(ss.id)}
                                        onContextMenu={(event) => handleSessionContextMenu(event, ss)}
                                    >
                                        <div className="flex items-center gap-3 w-full">
                                            <div className={`w-2 h-2 rounded-full shrink-0 ${isActive ? 'bg-[var(--primary-color)] shadow-glow' : 'bg-[var(--border-color)]'}`} />
                                            <div className="text-sm font-medium truncate flex-1">{ss.title || t('common.untitled_session')}</div>
                                        </div>
    
                                        <div className="flex items-center justify-between gap-3 pl-5 w-full min-w-0">
                                            <div className="flex items-center gap-2 min-w-0 flex-1 text-[11px] text-[var(--text-secondary)] font-mono">
                                                <span className="shrink-0 whitespace-nowrap">{ss.messageCount} messages • {new Date(ss.createdAt || ss.lastModified).toLocaleDateString()}</span>
                                                {sessionProject && <span className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-1 text-[var(--text-secondary)] group-hover:text-amber-300 transition-colors" title={sessionProject.name}>
                                                    <span className="min-w-0 truncate text-right">{sessionProject.name}</span>
                                                    <Icon name="folder" className="mr-0.5 shrink-0" />
                                                </span>}
                                            </div>
    
                                            <div className="flex items-center gap-2 opacity-100">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onExport(ss.id); }}
                                                    className="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all"
                                                    title="Export session"
                                                >
                                                    <Icon name="upload" className="text-sm" />
                                                </button>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (await askConfirm(t('common.delete_session_confirm'), 'left')) onDelete(ss.id);
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                                                    title="Delete session"
                                                >
                                                    <Icon name="times" className="text-sm" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
    
                            // 🖥️ OPTIMIZED SIDEBAR LAYOUT
                            return (
                                <div
                                    key={ss.id}
                                    className={`session-card session-card-sidebar group relative grid grid-cols-[auto_1fr] gap-x-2.5 items-center rounded-xl p-2.5 transition-all duration-300 cursor-pointer border border-transparent ${isActive
                                        ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)] sunken-active'
                                        : 'text-[var(--text-secondary)] hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)]'
                                    } hover:border-[var(--primary-color)]/30 hover:shadow-[0_0_15px_-3px_var(--primary-color)]/20`}
                                    onClick={() => onSelect(ss.id)}
                                    onContextMenu={(event) => handleSessionContextMenu(event, ss)}
                                >
                                    {/* Status Indicator */}
                                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-[var(--primary-color)] shadow-glow' : 'bg-[var(--border-color)]'}`} />
    
                                    {/* Title - Dynamic Padding on Hover */}
                                    <div className="min-w-0 pr-0 group-hover:pr-[54px] transition-all duration-300">
                                        <div className="text-xs font-medium truncate">
                                            {ss.title || t('common.untitled_session')}
                                        </div>
                                        <div className="session-metadata flex items-center gap-1.5 min-w-0 text-[9px] text-[var(--text-secondary)] font-mono mt-0.5">
                                            <span className="shrink-0 whitespace-nowrap">{ss.messageCount} msgs • {new Date(ss.createdAt || ss.lastModified).toLocaleDateString()}</span>
                                            {sessionProject && <span className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-0.5 text-[var(--text-secondary)] group-hover:text-amber-300 transition-colors" title={sessionProject.name}>
                                                <span className="min-w-0 truncate text-right">{sessionProject.name}</span>
                                                <Icon name="folder" className="mr-0.5 shrink-0" />
                                            </span>}
                                        </div>
                                    </div>
    
                                    {/* Floating Actions */}
                                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onExport(ss.id); }}
                                            className="w-6 h-6 flex items-center justify-center text-[var(--text-secondary)] hover:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-all"
                                            title="Export session"
                                        >
                                            <Icon name="upload" className="text-[10px]" />
                                        </button>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (await askConfirm(t('common.delete_session_confirm'), 'left')) onDelete(ss.id);
                                            }}
                                            className="w-6 h-6 flex items-center justify-center text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 rounded-md transition-all"
                                            title="Delete session"
                                        >
                                            <Icon name="times" className="text-[10px]" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {/* Buffer to avoid scrollbar touching bottom directly */}
                        <div className="h-4 w-full flex-shrink-0" />
                    </>
                )}

                {sessionContextMenu && createPortal(
                    <div
                        className="fixed z-[1300] min-w-[190px] overflow-hidden rounded-xl border border-[var(--border-color)]/70 bg-[var(--surface-color)] p-1.5 shadow-2xl"
                        style={{
                            left: Math.min(sessionContextMenu.x, Math.max(8, window.innerWidth - 205)),
                            top: Math.min(sessionContextMenu.y, Math.max(8, window.innerHeight - 170))
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="truncate px-2.5 py-1.5 text-[9px] font-bold text-[var(--text-secondary)]">{sessionContextMenu.session.title || t('common.untitled_session')}</div>
                        <button
                            type="button"
                            onClick={openSessionFromContextMenu}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)]"
                        >
                            <Icon name="comments" className="text-[9px]" />
                            {t('projects.open_session', { defaultValue: 'Abrir sesión' })}
                        </button>
                        <button
                            type="button"
                            onClick={exportSessionFromContextMenu}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)]"
                        >
                            <Icon name="upload" className="text-[9px]" />
                            {t('projects.export_session', { defaultValue: 'Exportar sesión' })}
                        </button>
                        <div className="my-1 h-px bg-[var(--border-color)]/50" />
                        <button
                            type="button"
                            onClick={() => void deleteSessionFromContextMenu()}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-red-300 transition-colors hover:bg-red-400/10 hover:text-red-200"
                        >
                            <Icon name="times" className="text-[9px]" />
                            {t('projects.delete_session', { defaultValue: 'Eliminar sesión' })}
                        </button>
                    </div>,
                    document.body
                )}
            </div>
            )}
        </div>
    );
});
