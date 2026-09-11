# ChatGPT / Codex en MikuCentral

MikuCentral integra el **Codex App Server oficial** para usar el acceso a Codex de tu cuenta de ChatGPT. Los modelos disponibles y los límites dependen de tu cuenta; el consumo se comparte con tus otros clientes de Codex. Esta conexión no convierte tu suscripción en saldo de la API de OpenAI.

## Conectar

1. Ejecuta la aplicación de escritorio (`npm run electron:dev` durante desarrollo).
2. En **Ajustes → Bóveda de Credenciales**, abre la pestaña **ChatGPT** y pulsa **Iniciar sesión con ChatGPT**.
3. Completa la autenticación en el navegador. Al regresar, la tarjeta mostrará la cuenta conectada.
4. Selecciona **ChatGPT (Codex)** como proveedor del modo Chat o Agente y elige uno de los modelos obtenidos de tu cuenta.

La tarjeta permite cancelar un inicio pendiente, actualizar los límites y cerrar la sesión. Los porcentajes muestran el uso restante; una cuota que el servidor no facilita se presenta como no disponible. Reinicia MikuCentral después de actualizar esta integración, porque el puente de Electron se carga al arrancar.

## Funcionamiento

- El paquete oficial `@openai/codex` está incluido como dependencia de producción. Su ejecutable se extrae del archivo ASAR al empaquetar la app.
- Electron mantiene una conexión JSONL por entrada/salida estándar con `codex app-server`. No se expone un servidor de inferencia a la red.
- Codex gestiona OAuth, almacenamiento de credenciales y renovación de la sesión. Su directorio es `codex` dentro de la carpeta de datos de MikuCentral; esta sesión es independiente de la del CLI o de la aplicación Codex del usuario. Miku no lee ni copia los tokens al renderer, a `config.json` ni a los respaldos del proyecto.
- Cada solicitud usa una conversación efímera y recibe el historial de Miku. Las llamadas a herramientas regresan al flujo existente de aprobación y ejecución de Miku. Codex no recibe acceso a entornos de ejecución propios.
- El `app-server` mantiene activo `features.code_mode_host` porque Codex usa ese host interno para enrutar `dynamicTools`. Esto no habilita el shell ni el acceso a archivos de Codex: la solicitud se inicia con `environments` y `selectedCapabilityRoots` vacíos, las funciones integradas permanecen bloqueadas y Miku valida, aprueba y ejecuta cada herramienta.
- Si la sesión o cuota falla al usar Codex, la solicitud se detiene sin activar el proveedor de respaldo configurado.
- Las imágenes usan las capacidades anunciadas por cada modelo. El modo navegador de Vite no ofrece autenticación ni inferencia Codex; usa Electron.
- El selector de razonamiento usa la metadata `supportedReasoningEfforts` de `model/list` y no agrega niveles por documentación externa. `max` o `ultra` solo aparecen cuando Codex los anuncia para el modelo seleccionado. `Auto` omite el override de `effort` y conserva el nivel predeterminado del modelo; los valores elegidos se envían como `effort` en `turn/start`.
- Codex recibe además `summary: auto` cuando el razonamiento está activo para solicitar el resumen público que llega por `item/reasoning/summaryTextDelta`. Con `none` se envía `summary: none`. El resumen aparece dentro del mensaje como un bloque visual separado llamado `Pensamiento`, con un tono distinto al razonamiento nativo, y se conserva en cada turno del historial para que el agente pueda tener en cuenta las acciones ya realizadas. Se trata de un resumen público, nunca de la cadena privada de pensamiento; el canal `item/reasoning/textDelta` sigue siendo privado del proveedor y se ignora.

La habilidad Python **Deep Research** mantiene su propio transporte de modelos, pero puede usar Codex mediante un puente local temporal administrado por Electron y Unsloth mediante otro puente local que conserva la API key y la lógica de carga dentro de Electron. Ambos puentes escuchan únicamente en `127.0.0.1`, usan tokens efímeros y se cierran al terminar la ejecución. El chat, el modo Agente y sus herramientas habituales usan directamente sus integraciones respectivas.

El icono `public/chatgptICON.png` es el icono oficial de ChatGPT distribuido por OpenAI y se usa sin modificaciones; sus marcas pertenecen a OpenAI.

## Desarrollo y diagnóstico

Ejecuta `npm install`, `npm run test:codex` y `npm run verify`. No pegues archivos de credenciales en reportes de errores. Si falta el ejecutable, reinstala las dependencias opcionales de npm y reinicia la app; también se puede configurar `MIKU_CODEX_PATH` con la ruta absoluta de un ejecutable oficial compatible.

Referencias oficiales: [Codex App Server](https://learn.chatgpt.com/docs/app-server), [autenticación y almacenamiento](https://learn.chatgpt.com/docs/auth).

## Compatibilidad con los términos de OpenAI

Esta integración usa la ruta que OpenAI documenta para incorporar Codex a un producto propio: el **Codex App Server**. El servidor oficial gestiona el flujo OAuth de ChatGPT, conserva y renueva las credenciales, expone el estado de la cuenta y permite consultar los límites de Codex mediante su protocolo JSON-RPC.

La implementación de MikuCentral sigue ese diseño:

- Incluye el paquete oficial `@openai/codex` y ejecuta `codex app-server` por `stdio`.
- Inicia sesión con `account/login/start` usando el modo administrado `chatgpt`.
- Consulta los límites con `account/rateLimits/read`.
- Deja el almacenamiento y la renovación de tokens al proceso oficial de Codex.
- No lee ni copia tokens, no llama directamente al backend de ChatGPT y no expone un servidor remoto de inferencia.

OpenAI indica que Codex está incluido en los planes de ChatGPT y que la aplicación de escritorio, la CLI y las extensiones usan el inicio de sesión con ChatGPT para el acceso basado en suscripción. El App Server se publica expresamente para integraciones profundas dentro de productos propios. Estas referencias describen el mecanismo utilizado aquí y son distintas de una integración no oficial que reutilice endpoints privados o extraiga una sesión de otro cliente.

El uso sigue sujeto a los [Términos de uso de OpenAI](https://openai.com/policies/terms-of-use/). La cuenta debe ser de un solo usuario; MikuCentral no comparte, revende ni alquila el acceso, no intenta eludir límites o controles de seguridad y no ofrece los tokens a otras aplicaciones o personas. Si el producto se transforma en un servicio multiusuario, un proxy público o un mecanismo para superar las cuotas, habría que revisar de nuevo la autorización y los términos aplicables.

Fuentes oficiales consultadas:

- [Codex App Server](https://learn.chatgpt.com/docs/app-server)
- [Autenticación de Codex](https://learn.chatgpt.com/docs/auth)
- [Usar Codex con tu plan de ChatGPT](https://help.openai.com/es-419/articles/11369540-uso-de-codex-con-tu-plan-de-chatgpt)
- [Términos de uso de OpenAI](https://openai.com/policies/terms-of-use/)
