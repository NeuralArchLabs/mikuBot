# Unsloth Desktop

Esta integración adapta la conexión OpenAI compatible de mikuInterpreterAgent a la arquitectura de mikuBot. Requiere Unsloth Desktop abierto y su API disponible.

## Configuración

1. En Unsloth Desktop, abre **Settings → API** y copia la dirección y la API key.
2. En mikuBot, abre **Ajustes → Bóveda de credenciales → Unsloth**. Introduce la dirección y la clave. La dirección predeterminada es `http://localhost:8888/v1`; también se acepta la dirección completa terminada en `/v1/chat/completions`.
3. Guarda los ajustes. La clave puede quedar vacía únicamente si has habilitado **Keyless API Access: Inference** en Unsloth.
4. Selecciona **Unsloth Desktop** en el modo Chat, Agente o Cortex Visual y actualiza los modelos. El catálogo se vuelve a consultar cada 10 segundos mientras algún modo usa Unsloth.
5. Selecciona el modelo y guarda. Si Unsloth informa una cuantización, se conserva en el identificador, por ejemplo `modelo:Q4_K_M`.

La configuración inicial de la aplicación puede completarse primero; la conexión de Unsloth se configura desde estos ajustes. No es un inicio de sesión OAuth: usa la API que ofrece Unsloth Desktop.

## Comportamiento

- Descubrimiento mediante `GET /v1/models` y generación mediante `POST /v1/chat/completions`. Si Desktop indica que el modelo no está cargado, la aplicación resuelve el destino de carga con los inventarios de Unsloth en este orden: `GET /api/models/local`, `GET /api/models/cached-gguf` y `GET /api/models/list`. Cada inventario se evalúa por separado, se ignoran entradas con `partial: true` y el alias mostrado por `/v1/models` nunca se usa por sí solo como ruta de control.
- Para un GGUF independiente registrado en una carpeta personalizada, se envía a `/api/inference/load` el `id` o `path` exacto terminado en `.gguf` que publicó Unsloth, sin añadir `gguf_variant`. Para una caché GGUF organizada por repositorio, se usa su identificador canónico junto con la variante. Esto corrige tanto selecciones antiguas como `unsloth/gemma-4-31B-it-UD-IQ2_XXS` como el formato del catálogo `unsloth/gemma-4-31B-it-GGUF:UD-IQ2_XXS`, cuando Unsloth tiene registrado el archivo local correspondiente.
- Antes de cargar, la aplicación consulta `GET /api/chat/settings` y el ajuste por modelo de `/api/settings/openai-auto-switch/overrides`. Primero aplica los valores globales que Desktop usa como respaldo (`gpuMemoryMode` y `speculativeType`) y después el perfil del modelo, que tiene prioridad. Copia únicamente campos documentados de carga: contexto, caché KV, modo y capas de GPU, CPU MoE, GPU seleccionadas, paralelismo y `llama_extra_args`. Si no existe un ajuste guardado, esos campos se omiten para que Unsloth elija automáticamente la GPU y aplique su ajuste de memoria de llama.cpp. La integración no activa ni modifica la opción global de cambio automático de modelos de Unsloth.
- La herencia se limita a las opciones de ejecución del modelo. Los mensajes se envían completos; la integración no incorpora compactación, checkpoints ni herramientas de la UI de Unsloth. Un error de contexto se muestra al usuario y no se interpreta como incompatibilidad con las herramientas nativas de mikuBot.
- Después de que `/api/inference/load` termina, la aplicación consulta `GET /api/inference/status`, registra el contexto efectivo de llama.cpp y reintenta la generación una sola vez usando `model: "default"`. El contexto nativo anunciado por el modelo no es necesariamente el contexto efectivo: con Context en Auto, Desktop puede reducirlo para que los pesos y la caché KV quepan en la memoria disponible.
- Respuestas en streaming, razonamiento y estadísticas de tokens cuando el servidor los proporciona.
- El selector común de razonamiento se muestra cuando el catálogo identifica una familia compatible. Para un servidor OpenAI-compatible que no anuncie niveles, `Auto` deja que el modelo decida; si un nivel explícito es rechazado, mikuBot reintenta una vez sin el campo opcional y conserva la respuesta con la configuración nativa del modelo.
- Herramientas nativas, historial de llamadas y resultados mediante el ejecutor existente de mikuBot. Las imágenes se envían como bloques `image_url`; los documentos conservan el procesamiento de adjuntos de la aplicación. Cada modelo debe admitir la capacidad que se solicita. Si Desktop manda un error dentro de una respuesta SSE con HTTP 200, mikuBot lo muestra como error en vez de terminar con una respuesta vacía.
- Se conserva la metadata de contexto y visión que informa el catálogo. No se fuerza un presupuesto de salida de 128 000 tokens ni el parámetro específico de Ollama `think`.
- Los cambios del catálogo reemplazan selecciones que dejaron de estar disponibles. Un catálogo vacío o un error de conexión vacía la lista visible.

## Credenciales y límites de confianza

La API key se guarda mediante la bóveda existente. Electron lee la clave guardada e inyecta la cabecera `Authorization` cuando corresponde. Sin clave, la cabecera se omite. La consulta de modelos solo acepta la dirección guardada; por eso debes guardar los cambios antes de recargar. Las peticiones no siguen redirecciones con la clave.

El descubrimiento tiene un límite de 15 segundos; una generación permite hasta 30 minutos para cargar y ejecutar modelos locales. Un error 401 indica si falta la clave o si fue rechazada. Las herramientas mantienen las autorizaciones y restricciones del ejecutor de mikuBot.

## Validación

`npm run test:unsloth` prueba los componentes reales de proveedor, IPC y HTTP contra un servidor local de prueba: catálogo, cuantización, metadata, claves, acceso sin clave, herramientas, imágenes, streaming, uso, errores 401 y bloqueo de redirecciones. También cubre alias obsoletos, cachés parciales, rutas GGUF de carpetas personalizadas, transferencia de los ajustes de ejecución guardados por Unsloth, conservación del historial enviado, contexto efectivo y errores emitidos dentro de SSE. `npm run verify` incluye estas pruebas.

Estas pruebas no miden la calidad ni las capacidades de un modelo instalado por el usuario. La inferencia real requiere una instancia de Unsloth Desktop y un modelo compatible.

Referencia: [Unsloth Desktop y su API compatible](https://unsloth.ai/).
