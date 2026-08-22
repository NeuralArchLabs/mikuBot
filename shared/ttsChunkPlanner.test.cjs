'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { planTtsChunks, spokenLength } = require('./ttsChunkPlanner.cjs');

function assertPipelineInvariants(chunks) {
    const lengths = chunks.map(spokenLength);
    assert.ok(chunks.every(Boolean), 'chunks must never be empty');
    if (lengths.length > 1) {
        assert.ok(lengths[1] <= lengths[0], `chunk 1 (${lengths[1]}) must be <= chunk 0 (${lengths[0]})`);
    }
    if (lengths.length > 2) {
        assert.ok(lengths[2] <= lengths[0] + lengths[1], `chunk 2 (${lengths[2]}) must be <= chunks 0+1 (${lengths[0] + lengths[1]})`);
    }
    assert.ok(lengths[0] <= 80, `first chunk must remain incremental: ${lengths[0]}`);
    assert.ok(lengths.every(length => length <= 160), `every chunk must stay <= 160: ${lengths.join(', ')}`);
}

function planAndAssert(text, lang) {
    const chunks = planTtsChunks(text, lang);
    assertPipelineInvariants(chunks);
    return chunks;
}

function withoutVirtualPause(text) {
    return text.replace(/[,，]$/u, '').trim();
}

function assertNoBoundaryBetween(chunks, leftPattern, rightPattern, description) {
    for (let index = 0; index < chunks.length - 1; index++) {
        const left = withoutVirtualPause(chunks[index]);
        const right = chunks[index + 1].trim();
        assert.ok(
            !(leftPattern.test(left) && rightPattern.test(right)),
            `${description}: ${JSON.stringify(chunks[index])} | ${JSON.stringify(chunks[index + 1])}`
        );
    }
}

test('jointly plans the lunar-scene regression without unnatural noun split', () => {
    const text = 'Aquí tienes a tu intrépido compañero canino explorando la superficie lunar con su traje espacial personalizado, dejando huellas sobre el polvo blanco mientras la Tierra brilla intensamente en la inmensidad, ¿te gusta cómo quedó la escena o prefieres que ajustemos algún detalle (como el tipo de casco, el perro o el fondo)?';
    const chunks = planTtsChunks(text, 'es');

    assertPipelineInvariants(chunks);
    assert.deepEqual(chunks.slice(0, 3), [
        'Aquí tienes a tu intrépido compañero canino,',
        'explorando la superficie lunar,',
        'con su traje espacial personalizado, dejando huellas sobre el polvo blanco,'
    ]);
});

test('keeps a short first sentence from being followed by a larger second chunk', () => {
    const text = 'Entiendo perfectamente tu punto. Mi respuesta anterior fue una síntesis de alto nivel, ideal para un resumen rápido, pero no cumple con la profundidad que requiere un análisis serio.';
    const chunks = planTtsChunks(text, 'es');
    assertPipelineInvariants(chunks);
});

test('preserves the same startup invariants in English', () => {
    const text = 'Here is your brave canine companion exploring the lunar surface with a personalized space suit, leaving footprints in the white dust while Earth shines brightly in the distance. Would you like us to adjust the helmet or the background?';
    const chunks = planTtsChunks(text, 'en');
    assertPipelineInvariants(chunks);
    assert.equal(chunks[0], 'Here is your brave canine companion,');
});

test('uses Chinese punctuation and connectors without requiring spaces', () => {
    const text = '这是你的勇敢伙伴，它穿着定制的宇航服探索月球表面，同时在白色尘埃上留下脚印，远处的地球闪耀着明亮的光芒。你希望我们调整头盔还是背景？';
    const chunks = planTtsChunks(text, 'zh');
    assertPipelineInvariants(chunks);
    assert.ok(chunks.some(chunk => /[，。！？]$/u.test(chunk)));
});

test('bounds long punctuation-free text through startup and steady state', () => {
    const sentence = 'Este bloque deliberadamente carece de signos internos y contiene suficientes palabras para comprobar que el planificador mantiene todos los límites incluso cuando debe recurrir a fronteras de frase seguras ';
    const chunks = planTtsChunks(sentence.repeat(12).trim() + '.', 'es');
    assertPipelineInvariants(chunks);
});

test('handles very short replies without manufacturing empty chunks', () => {
    const chunks = planTtsChunks('Sí.', 'es');
    assert.deepEqual(chunks, ['Sí.']);
});

test('does not separate Spanish or English auxiliaries from their verbs', () => {
    const spanish = planAndAssert(
        'La plataforma de análisis distribuido está procesando todas las solicitudes recibidas mientras mantiene la reproducción completamente estable para cada usuario conectado.',
        'es'
    );
    assertNoBoundaryBetween(spanish, /\bestá$/iu, /^procesando\b/iu, 'Spanish auxiliary must stay with its gerund');

    const english = planAndAssert(
        'The distributed analysis platform is processing all incoming requests while keeping playback completely stable for every connected user.',
        'en'
    );
    assertNoBoundaryBetween(english, /\bis$/iu, /^processing\b/iu, 'English auxiliary must stay with its gerund');
});

test('does not separate Spanish or English negation and modality from the predicate', () => {
    const spanish = planAndAssert(
        'La plataforma de análisis distribuido no puede procesar correctamente todas las solicitudes recibidas cuando la conexión presenta errores intermitentes.',
        'es'
    );
    assertNoBoundaryBetween(spanish, /\bno$/iu, /^puede\b/iu, 'Spanish negation must stay with its modal verb');

    const english = planAndAssert(
        'The distributed analysis platform will not process every incoming request correctly when the connection experiences intermittent errors.',
        'en'
    );
    assertNoBoundaryBetween(english, /\bwill$/iu, /^not\b/iu, 'English auxiliary must stay with negation');
    assertNoBoundaryBetween(english, /\bnot$/iu, /^process\b/iu, 'English negation must stay with its predicate');
});

test('never treats the decimal point as a terminal boundary', () => {
    const chunks = planAndAssert(
        'El sensor registró exactamente 3.14159265 unidades durante la primera medición y después confirmó el mismo resultado mediante una segunda prueba controlada con instrumentos calibrados.',
        'es'
    );
    assertNoBoundaryBetween(chunks, /\b\d+\.$/u, /^\d/u, 'A decimal number must remain in one spoken chunk');
});

test('never treats a title abbreviation as a sentence boundary', () => {
    const spanish = planAndAssert(
        'Hoy consultamos al reconocido Dr. Ramírez para comprender todos los resultados del estudio y preparar una respuesta detallada para el equipo completo.',
        'es'
    );
    assertNoBoundaryBetween(spanish, /\bDr\.$/iu, /^Ramírez\b/iu, 'Spanish title must stay with the surname');

    const english = planAndAssert(
        'Today we consulted the renowned Dr. Henderson to understand every result in the study and prepare a detailed response for the entire team.',
        'en'
    );
    assertNoBoundaryBetween(english, /\bDr\.$/iu, /^Henderson\b/iu, 'English title must stay with the surname');
});

test('does not leave determiners, prepositions, or infinitive markers dangling', () => {
    const spanish = planAndAssert(
        'El sistema está procesando continuamente todas las solicitudes recibidas desde distintas regiones mientras mantiene la consistencia de los datos y responde a cada usuario sin introducir pausas innecesarias en la reproducción completa.',
        'es'
    );
    assertNoBoundaryBetween(spanish, /\btodas las$/iu, /^solicitudes\b/iu, 'Spanish determiner must stay with its noun');

    const english = planAndAssert(
        'The system is processing continuously every request received from different regions while maintaining data consistency and responding to each user without introducing unnecessary pauses in the complete playback.',
        'en'
    );
    assertNoBoundaryBetween(english, /\bevery$/iu, /^request\b/iu, 'English determiner must stay with its noun');
    assertNoBoundaryBetween(english, /\bevery$/iu, /^incoming\b/iu, 'English determiner must stay with its complete noun phrase');
    assertNoBoundaryBetween(english, /\bincoming$/iu, /^request\b/iu, 'English modifier must stay with its noun');
    assertNoBoundaryBetween(english, /\bwithout$/iu, /^introducing\b/iu, 'English preposition must stay with its complement');

    const infinitive = planAndAssert(
        'The modular distributed processing architecture allows multiple simultaneous operations to remain coordinated with sufficient stability throughout long and complex sessions.',
        'en'
    );
    assertNoBoundaryBetween(infinitive, /\bto$/iu, /^remain\b/iu, 'Infinitive marker must stay with its verb');
});

test('keeps multiword modifiers and attributive phrases intact', () => {
    const spanish = planAndAssert(
        'Esta es una frase corta que termina aquí. Luego empieza otra frase bastante más extensa que contiene información adicional para comprobar el comportamiento del sistema.',
        'es'
    );
    assertNoBoundaryBetween(spanish, /\bbastante$/iu, /^más\b/iu, 'Spanish degree modifiers must remain together');
    assertNoBoundaryBetween(spanish, /\bmás$/iu, /^extensa\b/iu, 'Spanish degree phrase must stay with its adjective');

    const english = planAndAssert(
        'Hello this is a moderately short complete sentence that should ideally remain a single synthesized unit.',
        'en'
    );
    assertNoBoundaryBetween(english, /\bshort$/iu, /^complete\b/iu, 'English attributive modifiers must remain together');
    assertNoBoundaryBetween(english, /\bcomplete$/iu, /^sentence\b/iu, 'English adjective must stay with its noun');
    assertNoBoundaryBetween(english, /\bideally$/iu, /^remain\b/iu, 'English adverb must stay with its predicate');
});

test('does not introduce phrase boundaries that break parenthetical syntax', () => {
    const innerClause = planAndAssert(
        'El nuevo sistema de generación (que utiliza varios procesos coordinados para sintetizar el audio) funciona correctamente durante sesiones largas.',
        'es'
    );
    assertNoBoundaryBetween(innerClause, /\(que$/iu, /^utiliza\b/iu, 'Relative pronoun must stay with its parenthetical predicate');

    const closingParenthesis = planAndAssert(
        'La configuración principal (incluyendo el modelo seleccionado, la voz asignada y la velocidad elegida por el usuario) debe conservarse correctamente durante toda la reproducción.',
        'es'
    );
    assertNoBoundaryBetween(closingParenthesis, /\)$/u, /^debe\b/iu, 'Parenthetical subject must stay with its predicate');
});

test('does not split a Chinese word when punctuation is unavailable', () => {
    const chunks = planAndAssert(
        '中华人民共和国中央人民政府今天宣布将继续推进高质量发展战略并通过技术创新改善公共服务保障社会稳定促进区域协调发展提升人民生活水平实现长期可持续增长目标',
        'zh'
    );
    assert.ok(chunks.some(chunk => chunk.includes('改善')), `Chinese word 改善 must remain intact: ${chunks.join(' | ')}`);
    assertNoBoundaryBetween(chunks, /改$/u, /^善/u, 'Chinese word 改善 must not cross a chunk boundary');
});
