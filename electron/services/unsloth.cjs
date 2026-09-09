'use strict';

const UNSLOTH_DEFAULT_URL = 'http://localhost:8888/v1';

/** Accept the base URL shown by Desktop or its full chat-completions URL. */
function normalizeUnslothBase(value = UNSLOTH_DEFAULT_URL) {
    const url = new URL(String(value || UNSLOTH_DEFAULT_URL).trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('Unsloth necesita una URL HTTP o HTTPS sin credenciales, parámetros ni fragmentos.');
    }
    let pathname = url.pathname.replace(/\/+$/, '');
    if (/\/chat\/completions$/i.test(pathname)) pathname = pathname.replace(/\/chat\/completions$/i, '');
    else if (/\/models$/i.test(pathname)) pathname = pathname.replace(/\/models$/i, '');
    else if (!/\/v1$/i.test(pathname)) pathname += '/v1';
    url.pathname = pathname;
    if (url.hostname === 'localhost') url.hostname = '127.0.0.1';
    return url.href.replace(/\/$/, '');
}

function unslothEndpoint(configuredUrl, route, requestedUrl) {
    const base = normalizeUnslothBase(configuredUrl);
    if (requestedUrl && normalizeUnslothBase(requestedUrl) !== base) {
        throw new Error('Guarda la dirección de Unsloth en los ajustes antes de consultar sus modelos.');
    }
    if (!['models', 'chat/completions'].includes(route)) throw new Error('Ruta de Unsloth no permitida.');
    return `${base}/${route}`;
}

function unslothControlEndpoint(configuredUrl, route) {
    return unslothApiEndpoint(configuredUrl, route, ['api/inference/load']);
}

function unslothApiEndpoint(configuredUrl, route, allowed = ['api/inference/load', 'api/inference/validate', 'api/inference/status', 'api/models/list', 'api/models/local', 'api/models/cached-gguf', 'api/chat/settings', 'api/settings/openai-auto-switch/overrides']) {
    const base = normalizeUnslothBase(configuredUrl);
    if (!allowed.includes(route)) throw new Error('Ruta de control de Unsloth no permitida.');
    const baseUrl = base.toLowerCase().endsWith('/v1') ? base.slice(0, -3) : base;
    return `${baseUrl}/${route}`;
}

function unslothHeaders(apiKey) {
    const headers = { 'Content-Type': 'application/json' };
    const key = typeof apiKey === 'string' ? apiKey.trim() : '';
    // An empty Bearer header is not keyless access.
    if (key && key !== '••••••••') headers.Authorization = `Bearer ${key}`;
    return headers;
}

function unslothHttpError(status, detail, hasKey) {
    if (status === 401) return hasKey
        ? 'Unsloth Desktop rechazó la API key. Guarda una clave vigente de Settings → API.'
        : 'Unsloth Desktop requiere autenticación. Guarda su API key o activa Settings → API → Keyless API Access: Inference.';
    return `Unsloth HTTP ${status}: ${detail || 'No se pudo completar la petición.'}`;
}

/** The OpenAI API can be configured to switch GGUFs, but that setting is
 * optional and unloaded models can still return model_not_found. The Desktop
 * control API is the explicit, supported way to ask it to load one. */
function shouldLoadUnslothModel(status, detail) {
    if (![400, 404, 409, 422, 500, 503].includes(Number(status))) return false;
    const text = String(detail || '').toLowerCase();
    return /model[_ -]?(not[_ -]?(found|loaded))|not\s+(?:downloaded|loaded)|no model|load(?:ing)? model|inference server/.test(text);
}

function unslothLoadPayload(model, ggufVariant) {
    const spec = model && typeof model === 'object' ? model : { model_path: model, gguf_variant: ggufVariant };
    const modelPath = String(spec.model_path || '').trim();
    const variant = typeof spec.gguf_variant === 'string' ? spec.gguf_variant.trim() : '';
    return {
        model_path: modelPath,
        ...(variant ? { gguf_variant: variant } : {}),
        is_lora: spec.is_lora === true,
        ...unslothLoadSettings(spec, /\.gguf$/i.test(modelPath) || !!variant, { normalized: true }),
    };
}

function unslothBoundedInteger(value, minimum, maximum) {
    return Number.isInteger(value) && value >= minimum && value <= maximum ? value : null;
}

/** Map Desktop's server-side per-model override onto documented LoadRequest
 * fields. Keep this explicit: the settings response is not itself a load body,
 * and `kv_cache_dtype` in particular has a different request name. */
function unslothLoadSettings(source, isGguf = true, { normalized = false } = {}) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
    const settings = {};
    const mode = source.gpu_memory_mode === 'manual' || source.gpu_memory_mode === 'auto'
        ? source.gpu_memory_mode : null;
    const gpuLayers = unslothBoundedInteger(source.gpu_layers, -1, 1024);
    const customContext = unslothBoundedInteger(source.custom_context_length, 1, 1048576);
    const maxContext = unslothBoundedInteger(source.max_seq_length, 0, 1048576);
    // A normalized LoadRequest already resolved custom_context_length into
    // max_seq_length. Do not reinterpret it as a raw Desktop override and
    // silently replace an explicit context with Auto on the validation pass.
    const effectiveContext = normalized ? (maxContext ?? customContext)
        : isGguf && mode === 'manual' && gpuLayers === null
        ? (customContext ?? 0)
        : (maxContext ?? customContext);
    if (effectiveContext !== null) settings.max_seq_length = effectiveContext;

    const copyInteger = (name, minimum, maximum) => {
        const value = unslothBoundedInteger(source[name], minimum, maximum);
        if (value !== null) settings[name] = value;
    };
    const copyBoolean = name => {
        if (typeof source[name] === 'boolean') settings[name] = source[name];
    };
    const copyShortString = (sourceName, targetName = sourceName, allowed = null) => {
        const value = typeof source[sourceName] === 'string' ? source[sourceName].trim() : '';
        if (value && value.length <= 65536 && (!allowed || allowed.includes(value))) settings[targetName] = value;
    };
    const copyStringArray = (sourceName, targetName = sourceName) => {
        const values = source[sourceName];
        // An empty list is meaningful: it clears inherited llama-server extras.
        if (!Array.isArray(values) || values.length > 256) return;
        if (values.every(value => typeof value === 'string' && value.length <= 4096)) {
            settings[targetName] = [...values];
        }
    };

    const cacheType = source.kv_cache_dtype ?? source.cache_type_kv;
    if (typeof cacheType === 'string') {
        copyShortString(source.kv_cache_dtype != null ? 'kv_cache_dtype' : 'cache_type_kv', 'cache_type_kv', ['f16', 'bf16', 'q8_0', 'q4_0', 'q4_1', 'q5_0', 'q5_1', 'iq4_nl', 'f32']);
    }
    copyShortString('speculative_type');
    copyShortString('load_mode', 'load_mode', ['auto', 'none', 'mmap', 'mlock', 'mmap+mlock', 'dio']);
    copyShortString('spec_draft_cache_type');
    copyShortString('chat_template_override');
    copyStringArray('llama_extra_args');
    copyInteger('mlx_kv_bits', 2, 8);
    copyInteger('spec_draft_n_max', 1, 16);
    copyBoolean('tensor_parallel');
    copyBoolean('disable_vision');

    if (isGguf) {
        if (mode) settings.gpu_memory_mode = mode;
        if (gpuLayers !== null) settings.gpu_layers = gpuLayers;
        copyInteger('n_cpu_moe', 0, 1024);
        copyInteger('n_parallel', 1, 64);
        copyInteger('n_batch', 1, 65536);
        copyInteger('n_ubatch', 1, 65536);
        copyInteger('ctx_checkpoints', 0, 256);
        copyInteger('cache_ram', -1, 1048576);
        if (Array.isArray(source.gpu_ids)
            && source.gpu_ids.length > 0
            && source.gpu_ids.length <= 1025
            && source.gpu_ids.every(id => unslothBoundedInteger(id, 0, 1024) !== null)
            && new Set(source.gpu_ids).size === source.gpu_ids.length) {
            settings.gpu_ids = [...source.gpu_ids];
        }
    }
    return settings;
}

/** Read only installation-wide execution preferences. Chat UI features such
 * as compaction and checkpoint policies do not belong in the load settings. */
function normalizeUnslothChatSettings(value) {
    const raw = value && typeof value === 'object' && !Array.isArray(value)
        ? (value.settings && typeof value.settings === 'object' && !Array.isArray(value.settings) ? value.settings : value)
        : {};
    const gpuMemoryMode = raw.gpuMemoryMode === 'manual' || raw.gpuMemoryMode === 'auto'
        ? raw.gpuMemoryMode : 'auto';
    const speculativeType = raw.speculativeType === 'auto' || raw.speculativeType === 'ngram' || raw.speculativeType === 'off'
        ? raw.speculativeType : 'auto';
    return {
        gpuMemoryMode,
        speculativeType,
    };
}

/** Apply only global run preferences that Desktop itself uses as fallbacks.
 * Per-model settings must be spread afterwards so an explicit model choice wins. */
function unslothChatSettingsLoadSettings(chatSettings, isGguf = true) {
    if (!chatSettings || typeof chatSettings !== 'object' || Array.isArray(chatSettings)) return {};
    const settings = normalizeUnslothChatSettings(chatSettings);
    return {
        ...(isGguf ? { gpu_memory_mode: settings.gpuMemoryMode } : {}),
        speculative_type: settings.speculativeType,
    };
}

function unslothLoadOverrideEndpoint(configuredUrl, loadSpec, requestedModel) {
    const endpoint = new URL(unslothApiEndpoint(configuredUrl, 'api/settings/openai-auto-switch/overrides'));
    endpoint.searchParams.set('model_id', String(loadSpec?.model_path || '').trim());
    const requested = String(requestedModel || '').trim();
    // The override store keys GGUFs by their repository id. A display alias
    // such as `unsloth/foo-UD-IQ2_XXS` must not hide a profile saved by
    // Desktop under `unsloth/foo-GGUF`.
    const aliasId = unslothLegacyAlias(requested)?.model || unslothModelVariant(requested).model || requested;
    endpoint.searchParams.set('alias_id', aliasId);
    if (loadSpec?.gguf_variant) endpoint.searchParams.set('gguf_variant', String(loadSpec.gguf_variant).trim());
    return endpoint.href;
}

function unslothModelVariant(value) {
    const raw = String(value || '').trim();
    const separator = raw.lastIndexOf(':');
    // HF ids contain one slash, while a quant pin is appended after the id.
    if (separator > raw.lastIndexOf('/') && separator > 0 && separator < raw.length - 1) {
        return { model: raw.slice(0, separator), variant: raw.slice(separator + 1) };
    }
    return { model: raw, variant: '' };
}

function unslothModelKey(value) {
    return String(value || '').trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function unslothWithoutGguf(value) {
    return String(value || '').replace(/-gguf$/i, '');
}

// Older Desktop releases persisted GGUF selections as
// `<repo-without-GGUF>-<quant>` instead of keeping the repository and variant
// in separate fields. Keep this conservative and only infer the repository for
// an Unsloth-style Hub id; ordinary model names may legitimately contain '-Q'.
function unslothLegacyAlias(value) {
    const raw = String(value || '').trim();
    const match = raw.match(/^(unsloth\/[^:]+?)-(UD-[A-Z0-9]+(?:[-_][A-Z0-9]+)*|Q\d(?:_[A-Z0-9]+)*|IQ\d(?:_[A-Z0-9]+)*|BF16|F(?:16|32)|MXFP\d(?:_[A-Z0-9]+)*)$/i);
    if (!match) return null;
    const base = match[1].replace(/-gguf$/i, '');
    return { model: `${base}-GGUF`, variant: match[2] };
}

function unslothLooksLocalPath(value) {
    const raw = String(value || '').trim();
    return /^[A-Za-z]:[\\/]/.test(raw) || raw.startsWith('\\\\') || raw.startsWith('/');
}

function unslothTailKeys(value) {
    const raw = unslothModelKey(value).replace(/[\\/]+$/, '');
    const split = unslothModelVariant(raw);
    const tail = unslothModelKey(split.model).split(/[\\/]/).pop().replace(/\.(?:gguf|safetensors|bin)$/i, '');
    const baseTail = tail.replace(/-gguf(?=-|$)/i, '');
    const keys = new Set([tail, baseTail]);
    if (split.variant) {
        // Desktop commonly exposes a GGUF as `repo-GGUF:quant`, while a
        // custom-file scan exposes the same choice as `repo-quant.gguf`.
        // Include both normalized tails so the local file wins the inventory
        // lookup before the Hub/catalog fallback is considered.
        keys.add(`${tail}-${split.variant}`);
        keys.add(`${baseTail}-${split.variant}`);
    }
    for (const key of [...keys]) {
        if (key.startsWith('unsloth-')) keys.add(key.slice('unsloth-'.length));
    }
    return keys;
}

function unslothAliasMatches(alias, requested) {
    const aliasKey = unslothModelKey(alias);
    const requestedKey = unslothModelKey(requested);
    if (aliasKey && aliasKey === requestedKey) return true;
    const requestedTails = unslothTailKeys(requested);
    return [...unslothTailKeys(alias)].some(key => requestedTails.has(key));
}

function unslothEntryCandidate(entry) {
    if (typeof entry === 'string') return { modelPath: entry.trim(), variant: '', aliases: [entry.trim()] };
    if (!entry || typeof entry !== 'object') return null;
    // Desktop can surface an interrupted HF cache beside a complete custom
    // GGUF. A partial row is inventory metadata, never a valid load target.
    if (entry.partial === true) return null;
    const catalogId = [entry.id, entry.model, entry.name, entry.display_name, entry.repo_id, entry.model_id]
        .find(value => typeof value === 'string' && value.trim());
    if (!catalogId) return null;
    const modelId = String(catalogId).trim();
    const source = typeof entry.source === 'string' ? entry.source.trim().toLowerCase() : '';
    const path = typeof entry.path === 'string' && entry.path.trim() ? entry.path.trim() : '';
    const localModelId = typeof entry.model_id === 'string' && entry.model_id.trim() ? entry.model_id.trim() : '';
    const loadId = typeof entry.load_id === 'string' && entry.load_id.trim() ? entry.load_id.trim() : '';
    const cachePath = typeof entry.cache_path === 'string' && entry.cache_path.trim() ? entry.cache_path.trim() : '';
    const localEntry = source === 'models_dir' || source === 'lmstudio' || source === 'custom'
        || unslothLooksLocalPath(entry.id) || unslothLooksLocalPath(loadId);
    const modelPath = localEntry
        // LocalModelInfo.id is explicitly the identifier Desktop accepts for
        // loading. `path` only says where the scanner discovered the row.
        ? (typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : modelId)
        : localModelId || (entry.model_path && String(entry.model_path).trim()) || loadId || modelId;
    const canonicalId = [entry.repo_id, localModelId, !localEntry ? modelId : '']
        .find(value => typeof value === 'string' && value.trim() && !unslothLooksLocalPath(value)) || '';
    const variant = [entry.quant, entry.gguf_variant, entry.format_variant, entry.variant]
        .find(value => typeof value === 'string' && value.trim());
    const cleanVariant = variant ? String(variant).trim() : '';
    const aliases = [modelId, modelPath, path, cachePath, entry.display_name, entry.name, localModelId, entry.repo_id]
        .filter(value => typeof value === 'string' && value.trim());
    if (cleanVariant) {
        aliases.push(`${modelId}:${cleanVariant}`, `${modelId}-${cleanVariant}`);
        aliases.push(`${unslothWithoutGguf(modelId)}:${cleanVariant}`, `${unslothWithoutGguf(modelId)}-${cleanVariant}`);
    }
    return { modelPath, canonicalId, variant: cleanVariant, aliases, localEntry };
}

function resolveUnslothLoadSpec(requestedModel, entries, { allowLegacyInference = true } = {}) {
    const requested = unslothModelKey(requestedModel);
    const requestedRaw = String(requestedModel || '').trim();
    if (!requested) return null;
    const candidates = (Array.isArray(entries) ? entries : [])
        .map(unslothEntryCandidate)
        .filter(Boolean);
    const split = unslothModelVariant(String(requestedModel || '').trim());
    for (const candidate of candidates) {
        const modelKey = unslothModelKey(candidate.modelPath);
        const baseKeys = [modelKey, unslothModelKey(unslothWithoutGguf(candidate.modelPath)),
            unslothModelKey(candidate.canonicalId), unslothModelKey(unslothWithoutGguf(candidate.canonicalId))]
            .filter(Boolean);
        if (baseKeys.includes(unslothModelKey(split.model)) && split.variant) {
            return { model_path: candidate.modelPath, gguf_variant: split.variant, is_lora: false };
        }
        // Older versions displayed `<repo-without-GGUF>-<quant>`. Recover the
        // clean repo and the quant from the canonical /api/models/list entry.
        for (const base of baseKeys) {
            const prefix = `${base}-`;
            if (requested.startsWith(prefix) && requested.length > prefix.length) {
                return { model_path: candidate.modelPath, gguf_variant: requestedRaw.slice(prefix.length), is_lora: false };
            }
        }
    }
    // Resolve legacy `<repo-without-GGUF>-<quant>` ids before exact aliases.
    // `/v1/models` can contain that stale display id with a quant field, while
    // `/api/models/list` contains the canonical `...-GGUF` row. If exact
    // aliases win first, the stale id is sent back to AutoConfig and Desktop
    // tries to load it as a Hugging Face repository.
    const inferredVariant = split.variant || unslothLegacyAlias(requestedRaw)?.variant || '';
    const exact = candidates
        .filter(candidate => candidate.aliases.some(alias => unslothAliasMatches(alias, requestedRaw)))
        .map(candidate => ({ ...candidate, resolvedVariant: candidate.variant || inferredVariant }))
        .filter(candidate => candidate.resolvedVariant)
        .sort((a, b) => {
            const score = candidate => Number(candidate.localEntry) * 20
                + Number(/(?:^|[-_])gguf(?:$|[-_])/i.test(candidate.modelPath)) * 10;
            return score(b) - score(a);
        });
    if (exact[0]) return {
        model_path: exact[0].modelPath,
        // A standalone GGUF path already selects one exact file. Sending its
        // filename-derived quant as a second selector makes Desktop resolve it
        // like a Hub repository instead of following its local-file path.
        ...(!/\.gguf$/i.test(exact[0].modelPath) ? { gguf_variant: exact[0].resolvedVariant } : {}),
        is_lora: false,
    };
    const inferredLegacy = unslothLegacyAlias(requestedRaw);
    if (inferredLegacy && allowLegacyInference) {
        return { model_path: inferredLegacy.model, gguf_variant: inferredLegacy.variant, is_lora: false };
    }
    // A clean, variantless id is valid when Desktop can auto-select its
    // installed GGUF. Keep this fallback after legacy alias inference so a
    // stale `<repo-without-GGUF>-<quant>` entry cannot win over the canonical row.
    const exactBase = candidates.find(candidate => candidate.aliases.some(alias => unslothAliasMatches(alias, requestedRaw)));
    if (exactBase) return {
        model_path: exactBase.modelPath,
        ...(exactBase.variant && !/\.gguf$/i.test(exactBase.modelPath) ? { gguf_variant: exactBase.variant } : {}),
        is_lora: false,
    };
    return null;
}

function unslothResponseEntries(data) {
    if (Array.isArray(data)) return data;
    return [data?.data, data?.models, data?.cached].filter(Array.isArray).flat();
}

async function requestUnslothJson(url, apiKey, fetchImpl) {
    let response;
    try {
        const options = { method: 'GET', headers: unslothHeaders(apiKey), redirect: 'error' };
        if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') options.signal = AbortSignal.timeout(15000);
        response = await fetchImpl(url, options);
    } catch {
        return { ok: false, status: 0, detail: '' };
    }
    let detail = '';
    try { detail = await response.text(); } catch { }
    if (!response.ok) return { ok: false, status: response.status, detail };
    try { return { ok: true, data: detail ? JSON.parse(detail) : null }; } catch {
        return { ok: false, status: 200, detail: 'respuesta JSON inválida' };
    }
}

/** Read Desktop's persisted chat/runtime choices. Older Desktop versions may
 * not expose this endpoint, so callers treat a missing response as optional
 * and retain the documented default behavior. */
async function fetchUnslothChatSettings({ configuredUrl, apiKey, fetchImpl = fetch }) {
    const result = await requestUnslothJson(
        unslothApiEndpoint(configuredUrl, 'api/chat/settings'),
        apiKey,
        fetchImpl,
    );
    if (!result.ok || !result.data?.settings || typeof result.data.settings !== 'object' || Array.isArray(result.data.settings)) {
        return null;
    }
    return normalizeUnslothChatSettings(result.data.settings);
}

function unslothRuntimeInteger(value, minimum = 0, maximum = 1048576) {
    return unslothBoundedInteger(value, minimum, maximum);
}

/** Keep a small, non-sensitive snapshot of the settings actually accepted by
 * Desktop. `context_length` is the running llama.cpp window; the model's
 * native context length is only its theoretical upper bound. */
function parseUnslothRuntimeStatus(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const copyInteger = (name, minimum = 0, maximum = 1048576) => {
        const value = unslothRuntimeInteger(data[name], minimum, maximum);
        return value === null ? undefined : value;
    };
    const copyGpuIds = name => Array.isArray(data[name])
        && data[name].length <= 1025
        && data[name].every(id => unslothRuntimeInteger(id, 0, 1024) !== null)
        ? [...data[name]] : undefined;
    const activeModel = typeof data.active_model === 'string' ? data.active_model.trim() : '';
    const modelIdentifier = typeof data.model_identifier === 'string' ? data.model_identifier.trim() : '';
    const gpuMemoryMode = data.gpu_memory_mode === 'auto' || data.gpu_memory_mode === 'manual'
        ? data.gpu_memory_mode : undefined;
    const status = {
        ...(activeModel ? { activeModel } : {}),
        ...(modelIdentifier ? { modelIdentifier } : {}),
        ...(typeof data.is_gguf === 'boolean' ? { isGguf: data.is_gguf } : {}),
        ...(copyInteger('context_length', 1) !== undefined ? { contextLength: copyInteger('context_length', 1) } : {}),
        ...(copyInteger('native_context_length', 1) !== undefined ? { nativeContextLength: copyInteger('native_context_length', 1) } : {}),
        ...(copyInteger('max_context_length', 1) !== undefined ? { maxContextLength: copyInteger('max_context_length', 1) } : {}),
        ...(copyInteger('requested_context_length') !== undefined ? { requestedContextLength: copyInteger('requested_context_length') } : {}),
        ...(gpuMemoryMode ? { gpuMemoryMode } : {}),
        ...(copyInteger('gpu_layers', -1, 1024) !== undefined ? { gpuLayers: copyInteger('gpu_layers', -1, 1024) } : {}),
        ...(copyGpuIds('gpu_ids') ? { gpuIds: copyGpuIds('gpu_ids') } : {}),
        ...(copyGpuIds('requested_gpu_ids') ? { requestedGpuIds: copyGpuIds('requested_gpu_ids') } : {}),
        ...(copyInteger('n_parallel', 1, 64) !== undefined ? { parallelSlots: copyInteger('n_parallel', 1, 64) } : {}),
    };
    return Object.keys(status).length ? status : null;
}

async function fetchUnslothRuntimeStatus({ configuredUrl, apiKey, fetchImpl = fetch }) {
    const result = await requestUnslothJson(
        unslothApiEndpoint(configuredUrl, 'api/inference/status'),
        apiKey,
        fetchImpl,
    );
    return result.ok ? parseUnslothRuntimeStatus(result.data) : null;
}

/** Read the same server-side per-model settings that Desktop uses for API
 * auto-switch loads. Missing/older settings routes are optional: the LoadRequest
 * defaults keep Unsloth's automatic GGUF fitter in control. */
async function fetchUnslothLoadSettings({ configuredUrl, loadSpec, requestedModel, apiKey, defaultSettings = {}, fetchImpl = fetch }) {
    if (!loadSpec?.model_path) return {};
    const result = await requestUnslothJson(
        unslothLoadOverrideEndpoint(configuredUrl, loadSpec, requestedModel),
        apiKey,
        fetchImpl,
    );
    const resolved = result.ok && result.data?.resolved && typeof result.data.resolved === 'object' && !Array.isArray(result.data.resolved)
        ? Object.fromEntries(Object.entries(result.data.resolved).filter(([, value]) => value != null))
        : {};
    const isGguf = /\.gguf$/i.test(String(loadSpec.model_path)) || !!loadSpec.gguf_variant;
    // Resolve context only after the model's raw override has inherited the
    // global GPU mode, just as the Desktop picker does.
    return unslothLoadSettings({ ...defaultSettings, ...resolved }, isGguf);
}

/** Resolve legacy/display model ids to the clean path + GGUF variant expected by Desktop. */
async function fetchUnslothLoadSpec({ configuredUrl, requestedModel, apiKey, fetchImpl = fetch }) {
    const requested = String(requestedModel || '').trim();
    if (!requested) throw new Error('Unsloth necesita un modelo seleccionado.');
    const modelsUrl = unslothEndpoint(configuredUrl, 'models');
    const primary = await requestUnslothJson(modelsUrl, apiKey, fetchImpl);
    if (!primary.ok) {
        if (primary.status === 0) throw new Error('No se pudo conectar con Unsloth Desktop. Comprueba que esté abierto y que la dirección guardada sea correcta.');
        throw new Error(unslothHttpError(primary.status, primary.detail, !!apiKey?.trim()));
    }
    const primaryEntries = unslothResponseEntries(primary.data);
    // Ask the local inventory first. Its `id`/`path` is the load target that
    // Desktop itself discovered, so an already-downloaded GGUF never gets
    // redirected through a guessed Hub path. The general catalog remains the
    // fallback for models that are installed only in Desktop's Hub.
    for (const route of ['api/models/local', 'api/models/cached-gguf', 'api/models/list']) {
        const result = await requestUnslothJson(unslothApiEndpoint(configuredUrl, route), apiKey, fetchImpl);
        if (result.ok) {
            // Resolve each authoritative inventory on its own. Mixing the stale
            // `/v1/models` display alias into this pass let it win after the
            // first successful but unrelated `/api/models/local` response, so
            // Desktop received the alias before cached/list could publish the
            // real target.
            const resolved = resolveUnslothLoadSpec(requested, unslothResponseEntries(result.data), { allowLegacyInference: false });
            if (resolved) return resolved;
        }
    }
    const resolved = unslothLegacyAlias(requested)
        ? null
        : resolveUnslothLoadSpec(requested, primaryEntries, { allowLegacyInference: false });
    if (resolved) return resolved;
    const split = unslothModelVariant(requested);
    // A legacy `<repo-without-GGUF>-<quant>` value is only a display alias. If
    // Desktop did not publish a real local/catalog target, sending that alias
    // makes AutoConfig treat it as a nonexistent Transformers repository.
    if (unslothLegacyAlias(requested)) {
        throw new Error('Unsloth no publicó un destino cargable para el modelo seleccionado. Actualiza el catálogo o vuelve a seleccionar el modelo en Unsloth Desktop.');
    }
    return { model_path: split.model, ...(split.variant ? { gguf_variant: split.variant } : {}), is_lora: false };
}

function parseUnslothModels(data) {
    const entries = Array.isArray(data) ? data : data?.data || data?.models || [];
    if (!Array.isArray(entries)) throw new Error('Unsloth devolvió un catálogo de modelos inválido.');
    const models = new Map();
    for (const entry of entries) {
        const rawId = typeof entry === 'string' ? entry : entry?.id || entry?.name;
        if (typeof rawId !== 'string' || !rawId.trim()) continue;
        const quant = typeof entry?.quant === 'string' ? entry.quant.trim() : '';
        const raw = rawId.trim();
        const id = quant && !raw.toLowerCase().endsWith(`:${quant.toLowerCase()}`) ? `${raw}:${quant}` : raw;
        const contextLength = Number(entry?.context_length || entry?.max_context_length || entry?.native_context_length || 0);
        const reasoningEfforts = entry?.supportedReasoningEfforts
            ?? entry?.supported_reasoning_efforts
            ?? entry?.reasoningEfforts
            ?? entry?.reasoning_efforts
            ?? entry?.reasoningLevels
            ?? entry?.reasoning_levels;
        const capabilities = [entry?.capabilities, entry?.inputModalities, entry?.modalities].flatMap(value =>
            Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
        ).filter(value => typeof value === 'string').map(value => /^(image|vision)$/i.test(value) ? 'vision' : value.toLowerCase());
        models.set(id, {
            id, name: id, provider: 'unsloth',
            ...(capabilities.length ? { capabilities: [...new Set(capabilities)] } : {}),
            ...(Array.isArray(reasoningEfforts) ? { supportedReasoningEfforts: reasoningEfforts } : {}),
            ...(Number.isFinite(contextLength) && contextLength > 0 ? { contextLength } : {})
        });
    }
    return [...models.values()];
}

async function fetchUnslothModels({ configuredUrl, requestedUrl, apiKey, fetchImpl = fetch }) {
    const url = unslothEndpoint(configuredUrl, 'models', requestedUrl);
    let response;
    try {
        response = await fetchImpl(url, {
            method: 'GET', headers: unslothHeaders(apiKey), redirect: 'error',
            signal: AbortSignal.timeout(15000)
        });
    } catch {
        throw new Error('No se pudo conectar con Unsloth Desktop. Comprueba que esté abierto y que la dirección guardada sea correcta.');
    }
    if (!response.ok) throw new Error(unslothHttpError(response.status, await response.text(), !!apiKey?.trim()));
    return parseUnslothModels(await response.json());
}

module.exports = { UNSLOTH_DEFAULT_URL, normalizeUnslothBase, unslothEndpoint, unslothApiEndpoint, unslothControlEndpoint, unslothHeaders, unslothHttpError, shouldLoadUnslothModel, unslothLoadPayload, unslothLoadSettings, normalizeUnslothChatSettings, unslothChatSettingsLoadSettings, unslothLoadOverrideEndpoint, fetchUnslothChatSettings, fetchUnslothRuntimeStatus, parseUnslothRuntimeStatus, fetchUnslothLoadSettings, resolveUnslothLoadSpec, fetchUnslothLoadSpec, parseUnslothModels, fetchUnslothModels };
