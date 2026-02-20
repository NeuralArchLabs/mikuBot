export const EASTER_EGG_EMOJIS = {
    left: ['🧠', '🌌', '🧬', '🔮', '📡', '🧪', '💠', '🪐', '🌑', '🧿', '🌀', '💎'],
    right: ['✨', '🌌', '🌸', '🚀', '🎭', '🎨', '🌟', '💫', '☄️', '🔥', '🌈', '🛸']
};

export const MIKU_FACE = "≈̼^.┬.̼^≈‿⟆";

export const getRandomSignature = () => {
    const l = EASTER_EGG_EMOJIS.left[Math.floor(Math.random() * EASTER_EGG_EMOJIS.left.length)];
    const r = EASTER_EGG_EMOJIS.right[Math.floor(Math.random() * EASTER_EGG_EMOJIS.right.length)];
    return `${l}${MIKU_FACE}${r}`;
};
