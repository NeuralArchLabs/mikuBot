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
    ASSISTANT_ALIAS?: string;
    TECHNICAL_SKILL?: string;
    CURRENT_GOAL?: string;
    AUTONOMY_MODE?: string;
    USER_CONTEXT_DUMP?: string;
    CUSTOM_RULES?: string;
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
    LANGUAGE: 'English',
    TONE: 'Professional',
    VERBOSITY: 'Medium',
    HUMOR_LEVEL: 'Low',
    USER_NAME: 'User',
    ASSISTANT_ALIAS: 'mikuBot',
    TECHNICAL_SKILL: 'Intermediate',
    CURRENT_GOAL: 'General assistance',
    AUTONOMY_MODE: 'Semi-autonomous',
    USER_CONTEXT_DUMP: 'No additional context provided.',
    CUSTOM_RULES: 'No additional instructions.',
};

// ─── Template → Output mapping ─────────────────────────────────────

const TEMPLATE_BASES: { base: string; output: string; target: 'core' | 'tools' }[] = [
    { base: 'IDENTITY', output: 'IDENTITY.md', target: 'tools' },
    { base: 'SOUL',     output: 'SOUL.md',     target: 'core' },
    { base: 'USER',     output: 'USER.md',     target: 'core' },
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
 * Reads ALL blueprint templates from disk via the existing `readFolder` IPC.
 * Returns a map of filename → content.
 * This is the ONLY IPC call needed — we read the whole templates/ folder at once.
 */
export async function readAllTemplatesFromDisk(): Promise<Record<string, string>> {
    const electron = (window as any).electron;
    if (!electron?.readFolder) return {};

    // We need to discover the templates path.
    // During onboarding, core/base gets copied into commands/ by setup-onboarding.
    // But templates live in core/base/blueprints/templates/ which IS copied to commands/blueprints/templates/.
    // However, the BEST source is the app's bundled resources. The readFolder IPC
    // can read any path, so we try multiple fallback paths.

    // Strategy: The caller should pass the commands path (which has the copied core/base).
    // But we also support a direct read if the path is available.
    return {};
}

/**
 * Reads templates from a pre-loaded folder content map (from readFolder IPC).
 * The keys in folderContent are relative paths like "blueprints/templates/SOUL.template.md".
 */
export function extractTemplatesFromFolderContent(
    folderContent: Record<string, string>
): Record<string, string> {
    const templates: Record<string, string> = {};

    for (const [relPath, content] of Object.entries(folderContent)) {
        const normalizedPath = relPath.replace(/\\/g, '/');
        // Match files in blueprints/templates/ that end with .md
        if (normalizedPath.includes('blueprints/templates/') && normalizedPath.endsWith('.md')) {
            const filename = normalizedPath.split('/').pop() || '';
            if (filename) templates[filename] = content;
        }
    }

    return templates;
}

// ─── Main Entry Point ─────────────────────────────────────────────

/**
 * Hydrates all blueprint templates with the user's variables.
 *
 * @param variables       - Personalization values collected during onboarding
 * @param templateContent - Map of template filename → raw content (from extractTemplatesFromFolderContent)
 * @returns Array of hydrated files ready for persistence
 */
export function hydrateAllTemplates(
    variables: PromptVariables,
    templateContent: Record<string, string>,
    language: string = 'en'
): HydrationResult[] {
    const results: HydrationResult[] = [];

    for (const { base, output, target } of TEMPLATE_BASES) {
        // Try language specific template: base.template.en.md
        const langTemplate = `${base}.template.${language}.md`;
        const fallbackTemplate = `${base}.template.md`;

        let raw = templateContent[langTemplate];
        if (!raw) {
            raw = templateContent[fallbackTemplate];
            if (raw) {
                console.log(`[BlueprintHydrator] Template "${langTemplate}" not found, falling back to "${fallbackTemplate}"`);
            }
        }

        if (!raw) {
            console.warn(`[BlueprintHydrator] No template found for base "${base}" (tried ${langTemplate}, ${fallbackTemplate}), skipping.`);
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
    templateContent: Record<string, string>,
    saveFn: (filename: string, content: string, target: 'core' | 'tools') => Promise<boolean>,
    language: string = 'en'
): Promise<string[]> {
    const hydrated = hydrateAllTemplates(variables, templateContent, language);
    const saved: string[] = [];

    for (const file of hydrated) {
        try {
            const ok = await saveFn(file.filename, file.content, file.target);
            if (ok) {
                saved.push(file.filename);
                console.log(`[BlueprintHydrator] ✅ ${file.filename} saved (vars: ${file.appliedVariables.join(', ')})`);
            } else {
                console.error(`[BlueprintHydrator] ❌ Failed to save ${file.filename}`);
            }
        } catch (e) {
            console.error(`[BlueprintHydrator] ❌ Error saving ${file.filename}:`, e);
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
        ASSISTANT_ALIAS:   config.assistantAlias || config.ASSISTANT_ALIAS   || DEFAULT_VARIABLES.ASSISTANT_ALIAS,
        TECHNICAL_SKILL:   config.technicalSkill  || config.TECHNICAL_SKILL  || DEFAULT_VARIABLES.TECHNICAL_SKILL,
        CURRENT_GOAL:      config.currentGoal     || config.CURRENT_GOAL     || DEFAULT_VARIABLES.CURRENT_GOAL,
        AUTONOMY_MODE:     config.autonomyMode    || config.AUTONOMY_MODE    || DEFAULT_VARIABLES.AUTONOMY_MODE,
        USER_CONTEXT_DUMP: config.userContextDump || config.USER_CONTEXT_DUMP || DEFAULT_VARIABLES.USER_CONTEXT_DUMP,
        CUSTOM_RULES:      config.customRules     || config.CUSTOM_RULES      || DEFAULT_VARIABLES.CUSTOM_RULES,
    };
}
