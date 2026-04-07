export const EMOJI_ANIMATIONS: Record<string, string> = {
    // === Magia / Destellos ===
    '✨': 'emoji-anim-sparkle',
    '💫': 'emoji-anim-spin-pulse',
    '🌟': 'emoji-anim-star-spin',
    '🪄': 'emoji-anim-wand-wave',
    '🌠': 'emoji-anim-shooting-star',
    
    // === Fuego / Energía / Clima ===
    '🔥': 'emoji-anim-flicker',
    '⚡': 'emoji-anim-flash',
    '💥': 'emoji-anim-explode',
    '🌙': 'emoji-anim-swing',
    '☀️': 'emoji-anim-radiate',
    '🌧️': 'emoji-anim-rain',
    '❄️': 'emoji-anim-breathe-subtle',
    '🌪️': 'emoji-anim-tornado',
    '🌈': 'emoji-anim-rainbow',
    
    // === Emociones / Corazones ===
    '❤️': 'emoji-anim-heartbeat',
    '💖': 'emoji-anim-heartbeat-fast',
    '💕': 'emoji-anim-float-heart',
    '💔': 'emoji-anim-break',
    '💘': 'emoji-anim-strike',
    
    // === Expresiones Faciales ===
    '🤔': 'emoji-anim-think-bob',
    '🧐': 'emoji-anim-think-bob',
    '👀': 'emoji-anim-look-around',
    '😎': 'emoji-anim-cool-slide',
    '😂': 'emoji-anim-laugh-shake',
    '😭': 'emoji-anim-cry-tremble',
    '😴': 'emoji-anim-sleep-z',
    '🤯': 'emoji-anim-mind-blown',
    '🤐': 'emoji-anim-zip',
    
    // === Tecnología / Sistema ===
    '💻': 'emoji-anim-glitch',
    '🖥️': 'emoji-anim-glitch',
    '⌨️': 'emoji-anim-type',
    '⚙️': 'emoji-anim-spin',
    '🔧': 'emoji-anim-wrench',
    '📡': 'emoji-anim-radar',
    '🔋': 'emoji-anim-charge',
    '🔌': 'emoji-anim-plug',
    '💾': 'emoji-anim-save',
    '🔒': 'emoji-anim-lock',
    '🔓': 'emoji-anim-unlock',
    '📱': 'emoji-anim-vibrate',
    
    // === Ciencia / Laboratorio ===
    '🧪': 'emoji-anim-bubble',
    '🧬': 'emoji-anim-dna-spin',
    '🔬': 'emoji-anim-focus',
    '💡': 'emoji-anim-lightbulb',
    '🧠': 'emoji-anim-pulse-glow',
    '🧲': 'emoji-anim-magnet-pull',
    
    // === Movimiento / Viajes ===
    '🚀': 'emoji-anim-rocket',
    '🛸': 'emoji-anim-ufo-hover',
    '🚁': 'emoji-anim-spin-fast',
    '🏃': 'emoji-anim-run',
    '🏎️': 'emoji-anim-zoom',
    '🌍': 'emoji-anim-earth-spin',
    '🌎': 'emoji-anim-earth-spin',
    '🌏': 'emoji-anim-earth-spin',
    
    // === Alertas / Estados ===
    '✅': 'emoji-anim-pop-in',
    '✔️': 'emoji-anim-pop-in',
    '❌': 'emoji-anim-shake-error',
    '⚠️': 'emoji-anim-warning',
    '🚨': 'emoji-anim-siren',
    '🛑': 'emoji-anim-stop',
    '🔔': 'emoji-anim-ring',
    '🎯': 'emoji-anim-target-hit',
    
    // === Objetos / Herramientas ===
    '📚': 'emoji-anim-book-flip',
    '✏️': 'emoji-anim-write',
    '📷': 'emoji-anim-flash',
    '🔑': 'emoji-anim-key-turn',
    '🛡️': 'emoji-anim-shield-pulse',
    '⚔️': 'emoji-anim-clash',
    '💎': 'emoji-anim-diamond-shine',
    '👑': 'emoji-anim-crown',
    
    // === Animales ===
    '🐛': 'emoji-anim-bug-wiggle',
    '🦋': 'emoji-anim-butterfly-flap',
    '🐢': 'emoji-anim-slow-walk',
    '🐾': 'emoji-anim-paw-steps',
    
    // === Gestos ===
    '👋': 'emoji-anim-wave',
    '👍': 'emoji-anim-thumbs-up',
    '👎': 'emoji-anim-thumbs-down',
    '🙌': 'emoji-anim-praise',
    '👏': 'emoji-anim-clap',
    '💪': 'emoji-anim-flex',
    '🤌': 'emoji-anim-italian',
    
    // === Fantasía / Otros ===
    '👻': 'emoji-anim-ghost-float',
    '👽': 'emoji-anim-alien-wobble',
    '🤖': 'emoji-anim-robot-nod',
    '👾': 'emoji-anim-pixel-bounce',
    '🎉': 'emoji-anim-party-tada',
    
    // === FALLBACK GENÉRICO ===
    'default': 'emoji-anim-breathe'
};

/**
 * Utility function to dynamically map an emoji inside the signature to its corresponding animation class.
 * @param emoji The raw emoji character
 * @returns The localized animation CSS class from the dictionary
 */
export const getEmojiAnimationClass = (emoji: string): string => {
    // 1. Exact match attempt
    if (EMOJI_ANIMATIONS[emoji]) {
        return EMOJI_ANIMATIONS[emoji];
    }
    
    // 2. Variation-agnostic fallback match
    // Strips \uFE0F and \uFE0E (invisible presentation selectors) from both the input and the dictionary keys
    const cleanEmoji = emoji.replace(/[\uFE0E\uFE0F]/g, '');
    for (const [key, val] of Object.entries(EMOJI_ANIMATIONS)) {
        if (key.replace(/[\uFE0E\uFE0F]/g, '') === cleanEmoji) {
            return val;
        }
    }
    
    // 3. Fallback to generic breathing animation
    return EMOJI_ANIMATIONS['default'];
};
