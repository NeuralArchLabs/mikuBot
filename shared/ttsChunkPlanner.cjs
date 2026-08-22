'use strict';

const STARTUP_TARGET = 40;
const STARTUP_FIRST_MAX = 80;
const STARTUP_FOURTH_TARGET = 80;
const STARTUP_FOURTH_MAX = 120;
const STEADY_MAX = 160;
const MIN_STARTUP_CHUNK = 12;
const MIN_TAIL = 18;
const BEAM_WIDTH = 96;

const ANY_END_PUNCTUATION = /[.,;:!?，。！？；：、]["')\]）”’]*$/u;

const LATIN_ABBREVIATIONS = new Set([
    'aprox', 'approx', 'art', 'ca', 'dr', 'dra', 'ej', 'etc', 'fig', 'inc',
    'ing', 'jr', 'lic', 'ltd', 'min', 'mr', 'mrs', 'ms', 'núm', 'num', 'pág',
    'pag', 'prof', 'ref', 'seg', 'sr', 'sra', 'srta', 'ud', 'uds', 'vol', 'vs'
]);

const UNSAFE_PREVIOUS_WORDS = {
    es: new Set([
        'a', 'al', 'ante', 'bajo', 'con', 'contra', 'de', 'del', 'desde', 'durante',
        'en', 'entre', 'hacia', 'hasta', 'mediante', 'para', 'por', 'según', 'sin',
        'sobre', 'tras', 'vía', 'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
        'este', 'esta', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas', 'aquel',
        'aquella', 'aquellos', 'aquellas', 'mi', 'mis', 'tu', 'tus', 'su', 'sus',
        'nuestro', 'nuestra', 'nuestros', 'nuestras', 'cada', 'todo', 'toda', 'todos',
        'todas', 'algún', 'alguna', 'algunos', 'algunas', 'ningún', 'ninguna', 'y',
        'e', 'o', 'u', 'ni', 'que', 'si', 'como', 'cuando', 'aunque', 'pero', 'sino',
        'mientras', 'porque', 'pues', 'no', 'se', 'me', 'te', 'le', 'les', 'nos',
        'lo', 'muy', 'más', 'menos', 'tan', 'bastante', 'demasiado', 'poco', 'algo',
        'casi', 'apenas', 'es', 'son', 'era', 'eran', 'fue', 'fueron', 'será',
        'serán', 'está', 'están', 'estaba', 'estaban', 'ha', 'han', 'había',
        'habían', 'puede', 'pueden', 'podía', 'podían', 'podría', 'podrían', 'debe',
        'deben', 'debía', 'debían', 'debería', 'deberían', 'quiere', 'quieren',
        'quería', 'querían', 'va', 'van', 'vamos', 'voy', 'suele', 'suelen', 'sigue',
        'siguen', 'permite', 'permiten'
    ]),
    en: new Set([
        'a', 'an', 'the', 'this', 'that', 'these', 'those', 'my', 'your', 'his',
        'her', 'its', 'our', 'their', 'of', 'to', 'for', 'from', 'in', 'on', 'at',
        'by', 'with', 'without', 'through', 'during', 'across', 'about', 'into',
        'onto', 'over', 'under', 'and', 'or', 'nor', 'but', 'if', 'while', 'because',
        'although', 'though', 'when', 'who', 'which', 'whose', 'whom', 'not', 'no',
        'very', 'more', 'most', 'less', 'least', 'too', 'quite', 'rather', 'almost',
        'each', 'every', 'all', 'some', 'any', 'many', 'much', 'few', 'several',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had',
        'do', 'does', 'did', 'can', 'could', 'will', 'would', 'shall', 'should',
        'may', 'might', 'must'
    ])
};

const AUXILIARY_WORDS = {
    es: new Set([
        'es', 'son', 'era', 'eran', 'fue', 'fueron', 'será', 'serán', 'está',
        'están', 'estaba', 'estaban', 'ha', 'han', 'había', 'habían', 'puede',
        'pueden', 'podía', 'podían', 'podría', 'podrían', 'debe', 'deben', 'debía',
        'debían', 'debería', 'deberían', 'quiere', 'quieren', 'quería', 'querían',
        'va', 'van', 'vamos', 'voy', 'suele', 'suelen', 'sigue', 'siguen'
    ]),
    en: new Set([
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'has', 'have', 'had',
        'do', 'does', 'did', 'can', 'could', 'will', 'would', 'shall', 'should',
        'may', 'might', 'must'
    ])
};

const ENGLISH_ATTRIBUTIVE_WORDS = new Set([
    'big', 'brief', 'complete', 'current', 'different', 'early', 'final', 'first',
    'full', 'good', 'great', 'high', 'important', 'initial', 'large', 'last',
    'little', 'long', 'main', 'major', 'new', 'next', 'old', 'possible', 'previous',
    'quick', 'recent', 'same', 'short', 'simple', 'small', 'special', 'specific'
]);

const SPANISH_DEGREE_MODIFIERS = new Set([
    'muy', 'más', 'menos', 'tan', 'bastante', 'demasiado', 'casi'
]);

function languagePrefix(lang) {
    return (lang || 'es').split('-')[0].toLowerCase();
}

function spokenLength(text) {
    return Array.from(text).length;
}

function normalizeWhitespace(text) {
    return text.replace(/\s+/gu, ' ').trim();
}

function addBoundary(boundaries, position, rank, kind) {
    if (!Number.isInteger(position) || position <= 0) return;
    const previous = boundaries.get(position);
    if (!previous || rank > previous.rank) {
        boundaries.set(position, { position, rank, kind });
    }
}

function addMatches(boundaries, text, regex, rank, kind, positionAtEnd = false, accept = null) {
    let match;
    while ((match = regex.exec(text)) !== null) {
        const position = positionAtEnd ? match.index + match[0].length : match.index;
        if (!accept || accept(match, position)) {
            addBoundary(boundaries, position, rank, kind);
        }
        if (match[0].length === 0) regex.lastIndex++;
    }
}

function buildProtectedDepth(text) {
    const depthAt = new Uint16Array(text.length + 1);
    const opening = new Set(['(', '[', '（', '【', '“', '‘']);
    const closing = new Set([')', ']', '）', '】', '”', '’']);
    let depth = 0;
    let straightDoubleQuoteOpen = false;

    for (let index = 0; index < text.length; index++) {
        const character = text[index];
        if (closing.has(character)) depth = Math.max(0, depth - 1);
        if (character === '"') straightDoubleQuoteOpen = !straightDoubleQuoteOpen;
        if (opening.has(character)) depth++;
        depthAt[index + 1] = depth + (straightDoubleQuoteOpen ? 1 : 0);
    }
    return depthAt;
}

function isProtectedPeriod(text, index) {
    const previous = text[index - 1] || '';
    const next = text[index + 1] || '';
    if (/\d/u.test(previous) && /\d/u.test(next)) return true;
    if (/\p{L}/u.test(previous) && /\p{L}/u.test(next)) return true;

    const previousWord = text.slice(Math.max(0, index - 96), index)
        .match(/([\p{L}]+)$/u)?.[1]?.toLowerCase() || '';
    if (LATIN_ABBREVIATIONS.has(previousWord)) return true;

    const compactPrefix = text.slice(Math.max(0, index - 8), index + 1).toLowerCase();
    return /(?:\b(?:e\.g|i\.e|p\.ej|a\.m|p\.m)\.|(?:\b[\p{L}]\.){2,})$/u.test(compactPrefix);
}

function addPunctuationBoundaries(boundaries, text) {
    let match;
    const terminal = /[.!?;。！？；]+["')\]）”’]*/gu;
    while ((match = terminal.exec(text)) !== null) {
        const punctuationIndex = match.index;
        if (match[0][0] !== '.' || !isProtectedPeriod(text, punctuationIndex)) {
            addBoundary(boundaries, match.index + match[0].length, 6, 'terminal');
        }
    }

    const clause = /[,;:，；：、]+["')\]）”’]*/gu;
    while ((match = clause.exec(text)) !== null) {
        const punctuationIndex = match.index;
        const numericSeparator = /\d/u.test(text[punctuationIndex - 1] || '')
            && /\d/u.test(text[punctuationIndex + 1] || '');
        if (!numericSeparator) {
            addBoundary(boundaries, match.index + match[0].length, 5, 'clause');
        }
    }
}

function latinWordAt(text, position, backwards) {
    // Boundary classification only needs the adjacent token. Limit the slice
    // so collecting thousands of boundaries remains linear for long reports.
    const side = backwards
        ? text.slice(Math.max(0, position - 96), position)
        : text.slice(position, Math.min(text.length, position + 96));
    const match = backwards
        ? side.match(/([\p{L}\p{N}]+)[^\p{L}\p{N}]*$/u)
        : side.match(/^[^\p{L}\p{N}]*([\p{L}\p{N}]+)/u);
    return (match?.[1] || '').toLowerCase();
}

function wordBoundaryRank(text, position, lang, protectedDepth) {
    if (protectedDepth[position] > 0) return 0;
    const prefix = languagePrefix(lang);
    if (prefix === 'zh') {
        const previous = text[position - 1] || '';
        const next = text[position] || '';
        return /[的地得不很更最把被在和与及或但而为向从对将已正可会能要]/u.test(previous)
            || /[的地得]/u.test(next)
            ? 0
            : 1;
    }

    const previous = latinWordAt(text, position, true);
    const next = latinWordAt(text, position, false);
    const unsafePrevious = UNSAFE_PREVIOUS_WORDS[prefix] || UNSAFE_PREVIOUS_WORDS.es;
    const auxiliaryWords = AUXILIARY_WORDS[prefix] || AUXILIARY_WORDS.es;
    let previousCharacterIndex = position - 1;
    while (previousCharacterIndex >= 0 && /\s/u.test(text[previousCharacterIndex])) previousCharacterIndex--;
    const followsAbbreviation = text[previousCharacterIndex] === '.' && LATIN_ABBREVIATIONS.has(previous);
    const unfinishedVerb = prefix === 'en'
        ? /(?:ing|ed)$/u.test(previous)
        : /(?:ando|iendo|yendo)$/u.test(previous);
    const unfinishedModifier = prefix === 'en'
        ? ENGLISH_ATTRIBUTIVE_WORDS.has(previous)
            || /(?:ly|al|ial|ical|ful|less|ous|ive|able|ible|ary|ory|ent|ant|ic)$/u.test(previous)
        : /mente$/u.test(previous);
    return followsAbbreviation
        || unsafePrevious.has(previous)
        || auxiliaryWords.has(next)
        || unfinishedVerb
        || unfinishedModifier
        ? 0
        : 1;
}

function collectBoundaries(text, lang) {
    const boundaries = new Map();
    const protectedDepth = buildProtectedDepth(text);
    const outsideProtectedSpan = (_match, position) => protectedDepth[position] === 0;

    addPunctuationBoundaries(boundaries, text);

    const prefix = languagePrefix(lang);
    if (prefix === 'en') {
        addMatches(boundaries, text, /\b(?:but|although|however|nevertheless|therefore|thus|so|because|while|when|meanwhile|after|before|in\s+addition|for\s+example|on\s+the\s+other\s+hand|as\s+a\s+result|in\s+fact|moreover|instead)\b/giu, 4, 'connector', false, outsideProtectedSpan);
        addMatches(boundaries, text, /\b(?:that|which|who|whom|whose|where|whereby)\b/giu, 3, 'relative', false, outsideProtectedSpan);
        addMatches(boundaries, text, /\b(?:with|without|through|using|including|during|across|from|into|onto|under|over)\b/giu, 3, 'phrase', false, outsideProtectedSpan);
        addMatches(
            boundaries,
            text,
            /\b(?:not|never|no\s+longer)\b/giu,
            3,
            'phrase',
            false,
            (match, position) => outsideProtectedSpan(match, position)
                && !UNSAFE_PREVIOUS_WORDS.en.has(latinWordAt(text, position, true))
        );
        addMatches(boundaries, text, /\b(?:a|an|the|this|these|those|each|every|all|some|many|several)\b/giu, 2, 'noun-phrase', false, outsideProtectedSpan);
        addMatches(
            boundaries,
            text,
            /\b[\p{L}]{4,}ing\b/giu,
            4,
            'phrase',
            false,
            (match, position) => outsideProtectedSpan(match, position)
                && !UNSAFE_PREVIOUS_WORDS.en.has(latinWordAt(text, position, true))
        );
    } else if (prefix === 'zh') {
        addMatches(boundaries, text, /但是|不过|然而|因此|所以|因为|同时|随后|此外|例如|也就是说|另一方面|尽管|如果|当/gu, 4, 'connector', false, outsideProtectedSpan);
    } else {
        addMatches(boundaries, text, /\b(?:pero|aunque|sin\s+embargo|no\s+obstante|por\s+(?:lo\s+)?tanto|por\s+eso|además|mientras(?:\s+tanto)?|porque|cuando|después\s+de\s+que|antes\s+de\s+que|al\s+mismo\s+tiempo)\b/giu, 4, 'connector', false, outsideProtectedSpan);
        addMatches(boundaries, text, /\b(?:que|quien|quienes|cuyo|cuya|cuyos|cuyas|donde)\b/giu, 3, 'relative', false, outsideProtectedSpan);
        addMatches(boundaries, text, /\b(?:con|sin|sobre|entre|desde|hasta|mediante|durante|para|hacia|bajo|tras)\b/giu, 3, 'phrase', false, outsideProtectedSpan);
        addMatches(
            boundaries,
            text,
            /\b(?:no|nunca|jamás)\b/giu,
            3,
            'phrase',
            false,
            (match, position) => outsideProtectedSpan(match, position)
                && !AUXILIARY_WORDS.es.has(latinWordAt(text, position, true))
        );
        addMatches(boundaries, text, /\b(?:el|la|los|las|un|una|unos|unas|este|esta|estos|estas|ese|esa|esos|esas|cada|todo|toda|todos|todas|algún|alguna|algunos|algunas)\b/giu, 2, 'noun-phrase', false, outsideProtectedSpan);
        addMatches(
            boundaries,
            text,
            /\b(?:muy|más|menos|tan|bastante|demasiado|casi)\b/giu,
            2,
            'modifier-phrase',
            false,
            (match, position) => outsideProtectedSpan(match, position)
                && !SPANISH_DEGREE_MODIFIERS.has(latinWordAt(text, position, true))
        );
        addMatches(
            boundaries,
            text,
            /\b(?!cuando\b)[\p{L}]{2,}(?:ando|iendo|yendo)\b/giu,
            4,
            'phrase',
            false,
            (match, position) => outsideProtectedSpan(match, position)
                && !UNSAFE_PREVIOUS_WORDS.es.has(latinWordAt(text, position, true))
        );
    }

    if (prefix === 'zh') {
        if (typeof Intl.Segmenter === 'function') {
            const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
            for (const segment of segmenter.segment(text)) {
                if (!segment.isWordLike) continue;
                const position = segment.index + segment.segment.length;
                if (position < text.length) {
                    addBoundary(boundaries, position, wordBoundaryRank(text, position, lang, protectedDepth), 'word');
                }
            }
        }
    } else {
        let match;
        const whitespace = /\s+/gu;
        while ((match = whitespace.exec(text)) !== null) {
            addBoundary(boundaries, match.index, wordBoundaryRank(text, match.index, lang, protectedDepth), 'word');
        }
    }

    addBoundary(boundaries, text.length, 7, 'end');
    return [...boundaries.values()].sort((a, b) => a.position - b.position);
}

function canonicalSlice(text, start, end) {
    return text.slice(start, end).trim();
}

function spokenSlice(text, start, boundary, lang) {
    const canonical = canonicalSlice(text, start, boundary.position);
    if (!canonical || boundary.kind === 'end' || ANY_END_PUNCTUATION.test(canonical)) {
        return canonical;
    }
    // Virtual punctuation exists only in the synthesized copy. It gives a
    // prosodic landing to phrase/word fallbacks without changing source text.
    return canonical + (languagePrefix(lang) === 'zh' ? '，' : ',');
}

function emergencyBoundary(text, start, maxLength) {
    let position = start;
    let count = 0;
    for (const character of text.slice(start)) {
        if (count >= maxLength) break;
        position += character.length;
        count++;
    }
    return { position, rank: 0, kind: 'emergency' };
}

function firstBoundaryAfter(boundaries, position) {
    let low = 0;
    let high = boundaries.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (boundaries[middle].position <= position) low = middle + 1;
        else high = middle;
    }
    return low;
}

function cappedRemainingLength(text, position) {
    // Tail scoring only distinguishes a remainder shorter than MIN_TAIL.
    // Avoid repeatedly allocating/counting the complete remainder of a long
    // answer for every beam candidate.
    if (text.length - position > MIN_TAIL * 2) return MIN_TAIL + 1;
    return spokenLength(canonicalSlice(text, position, text.length));
}

function remainingFitsWithin(text, position, limit) {
    if (text.length - position > limit * 2) return false;
    return spokenLength(canonicalSlice(text, position, text.length)) <= limit;
}

function candidatesForChunk(text, boundaries, start, maxLength, minLength, lang) {
    const candidates = [];
    const firstCandidate = firstBoundaryAfter(boundaries, start);
    for (let index = firstCandidate; index < boundaries.length; index++) {
        const boundary = boundaries[index];
        const spoken = spokenSlice(text, start, boundary, lang);
        const length = spokenLength(spoken);
        if (length > maxLength) break;
        if (length >= minLength || boundary.position === text.length) {
            candidates.push({ boundary, spoken, canonical: canonicalSlice(text, start, boundary.position), length });
        }
    }

    if (candidates.length === 0 && start < text.length) {
        const boundary = emergencyBoundary(text, start, Math.max(1, maxLength - 1));
        const spoken = spokenSlice(text, start, boundary, lang);
        candidates.push({ boundary, spoken, canonical: canonicalSlice(text, start, boundary.position), length: spokenLength(spoken) });
    }
    return candidates;
}

function startupTargetForStage(stage, lengths) {
    if (stage === 0) return STARTUP_TARGET;
    if (stage === 1) return lengths[0];
    if (stage === 2) return lengths[0] + lengths[1];
    return Math.min(STARTUP_FOURTH_TARGET, lengths[0] + lengths[1] + lengths[2]);
}

function startupMaxForStage(stage, lengths) {
    if (stage === 0) return STARTUP_FIRST_MAX;
    if (stage === 1) return lengths[0];
    if (stage === 2) return lengths[0] + lengths[1];
    return Math.min(STARTUP_FOURTH_MAX, lengths[0] + lengths[1] + lengths[2]);
}

function candidateStartupCost(candidate, stage, lengths, remainingLength) {
    const target = startupTargetForStage(stage, lengths);
    const naturalityWeight = stage < 2 ? 350 : 280;
    const distanceWeight = stage === 0 ? 80 : stage === 1 ? 30 : stage === 2 ? 18 : 12;
    const unsafePenalty = candidate.boundary.rank === 0 ? 100000 : 0;
    const emergencyPenalty = candidate.boundary.kind === 'emergency' ? 250000 : 0;
    const naturalityPenalty = (6 - Math.min(candidate.boundary.rank, 6)) * naturalityWeight;
    const distancePenalty = Math.abs(candidate.length - target) * distanceWeight;
    const tinyPenalty = candidate.length < 20 ? (20 - candidate.length) * 80 : 0;
    const tailPenalty = remainingLength > 0 && remainingLength < MIN_TAIL ? (MIN_TAIL - remainingLength) * 120 : 0;
    return unsafePenalty + emergencyPenalty + naturalityPenalty + distancePenalty + tinyPenalty + tailPenalty;
}

function validateStartupLengths(lengths) {
    if (lengths.length > 1 && lengths[1] > lengths[0]) return false;
    if (lengths.length > 2 && lengths[2] > lengths[0] + lengths[1]) return false;
    return true;
}

function planStartup(text, boundaries, lang) {
    let beam = [{ end: 0, spoken: [], canonical: [], lengths: [], cost: 0, kinds: [] }];
    const finished = [];

    for (let stage = 0; stage < 4; stage++) {
        const expanded = [];
        for (const state of beam) {
            if (state.end >= text.length) {
                finished.push(state);
                continue;
            }

            const maxLength = startupMaxForStage(stage, state.lengths);
            const candidates = candidatesForChunk(text, boundaries, state.end, maxLength, MIN_STARTUP_CHUNK, lang);
            for (const candidate of candidates) {
                const lengths = [...state.lengths, candidate.length];
                if (!validateStartupLengths(lengths)) continue;
                const remainingLength = cappedRemainingLength(text, candidate.boundary.position);
                expanded.push({
                    end: candidate.boundary.position,
                    spoken: [...state.spoken, candidate.spoken],
                    canonical: [...state.canonical, candidate.canonical],
                    lengths,
                    kinds: [...state.kinds, candidate.boundary.kind],
                    cost: state.cost + candidateStartupCost(candidate, stage, state.lengths, remainingLength)
                });
            }
        }

        if (expanded.length === 0) break;
        expanded.sort((a, b) => a.cost - b.cost);
        beam = expanded.slice(0, BEAM_WIDTH);
    }

    const completedChoices = [...finished, ...beam]
        .filter(state => state.spoken.length > 0 && state.end >= text.length)
        .sort((a, b) => a.cost - b.cost);
    const incompleteChoices = beam
        .filter(state => state.spoken.length > 0)
        .sort((a, b) => a.cost - b.cost);

    const best = completedChoices[0]
        || incompleteChoices[0]
        || { end: 0, spoken: [], canonical: [], lengths: [], kinds: [], cost: 0 };
    if (!validateStartupLengths(best.lengths)) {
        throw new Error(`Invalid TTS startup plan: ${best.lengths.join(', ')}`);
    }
    return best;
}

function chooseStableCandidate(text, boundaries, start, lang) {
    const candidates = candidatesForChunk(text, boundaries, start, STEADY_MAX, 1, lang);
    if (candidates.length === 0) return null;

    if (remainingFitsWithin(text, start, STEADY_MAX)) {
        return candidates.find(candidate => candidate.boundary.position === text.length) || candidates[candidates.length - 1];
    }

    const candidateCost = candidate => {
        const remaining = cappedRemainingLength(text, candidate.boundary.position);
        const tailPenalty = remaining > 0 && remaining < MIN_TAIL ? 2000 : 0;
        const unsafePenalty = candidate.boundary.rank === 0 ? 100000 : 0;
        const emergencyPenalty = candidate.boundary.kind === 'emergency' ? 250000 : 0;
        const naturalityPenalty = (6 - Math.min(candidate.boundary.rank, 6)) * 250;
        const distancePenalty = (STEADY_MAX - candidate.length) * 8;
        return unsafePenalty + emergencyPenalty + naturalityPenalty + distancePenalty + tailPenalty;
    };

    return candidates.reduce((best, candidate) => (
        candidateCost(candidate) < candidateCost(best) ? candidate : best
    ));
}

function planTtsChunks(cleanedText, lang = 'es') {
    const text = normalizeWhitespace(cleanedText || '');
    if (!text) return [];

    const boundaries = collectBoundaries(text, lang);
    const startup = planStartup(text, boundaries, lang);
    const chunks = [...startup.spoken];
    let position = startup.end;

    while (position < text.length) {
        const candidate = chooseStableCandidate(text, boundaries, position, lang);
        if (!candidate || candidate.boundary.position <= position) {
            const emergency = emergencyBoundary(text, position, STEADY_MAX - 1);
            const spoken = spokenSlice(text, position, emergency, lang);
            if (!spoken) break;
            chunks.push(spoken);
            position = emergency.position;
            continue;
        }
        chunks.push(candidate.spoken);
        position = candidate.boundary.position;
    }

    const lengths = chunks.map(spokenLength);
    if (!validateStartupLengths(lengths.slice(0, 3))) {
        throw new Error(`TTS startup invariants failed: ${lengths.slice(0, 3).join(', ')}`);
    }
    if (lengths.some(length => length > STEADY_MAX)) {
        throw new Error(`TTS chunk limit failed: ${lengths.join(', ')}`);
    }
    return chunks;
}

const ttsChunkPlannerApi = {
    planTtsChunks,
    spokenLength,
    _internal: {
        collectBoundaries,
        validateStartupLengths
    }
};

// Electron consumes this file through CommonJS, while Vite's development
// server executes workspace source files as native browser modules. Expose
// the same implementation to both runtimes without maintaining two planners.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ttsChunkPlannerApi;
}
if (typeof globalThis !== 'undefined') {
    globalThis.__MIKUCENTRAL_TTS_CHUNK_PLANNER__ = ttsChunkPlannerApi;
}
