'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CLOUD_PROVIDERS = new Set(['gemini', 'groq', 'zai']);
const ALL_PROVIDERS = new Set([...CLOUD_PROVIDERS, 'ollama']);
const SECRET_MARKERS = new Set(['••••••••', 'true', 'false']);

function bridgeError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function isPathInside(parent, child) {
    const relative = path.relative(path.resolve(parent), path.resolve(child));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolveReviewedBuiltinEntry({
    skillName,
    runtime,
    entryFile,
    trustedSkillsRoot,
    manifestName = skillName,
    manifestEntry
}) {
    try {
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(skillName || '')) return null;
        const trustedRoot = fs.realpathSync.native(trustedSkillsRoot);
        const manifestPath = path.join(trustedRoot, skillName, 'manifest.json');
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const bundledEntry = fs.realpathSync.native(path.join(path.dirname(manifestPath), manifest.entry));
        const candidateEntry = fs.realpathSync.native(entryFile);
        const declaredEntry = manifestEntry === undefined ? manifest.entry : manifestEntry;
        const reviewed = manifest.name === skillName
            && manifestName === skillName
            && manifest.runtime === runtime
            && path.normalize(String(declaredEntry)) === path.normalize(String(manifest.entry))
            && isPathInside(path.dirname(manifestPath), bundledEntry)
            && fs.statSync(candidateEntry).isFile();

        // A workspace skill with a reserved builtin identity is only an invocation
        // alias. Always return the immutable bundled entry instead of executing the
        // writable copy. Its bytes may legitimately lag behind after an app update.
        return reviewed ? bundledEntry : null;
    } catch {
        return null;
    }
}

function isReviewedBuiltinSkill(identity) {
    return resolveReviewedBuiltinEntry(identity) !== null;
}

function clonePlain(value) {
    if (value === undefined) return {};
    return JSON.parse(JSON.stringify(value));
}

function configuredCredential(value) {
    return typeof value === 'string' && value.length > 0 && !SECRET_MARKERS.has(value);
}

function prepareDeepResearchExecution({ args, reviewedBuiltin, apiKeys = {}, configuredOllamaUrl = 'http://127.0.0.1:11434' }) {
    if (!reviewedBuiltin) {
        throw bridgeError('SKILL_SECRET_DENIED', 'Deep Research credentials are available only to the reviewed builtin skill');
    }
    const executionArgs = clonePlain(args);
    const config = executionArgs._config && typeof executionArgs._config === 'object' && !Array.isArray(executionArgs._config)
        ? executionArgs._config
        : {};
    executionArgs._config = config;

    // Deep Research must receive an explicit runtime captured from the mode
    // that invoked it. Inferring it from the global config caused approved and
    // resumed runs to use the master fallback model instead.
    const runtime = executionArgs._runtime && typeof executionArgs._runtime === 'object' && !Array.isArray(executionArgs._runtime)
        ? executionArgs._runtime
        : {};
    const provider = String(runtime.provider || '').toLowerCase();
    if (!ALL_PROVIDERS.has(provider)) {
        throw bridgeError('LLM_PROVIDER_INVALID', 'Deep Research has no explicit provider for the active mode');
    }
    const model = String(runtime.model || '').trim();
    if (!model || model.length > 160 || !/^[a-zA-Z0-9._:/-]+$/.test(model)) {
        throw bridgeError('LLM_MODEL_INVALID', 'Deep Research has no explicit model for the active mode');
    }
    delete executionArgs._runtime;
    config.provider = provider;
    config.model = model;

    // Never forward renderer-projected markers or the complete keyring in argv.
    config.apiKeys = {};
    const env = {
        MIKU_LLM_PROVIDER: provider,
        MIKU_LLM_MODEL: model,
    };
    if (CLOUD_PROVIDERS.has(provider)) {
        const credential = apiKeys[provider];
        if (!configuredCredential(credential)) {
            throw bridgeError('LLM_CREDENTIAL_UNAVAILABLE', `No usable ${provider} credential is stored in the secure main-process vault`);
        }
        env.MIKU_LLM_CREDENTIAL = credential;
    } else {
        env.MIKU_LLM_OLLAMA_URL = configuredOllamaUrl;
        config.ollamaUrl = configuredOllamaUrl;
    }
    return { args: executionArgs, env };
}

module.exports = {
    CLOUD_PROVIDERS,
    isReviewedBuiltinSkill,
    resolveReviewedBuiltinEntry,
    prepareDeepResearchExecution,
};
