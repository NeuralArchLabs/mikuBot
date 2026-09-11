# Niveles de razonamiento

mikuBot mantiene una preferencia común para los modos **Chat** y **Agente**. La preferencia maestra sirve como respaldo y cada runtime puede sobrescribirla. Al cambiar de proveedor o modelo, la selección vuelve a `Auto` para no reutilizar un nivel que el nuevo modelo no anuncie.

| Valor | Comportamiento |
| --- | --- |
| `Auto` | No fuerza un parámetro; el proveedor usa el valor nativo del modelo. |
| `Desactivado` | Solicita una respuesta directa cuando el proveedor lo permite. |
| `Mínimo` / `Bajo` / `Medio` / `Alto` | Intensidad graduada normalizada. |
| `Muy alto` / `Máximo` / `Ultra` | Valores admitidos por algunos catálogos; se conservan sin degradarlos. |

La traducción se hace en el adaptador, no en el prompt:

La fuente se distingue por proveedor: cuando el catálogo devuelve capacidades
por modelo, esas capacidades tienen prioridad. Si un proveedor no publica una
lista de niveles, la interfaz usa una tabla de compatibilidad basada en la
documentación de ese proveedor y en la familia del modelo; esa tabla es una
estimación conservadora, no una declaración en tiempo real. `Auto` siempre
queda disponible para delegar la decisión al proveedor.

- **Codex:** usa `effort` de `turn/start` y muestra únicamente los niveles que devuelve `model/list` en `supportedReasoningEfforts`. La documentación externa no completa ni modifica ese catálogo: `max` o `ultra` solo aparecen si el propio proveedor los anuncia para ese modelo. Cuando el razonamiento está activo se solicita `summary: auto`; Codex decide el nivel de detalle compatible y entrega un resumen público que se presenta como un bloque `Pensamiento`, separado del razonamiento nativo, pero conservado en cada turno del historial para que el agente pueda usarlo al continuar.
- **Gemini:** usa `thinkingLevel` en Gemini 3 y `thinkingBudget` en Gemini 2.5. En modelos donde el razonamiento es obligatorio, `Desactivado` se convierte en el mínimo válido.
- **Groq y Unsloth:** envían `reasoning_effort` solo cuando se escoge un valor explícito. Si un servidor compatible rechaza el campo, se reintenta una vez sin él.
- **Ollama:** usa `think` como booleano en Qwen/DeepSeek y como nivel en GPT-OSS. Por eso Qwen/DeepSeek solo muestran `Auto` y `Desactivado`, mientras GPT-OSS muestra `Bajo`, `Medio` y `Alto`; GPT-OSS conserva el mínimo válido porque no permite desactivar el razonamiento.
- **Z.AI:** sus modelos actuales exponen un interruptor binario; `Auto` delega el valor predeterminado y `Desactivado` lo apaga. No se muestran niveles graduados que el endpoint no acepta.

La opción antigua `ollamaThink` sigue funcionando como compatibilidad de Ollama cuando el selector está en `Auto`; no modifica otros proveedores. El razonamiento recibido en los canales nativos (`reasoning_content`, `reasoning`, `thinking`, `thought`) se conserva y se muestra en el bloque de pensamiento existente. En Codex se muestra el resumen que expone el app-server; no se solicita ni se revela la cadena privada de pensamiento completa.

Referencias de los protocolos: [Codex App Server](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/typescript/v2/TurnStartParams.ts), [Codex model catalog](https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/schema/json/v2/ModelListResponse.json), [reasoning summaries de OpenAI](https://openai.com/index/new-tools-and-features-in-the-responses-api/), [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai), [Ollama Thinking](https://docs.ollama.com/capabilities/thinking), [Groq Reasoning](https://console.groq.com/docs/reasoning) y [Z.AI Thinking Mode](https://docs.z.ai/guides/capabilities/thinking-mode).
