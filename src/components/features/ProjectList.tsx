import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../common/Common';
import { ProjectMetadata, SessionMetadata } from '../../types';

export interface ProjectCreateOptions {
    name: string;
    location: 'workspace' | 'existing';
    existingPath?: string;
    sessionMode: 'isolated' | 'linked';
}

interface ProjectListProps {
    projects: ProjectMetadata[];
    sessions: SessionMetadata[];
    loading: boolean;
    currentSessionId: string | null;
    selectedProjectId: string | null;
    onSelectProject: (id: string | null) => void;
    onCreateProject: (options: ProjectCreateOptions) => Promise<ProjectMetadata | null>;
    onOpenProject: (path: string) => void;
    onNewSession: (projectId: string) => void;
    onSelectSession: (id: string) => void;
    onDeleteSession: (id: string) => void;
    onExportSession: (id: string) => void;
    onRemoveProject: (id: string, deleteFolder: boolean) => Promise<boolean>;
    askConfirm: (msg: string, position?: 'left' | 'right' | 'center') => Promise<boolean>;
    isModal?: boolean;
    createRequest?: number;
    importRequest?: number;
}

const shortPath = (value: string) => {
    if (value.length <= 48) return value;
    return `…${value.slice(-45)}`;
};

export const ProjectList = React.memo(({
    projects,
    sessions,
    loading,
    currentSessionId,
    selectedProjectId,
    onSelectProject,
    onCreateProject,
    onOpenProject,
    onNewSession,
    onSelectSession,
    onDeleteSession,
    onExportSession,
    onRemoveProject,
    askConfirm,
    isModal = false,
    createRequest = 0,
    importRequest = 0
}: ProjectListProps) => {
    const { t } = useTranslation();
    const [isCreating, setIsCreating] = useState(false);
    const [name, setName] = useState('');
    const [location, setLocation] = useState<'workspace' | 'existing'>('workspace');
    const [existingPath, setExistingPath] = useState('');
    const [sessionMode, setSessionMode] = useState<'isolated' | 'linked'>('isolated');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [contextMenu, setContextMenu] = useState<{ project: ProjectMetadata; x: number; y: number } | null>(null);
    const [sessionContextMenu, setSessionContextMenu] = useState<{ session: SessionMetadata; x: number; y: number } | null>(null);
    const [pendingRemoval, setPendingRemoval] = useState<ProjectMetadata | null>(null);
    const [removing, setRemoving] = useState(false);
    const [removeError, setRemoveError] = useState('');

    const selectedProject = projects.find(project => project.id === selectedProjectId) || null;
    const projectSessions = useMemo(
        () => selectedProject ? sessions.filter(session => session.projectId === selectedProject.id) : [],
        [selectedProject, sessions]
    );

    const resetForm = () => {
        setIsCreating(false);
        setName('');
        setLocation('workspace');
        setExistingPath('');
        setSessionMode('isolated');
        setError('');
    };

    const chooseExistingFolder = async () => {
        const electron = (window as any).electron;
        if (!electron?.selectFolder) return;
        const result = await electron.selectFolder();
        if (result?.ok) {
            setExistingPath(result.path);
            if (!name.trim() && result.name) setName(result.name);
        }
    };

    const importExistingFolder = async () => {
        const electron = (window as any).electron;
        if (!electron?.selectFolder) return;

        setIsCreating(true);
        setLocation('existing');
        setName('');
        setExistingPath('');
        setError('');

        const result = await electron.selectFolder();
        if (result?.ok) {
            setExistingPath(result.path);
            setName(result.name || '');
        }
    };

    useEffect(() => {
        if (createRequest > 0) {
            setIsCreating(true);
            setError('');
        }
    }, [createRequest]);

    useEffect(() => {
        if (importRequest > 0) void importExistingFolder();
    }, [importRequest]);

    useEffect(() => {
        if (!contextMenu && !sessionContextMenu) return;
        const closeContextMenu = () => {
            setContextMenu(null);
            setSessionContextMenu(null);
        };
        window.addEventListener('click', closeContextMenu);
        window.addEventListener('contextmenu', closeContextMenu);
        window.addEventListener('scroll', closeContextMenu, true);
        return () => {
            window.removeEventListener('click', closeContextMenu);
            window.removeEventListener('contextmenu', closeContextMenu);
            window.removeEventListener('scroll', closeContextMenu, true);
        };
    }, [contextMenu, sessionContextMenu]);

    const handleProjectContextMenu = (event: React.MouseEvent, project: ProjectMetadata) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({ project, x: event.clientX, y: event.clientY });
    };

    const handleSessionContextMenu = (event: React.MouseEvent, session: SessionMetadata) => {
        event.preventDefault();
        event.stopPropagation();
        setSessionContextMenu({ session, x: event.clientX, y: event.clientY });
    };

    const copyProjectPath = async (projectPath: string) => {
        try {
            await navigator.clipboard?.writeText(projectPath);
        } catch (error) {
            console.warn('[Projects] Could not copy project path:', error);
        }
        setContextMenu(null);
    };

    const confirmProjectRemoval = async (deleteFolder: boolean) => {
        if (!pendingRemoval || removing) return;
        setRemoving(true);
        setRemoveError('');
        try {
            const removed = await onRemoveProject(pendingRemoval.id, deleteFolder);
            if (removed) {
                setPendingRemoval(null);
                onSelectProject(null);
            } else {
                setRemoveError(t('projects.remove_error', { defaultValue: 'No se pudo quitar el proyecto.' }));
            }
        } catch (removalError) {
            console.error('[Projects] Could not remove project:', removalError);
            setRemoveError(t('projects.remove_error_restart', { defaultValue: 'No se pudo quitar el proyecto. Reinicia la aplicación e inténtalo de nuevo.' }));
        } finally {
            setRemoving(false);
        }
    };

    const openSessionFromContextMenu = () => {
        const sessionId = sessionContextMenu?.session.id;
        setSessionContextMenu(null);
        if (sessionId) onSelectSession(sessionId);
    };

    const exportSessionFromContextMenu = () => {
        const sessionId = sessionContextMenu?.session.id;
        setSessionContextMenu(null);
        if (sessionId) onExportSession(sessionId);
    };

    const deleteSessionFromContextMenu = async () => {
        const session = sessionContextMenu?.session;
        setSessionContextMenu(null);
        if (session && await askConfirm(t('common.delete_session_confirm'), 'left')) onDeleteSession(session.id);
    };

    const submit = async () => {
        const cleanName = name.trim();
        if (!cleanName) {
            setError(t('projects.name_required', { defaultValue: 'Escribe un nombre para el proyecto.' }));
            return;
        }
        if (location === 'existing' && !existingPath) {
            setError(t('projects.folder_required', { defaultValue: 'Selecciona una carpeta existente.' }));
            return;
        }

        setSaving(true);
        setError('');
        try {
            const project = await onCreateProject({ name: cleanName, location, existingPath, sessionMode });
            if (project) {
                resetForm();
                onSelectProject(project.id);
            } else {
                setError(t('projects.create_error', { defaultValue: 'No se pudo crear el proyecto.' }));
            }
        } catch (createError) {
            setError(createError instanceof Error ? createError.message : String(createError));
        } finally {
            setSaving(false);
        }
    };

    if (selectedProject) {
        return (
            <div className="flex flex-col h-full min-h-0 pt-4">
                <div className={`flex items-center gap-2 ${isModal ? 'mb-4' : 'mb-3'}`}>
                    <button
                        onClick={() => onSelectProject(null)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-color)] transition-all"
                        title={t('projects.back_to_projects', { defaultValue: 'Volver a proyectos' })}
                    >
                        <Icon name="arrow-left" className="text-[10px]" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <div className={`${isModal ? 'text-base' : 'text-xs'} font-bold text-[var(--text-primary)] truncate`}>{selectedProject.name}</div>
                        <div className="text-[9px] text-[var(--text-secondary)] font-mono truncate" title={selectedProject.path}>{shortPath(selectedProject.path)}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            onClick={() => onOpenProject(selectedProject.path)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--text-secondary)] hover:text-indigo-400 hover:bg-indigo-400/10 transition-all"
                            title={t('projects.open_folder', { defaultValue: 'Abrir carpeta' })}
                        >
                            <Icon name="external-link-alt" className="text-[10px]" />
                        </button>
                        <button
                            onClick={() => onNewSession(selectedProject.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-lg text-[var(--primary-color)] hover:bg-[var(--primary-color)]/10 transition-all"
                            title={t('projects.new_project_session', { defaultValue: 'Nueva sesión en el proyecto' })}
                        >
                            <Icon name="plus" className="text-[10px]" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                        {t('projects.project_sessions', { defaultValue: 'Sesiones del proyecto' })}
                    </span>
                    <span className="text-[9px] text-[var(--text-secondary)] font-mono">{projectSessions.length}</span>
                </div>

                <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar ${isModal ? 'space-y-2' : 'space-y-1'}`}>
                    {loading && projectSessions.length === 0 ? (
                        <div className="text-center py-5 text-[var(--text-secondary)] animate-pulse"><Icon name="spinner" className="animate-spin" /></div>
                    ) : projectSessions.length === 0 ? (
                        <div className="text-center py-7 px-3 border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--surface-color)]/30">
                            <Icon name="comments" className="text-[var(--text-secondary)] opacity-40 mb-2" />
                            <p className="text-[10px] text-[var(--text-secondary)]">{t('projects.no_sessions', { defaultValue: 'Este proyecto todavía no tiene sesiones.' })}</p>
                            <button onClick={() => onNewSession(selectedProject.id)} className="mt-3 text-[10px] font-bold text-[var(--primary-color)] hover:underline">
                                {t('projects.start_session', { defaultValue: 'Iniciar una sesión' })}
                            </button>
                        </div>
                    ) : projectSessions.map(session => {
                        const isActive = currentSessionId === session.id;
                        return (
                            <div
                                key={session.id}
                                onClick={() => onSelectSession(session.id)}
                                onContextMenu={(event) => handleSessionContextMenu(event, session)}
                                className={`group relative flex items-center gap-2.5 rounded-xl p-2.5 cursor-pointer border border-transparent transition-all ${isActive
                                    ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)] sunken-active'
                                    : 'text-[var(--text-secondary)] hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)]'
                                    } hover:border-[var(--primary-color)]/30`}
                            >
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? 'bg-[var(--primary-color)] shadow-glow' : 'bg-[var(--border-color)]'}`} />
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-medium truncate">{session.title || t('common.untitled_session')}</div>
                                    <div className="text-[9px] text-[var(--text-secondary)] font-mono truncate mt-0.5">
                                        {session.messageCount} {t('projects.messages', { defaultValue: 'mensajes' })} · {new Date(session.createdAt || session.lastModified).toLocaleDateString()}
                                    </div>
                                </div>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={(event) => { event.stopPropagation(); onExportSession(session.id); }} className="w-6 h-6 rounded-md flex items-center justify-center hover:text-indigo-400 hover:bg-indigo-400/10" title={t('projects.export_session', { defaultValue: 'Exportar sesión' })}><Icon name="upload" className="text-[9px]" /></button>
                                    <button onClick={async (event) => { event.stopPropagation(); if (await askConfirm(t('common.delete_session_confirm'), 'left')) onDeleteSession(session.id); }} className="w-6 h-6 rounded-md flex items-center justify-center hover:text-red-400 hover:bg-red-400/10" title={t('projects.delete_session', { defaultValue: 'Eliminar sesión' })}><Icon name="times" className="text-[9px]" /></button>
                                </div>
                            </div>
                        );
                    })}
                    <div className="h-3" />
                </div>

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
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            {isCreating && (
                <div className="rounded-xl border border-[var(--primary-color)]/25 bg-[var(--surface-color)]/50 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-primary)]">{t('projects.new_project', { defaultValue: 'Nuevo proyecto' })}</span>
                        <button onClick={resetForm} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><Icon name="times" className="text-[10px]" /></button>
                    </div>
                    <input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder={t('projects.name_placeholder', { defaultValue: 'Nombre del proyecto' })} className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--background-color)]/60 px-3 py-2 text-xs text-[var(--text-primary)] outline-none focus:border-[var(--primary-color)]/60" />

                    <div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">{t('projects.location', { defaultValue: 'Ubicación' })}</div>
                        <div className="grid grid-cols-2 gap-1.5">
                            <button onClick={() => setLocation('workspace')} className={`rounded-lg px-2 py-2 text-[9px] border transition-all ${location === 'workspace' ? 'border-blue-400/40 bg-blue-400/10 text-blue-300' : 'border-transparent bg-[var(--background-color)]/40 text-[var(--text-secondary)]'}`}><Icon name="layer-group" className="mr-1" />@WORKSPACE</button>
                            <button onClick={() => setLocation('existing')} className={`rounded-lg px-2 py-2 text-[9px] border transition-all ${location === 'existing' ? 'border-indigo-400/40 bg-indigo-400/10 text-indigo-300' : 'border-transparent bg-[var(--background-color)]/40 text-[var(--text-secondary)]'}`}><Icon name="folder-open" className="mr-1" />{t('projects.existing_folder', { defaultValue: 'Existente' })}</button>
                        </div>
                        {location === 'existing' && <button onClick={chooseExistingFolder} className="w-full mt-1.5 rounded-lg border border-[var(--border-color)] px-2.5 py-2 text-left text-[9px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--primary-color)]/40 truncate"><Icon name="search" className="mr-1.5" />{existingPath ? shortPath(existingPath) : t('projects.choose_folder', { defaultValue: 'Elegir carpeta…' })}</button>}
                    </div>

                    <div>
                        <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">{t('projects.session_storage', { defaultValue: 'Sesiones' })}</div>
                        <div className="grid grid-cols-2 gap-1.5">
                            <button onClick={() => setSessionMode('isolated')} className={`rounded-lg px-2 py-2 text-[9px] border transition-all ${sessionMode === 'isolated' ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300' : 'border-transparent bg-[var(--background-color)]/40 text-[var(--text-secondary)]'}`}>{t('projects.isolated', { defaultValue: 'Aisladas' })}</button>
                            <button onClick={() => setSessionMode('linked')} className={`rounded-lg px-2 py-2 text-[9px] border transition-all ${sessionMode === 'linked' ? 'border-purple-400/40 bg-purple-400/10 text-purple-300' : 'border-transparent bg-[var(--background-color)]/40 text-[var(--text-secondary)]'}`}>{t('projects.linked', { defaultValue: 'Vinculadas' })}</button>
                        </div>
                    </div>
                    {error && <p className="text-[10px] text-red-400">{error}</p>}
                    <button disabled={saving} onClick={submit} className="w-full rounded-lg bg-[var(--primary-color)]/15 px-3 py-2 text-[10px] font-bold text-[var(--primary-color)] hover:bg-[var(--primary-color)]/25 disabled:opacity-50">{saving ? t('common.loading', { defaultValue: 'Guardando…' }) : t('projects.create', { defaultValue: 'Crear proyecto' })}</button>
                </div>
            )}

            <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar pt-4 ${isModal ? 'space-y-2' : 'space-y-1'}`}>
                {loading && projects.length === 0 ? (
                    <div className="text-center py-5 text-[var(--text-secondary)] animate-pulse"><Icon name="spinner" className="animate-spin" /></div>
                ) : projects.length === 0 ? (
                    <div className="mt-8 text-center py-8 px-3 border border-dashed border-[var(--border-color)] rounded-xl bg-[var(--surface-color)]/30">
                        <Icon name="folder-open" className="text-xl text-[var(--text-secondary)] opacity-30 mb-2" />
                        <p className="text-[10px] text-[var(--text-secondary)]">{t('projects.empty', { defaultValue: 'Crea un proyecto para organizar sus sesiones y archivos.' })}</p>
                        {!isCreating && <button
                            type="button"
                            onClick={() => setIsCreating(true)}
                            className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--primary-color)]/40 bg-[var(--primary-color)]/5 px-3 py-2 text-[10px] text-[var(--primary-color)] hover:bg-[var(--primary-color)]/10 transition-all"
                        >
                            <Icon name="folder-plus" />
                            <span className="font-bold">{t('projects.new_project', { defaultValue: 'Nuevo proyecto' })}</span>
                        </button>}
                    </div>
                ) : projects.map(project => (
                    <button key={project.id} type="button" onClick={() => onSelectProject(project.id)} onContextMenu={(event) => handleProjectContextMenu(event, project)} className={`w-full text-left group rounded-xl p-3 border border-transparent transition-all ${isModal ? 'p-4' : ''} text-[var(--text-secondary)] hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)] hover:border-[var(--primary-color)]/30`}>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--surface-color)]/40 text-[var(--text-secondary)] border border-[var(--border-color)]/60 shrink-0 group-hover:bg-amber-400/10 group-hover:text-amber-300 group-hover:border-amber-400/20 transition-colors"><Icon name="folder" /></div>
                            <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold truncate">{project.name}</div>
                                <div className="text-[9px] text-[var(--text-secondary)] font-mono truncate mt-0.5" title={project.path}>{shortPath(project.path)}</div>
                            </div>
                            <Icon name="chevron-right" className="text-[10px] opacity-30 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center gap-2 mt-2 pl-11 text-[9px] font-mono text-[var(--text-secondary)]">
                            <span>{project.sessionCount} {t('projects.sessions', { defaultValue: 'sesiones' })}</span>
                            <span className="opacity-40">·</span>
                            <span className={`text-[var(--text-secondary)] transition-colors ${project.sessionMode === 'linked' ? 'group-hover:text-purple-300' : 'group-hover:text-cyan-300'}`}>{project.sessionMode === 'linked' ? t('projects.linked', { defaultValue: 'Vinculadas' }) : t('projects.isolated', { defaultValue: 'Aisladas' })}</span>
                        </div>
                    </button>
                ))}
                <div className="h-4" />
            </div>

            {contextMenu && createPortal(
                <div
                    className="fixed z-[1300] min-w-[190px] overflow-hidden rounded-xl border border-[var(--border-color)]/70 bg-[var(--surface-color)] p-1.5 shadow-2xl"
                    style={{
                        left: Math.min(contextMenu.x, Math.max(8, window.innerWidth - 205)),
                        top: Math.min(contextMenu.y, Math.max(8, window.innerHeight - 235))
                    }}
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="truncate px-2.5 py-1.5 text-[9px] font-bold text-[var(--text-secondary)]">{contextMenu.project.name}</div>
                    <button
                        type="button"
                        onClick={() => {
                            onSelectProject(contextMenu.project.id);
                            setContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)]"
                    >
                        <Icon name="folder-open" className="text-[9px]" />
                        {t('projects.open_project', { defaultValue: 'Abrir proyecto' })}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onOpenProject(contextMenu.project.path);
                            setContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)]"
                    >
                        <Icon name="external-link-alt" className="text-[9px]" />
                        {t('projects.open_folder', { defaultValue: 'Abrir carpeta' })}
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onNewSession(contextMenu.project.id);
                            setContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)]"
                    >
                        <Icon name="plus" className="text-[9px]" />
                        {t('projects.new_project_session', { defaultValue: 'Nueva sesión en el proyecto' })}
                    </button>
                    <button
                        type="button"
                        onClick={() => void copyProjectPath(contextMenu.project.path)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-color)] hover:text-[var(--text-primary)]"
                    >
                        <Icon name="copy" className="text-[9px]" />
                        {t('projects.copy_path', { defaultValue: 'Copiar ruta' })}
                    </button>
                    <div className="my-1 h-px bg-[var(--border-color)]/50" />
                    <button
                        type="button"
                        onClick={() => {
                            setPendingRemoval(contextMenu.project);
                            setRemoveError('');
                            setContextMenu(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[10px] text-red-300 transition-colors hover:bg-red-400/10 hover:text-red-200"
                    >
                        <Icon name="times" className="text-[9px]" />
                        {t('projects.remove_project', { defaultValue: 'Quitar proyecto' })}
                    </button>
                </div>,
                document.body
            )}

            {pendingRemoval && createPortal(
                <div
                    className="fixed inset-0 z-[1250] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !removing) setPendingRemoval(null);
                    }}
                >
                    <div className="w-full max-w-sm rounded-2xl border border-[var(--border-color)]/70 bg-[var(--surface-color)] p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="flex items-start gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-400/20 bg-red-400/10 text-red-300">
                                <Icon name="exclamation-triangle" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h2 className="text-sm font-bold text-[var(--text-primary)]">{t('projects.remove_project', { defaultValue: 'Quitar proyecto' })}</h2>
                                <p className="mt-1 break-words text-[11px] leading-relaxed text-[var(--text-secondary)]">
                                    {t('projects.remove_project_description', { defaultValue: '¿Qué quieres hacer con «{{name}}»?', name: pendingRemoval.name })}
                                </p>
                            </div>
                            <button type="button" onClick={() => setPendingRemoval(null)} disabled={removing} className="text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]" title={t('common.cancel')}>
                                <Icon name="times" className="text-xs" />
                            </button>
                        </div>

                        <div className="mt-5 grid gap-2">
                            <button type="button" onClick={() => void confirmProjectRemoval(false)} disabled={removing} className="rounded-xl border border-[var(--border-color)] bg-[var(--background-color)]/40 px-3 py-2.5 text-left transition-colors hover:border-[var(--primary-color)]/40 hover:bg-[var(--hover-color)] disabled:opacity-50">
                                <span className="block text-[11px] font-bold text-[var(--text-primary)]">{t('projects.remove_from_list', { defaultValue: 'Solo quitar de la lista' })}</span>
                                <span className="mt-0.5 block text-[9px] text-[var(--text-secondary)]">{t('projects.keep_folder', { defaultValue: 'Conserva la carpeta y sus archivos.' })}</span>
                            </button>
                            <button type="button" onClick={() => void confirmProjectRemoval(true)} disabled={removing} className="rounded-xl border border-red-400/25 bg-red-400/5 px-3 py-2.5 text-left transition-colors hover:border-red-400/50 hover:bg-red-400/10 disabled:opacity-50">
                                <span className="block text-[11px] font-bold text-red-300">{t('projects.delete_folder', { defaultValue: 'Borrar carpeta completa' })}</span>
                                <span className="mt-0.5 block text-[9px] text-red-300/70">{t('projects.delete_folder_warning', { defaultValue: 'Elimina todos sus archivos y sesiones. Esta acción no se puede deshacer.' })}</span>
                            </button>
                        </div>
                        {removing && <p className="mt-3 text-[10px] text-[var(--text-secondary)]">{t('common.loading', { defaultValue: 'Guardando…' })}</p>}
                        {removeError && <p className="mt-3 text-[10px] text-red-400">{removeError}</p>}
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
});
