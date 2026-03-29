/**
 * BlueprintHydrator — Template Hydration Service for First-Run Onboarding
 * Path: src/services/core/BlueprintHydrator.ts
 *
 * Reads the template files from core/base/blueprints/templates/
 * (IDENTITY.template.md, SOUL.template.md, USER.template.md),
 * replaces {{VARIABLE}} placeholders with the user's personalized values,
 * and saves the hydrated results into the configured folders.
 *
 * IDENTITY.md → commands/ (tools)
 * SOUL.md, USER.md → core/
 *
 * This runs ONCE during onboarding. After that, constructSystemInstruction()
 * in App.tsx picks up the generated files naturally from the file stores.
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface PromptVariables {
    LANGUAGE?: string;
    TONE?: string;
    VERBOSITY?: string;
    HUMOR_LEVEL?: string;
    USER_NAME?: string;
    TECHNICAL_SKILL?: string;
    CURRENT_GOAL?: string;
    AUTONOMY_MODE?: string;
    USER_CONTEXT_DUMP?: string;
    [key: string]: string | undefined;
}

export interface HydrationResult {
    /** Target filename (e.g. "SOUL.md") */
    filename: string;
    /** Target folder: 'core' for SOUL/USER, 'tools' for IDENTITY (commands/) */
    target: 'core' | 'tools';
    /** The hydrated content ready to be written to disk */
    content: string;
    /** Which variables were applied in this template */
    appliedVariables: string[];
}

// ─── Defaults ────────────────────────────────────────────────────────

const DEFAULT_VARIABLES: Record<string, string> = {
    LANGUAGE: 'Español',
    TONE: 'Profesional y amigable',
    VERBOSITY: 'Medio',
    HUMOR_LEVEL: 'Bajo',
    USER_NAME: 'Usuario',
    TECHNICAL_SKILL: 'Intermedio',
    CURRENT_GOAL: 'Asistencia general',
    AUTONOMY_MODE: 'Semi-autónomo',
    USER_CONTEXT_DUMP: 'Sin contexto adicional proporcionado.',
};

// ─── Template → Output mapping ───────────────────────────────────────

const TEMPLATE_MAP: { template: string; output: string; target: 'core' | 'tools' }[] = [
    { template: 'IDENTITY.template.md', output: 'IDENTITY.md', target: 'tools' },
    { template: 'SOUL.template.md',     output: 'SOUL.md',     target: 'core' },
    { template: 'USER.template.md',     output: 'USER.md',     target: 'core' },
];

// ─── Core Functions ─────────────────────────────────────────────────

/**
 * Replaces all `{{VARIABLE_NAME}}` placeholders in a template string
 * with values from the provided map, falling back to defaults.
 */
export function hydrateTemplate(
    template: string,
    variables: PromptVariables
): { content: string; appliedVariables: string[] } {
    const merged: Record<string, string> = { ...DEFAULT_VARIABLES };
    for (const [k, v] of Object.entries(variables)) {
        if (v !== undefined) merged[k] = v;
    }

    const applied: string[] = [];

    const content = template.replace(/\{\{(\w+)\}\}/g, (match, varName: string) => {
        const value = merged[varName];
        if (value !== undefined) {
            applied.push(varName);
            return value;
        }
        return match; // Leave unresolved placeholders visible for debugging
    });

    return { content, appliedVariables: [...new Set(applied)] };
}

/**
 * Reads a blueprint template file via Electron IPC.
 * Returns null if unavailable.
 */
async function readTemplate(templateName: string): Promise<string | null> {
    const electron = (window as any).electron;
    if (!electron?.readBlueprintTemplate) return null;

    try {
        const res = await electron.readBlueprintTemplate({ filename: templateName });
        if (res.ok && res.content) return res.content;
    } catch (e) {
        console.warn(`[SystemPromptBuilder] Failed to read template "${templateName}":`, e);
    }
    return null;
}

// ─── Main Entry Point ───────────────────────────────────────────────

/**
 * Reads all blueprint templates, hydrates them with the user's variables,
 * and returns the results ready to be saved into the core/ folder.
 *
 * Called during onboarding after the user has configured their preferences.
 *
 * @param variables - Personalization values collected during onboarding
 * @returns Array of hydrated files ready for persistence
 */
export async function hydrateAllTemplates(
    variables: PromptVariables
): Promise<HydrationResult[]> {
    const results: HydrationResult[] = [];

    for (const { template, output, target } of TEMPLATE_MAP) {
        const raw = await readTemplate(template);
        if (!raw) {
            console.warn(`[SystemPromptBuilder] Template "${template}" not found, skipping.`);
            continue;
        }

        const { content, appliedVariables } = hydrateTemplate(raw, variables);
        results.push({ filename: output, target, content, appliedVariables });
    }

    return results;
}

/**
 * Full pipeline: hydrate templates and save them to core/ via the provided save function.
 *
 * @param variables - Personalization values
 * @param saveFn    - Persistence function (e.g. saveFile(name, content, 'core'))
 * @returns List of filenames that were successfully written
 */
export async function hydrateAndPersistTemplates(
    variables: PromptVariables,
    saveFn: (filename: string, content: string, target: 'core' | 'tools') => Promise<boolean>
): Promise<string[]> {
    const hydrated = await hydrateAllTemplates(variables);
    const saved: string[] = [];

    for (const file of hydrated) {
        try {
            const ok = await saveFn(file.filename, file.content, file.target);
            if (ok) {
                saved.push(file.filename);
                console.log(`[SystemPromptBuilder] ✅ ${file.filename} saved (vars: ${file.appliedVariables.join(', ')})`);
            } else {
                console.error(`[SystemPromptBuilder] ❌ Failed to save ${file.filename}`);
            }
        } catch (e) {
            console.error(`[SystemPromptBuilder] ❌ Error saving ${file.filename}:`, e);
        }
    }

    return saved;
}

// ─── Helper: extract variables from AppConfig ────────────────────────

/**
 * Bridges the existing AppConfig shape into PromptVariables.
 * Reads from config fields if they exist, otherwise uses defaults.
 */
export function extractVariablesFromConfig(config: Record<string, any>): PromptVariables {
    return {
        LANGUAGE:          config.language       || config.LANGUAGE          || DEFAULT_VARIABLES.LANGUAGE,
        TONE:              config.tone           || config.TONE              || DEFAULT_VARIABLES.TONE,
        VERBOSITY:         config.verbosity      || config.VERBOSITY         || DEFAULT_VARIABLES.VERBOSITY,
        HUMOR_LEVEL:       config.humorLevel     || config.HUMOR_LEVEL       || DEFAULT_VARIABLES.HUMOR_LEVEL,
        USER_NAME:         config.userName        || config.USER_NAME        || DEFAULT_VARIABLES.USER_NAME,
        TECHNICAL_SKILL:   config.technicalSkill  || config.TECHNICAL_SKILL  || DEFAULT_VARIABLES.TECHNICAL_SKILL,
        CURRENT_GOAL:      config.currentGoal     || config.CURRENT_GOAL     || DEFAULT_VARIABLES.CURRENT_GOAL,
        AUTONOMY_MODE:     config.autonomyMode    || config.AUTONOMY_MODE    || DEFAULT_VARIABLES.AUTONOMY_MODE,
        USER_CONTEXT_DUMP: config.userContextDump || config.USER_CONTEXT_DUMP || DEFAULT_VARIABLES.USER_CONTEXT_DUMP,
    };
}
