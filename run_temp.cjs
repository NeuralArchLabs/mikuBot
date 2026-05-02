
const formatting = require('./temp_formatting.js');

const input = `### 1. **Qwen 3** (Abril 2025) — El rey actual del local
La familia Qwen 3 es probablemente lo más importante que pasó en open-source LLMs. Entrenada con **36T tokens en 119 idiomas**, ofrece modelos densos y MoE (Mixture of Experts):

| Modelo | Tipo | VRAM (Q4) | En tu 2070 (8GB) | En tu 3060 (12GB) | Con P40 (24GB) |
|---|---|---|---|---|---|
| **Qwen3-8B** | Denso | ~5-6GB | ✅ **Corre perfecto** | ✅ Sobrado | ✅ |
| **Qwen3-14B** | Denso | ~10GB | ❌ | ✅ **Ajusta** | ✅ |
| **Qwen3-32B** | Denso | ~20GB | ❌ | ❌ | ✅ **Ajusta** |
| **Qwen3-30B-A3B** | MoE | ~19-24GB | ❌ | ❌ | ✅ **Calidad 30B, velocidad 3B** |`;

// We just need convertTablesToHtml
console.log('--- RAW INPUT ---');
console.log(input);
console.log('--- OUTPUT convertTablesToHtml ---');
console.log(formatting.convertTablesToHtml(input));

// Also let's try the full pipeline
console.log('--- OUTPUT toHtml ---');
try {
    console.log(formatting.toHtml(input));
} catch(e) {
    console.log("Could not run full toHtml due to missing imports:", e.message);
}
