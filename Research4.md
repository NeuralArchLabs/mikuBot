# **Arquitectura de Agentes Autónomos Locales: Implementación de Memoria Persistente Automodificable y Ejecución de Herramientas en TypeScript con Ollama**

## **1\. Introducción a la Soberanía de la Inteligencia Artificial Local**

La evolución de los Grandes Modelos de Lenguaje (LLMs) ha transitado desde sistemas pasivos de recuperación de información hacia arquitecturas agénticas capaces de razonar, planificar y ejecutar acciones sobre su entorno. En el contexto del desarrollo de software actual, la transición de un "chatbot" tradicional a un "agente autónomo" representa un salto cualitativo fundamental: el sistema deja de ser un mero espectador de la conversación para convertirse en un actor con capacidad de agencia.1 Para desarrolladores que buscan privacidad, baja latencia y control total sobre los datos, la ejecución de estos sistemas en entornos locales utilizando herramientas como Ollama y tiempos de ejecución como Node.js se ha convertido en el estándar de oro de la soberanía tecnológica.2

El objetivo central de este informe es desglosar, con exhaustividad técnica, la metodología para transformar un asistente personal basado en inyección de contexto estática en una entidad dinámica capaz de la "automodificación". Este concepto implica que el modelo no solo lee su memoria, sino que posee las facultades técnicas para reescribir sus propios archivos de definición, actualizar preferencias de usuario y evolucionar su comportamiento a lo largo del tiempo sin intervención humana directa.3 A diferencia de los sistemas en la nube, donde la gestión de memoria suele estar abstraída por bases de datos vectoriales propietarias, la implementación local exige una orquestación precisa de operaciones de sistema de archivos, gestión de concurrencia y validación estricta de esquemas.4

Además, la integración de capacidades de "llamada a funciones" (tool calling) en modelos locales ha democratizado el acceso a patrones de diseño complejos que anteriormente eran dominio exclusivo de modelos propietarios como GPT-4. Sin embargo, dotar a un modelo local de acceso a la consola del sistema y a la escritura de archivos introduce vectores de riesgo significativos que deben ser mitigados mediante arquitecturas de seguridad de "confianza cero" y entornos aislados (sandboxing).5 Este documento abordará la implementación técnica en TypeScript, aprovechando la tipificación estática para garantizar la integridad de las interacciones entre el modelo probabilístico y el sistema determinista.

## ---

**2\. Fundamentos Teóricos de la Agencia Local y el Bucle Cognitivo**

### **2.1 Del Chatbot Estateless al Agente Recursivo**

La distinción fundamental entre un chatbot y un agente radica en el manejo del estado y la recursividad. Un chatbot opera típicamente en un ciclo lineal de solicitud-respuesta donde el estado se limita a la ventana de contexto inyectada en cada turno. Por el contrario, un agente implementa un bucle cognitivo continuo, frecuentemente conceptualizado bajo el marco ReAct (Razonamiento \+ Actuación) o el ciclo OODA (Observar, Orientar, Decidir, Actuar).1 En este paradigma, el modelo no genera una respuesta final inmediatamente; primero evalúa si necesita herramientas externas para satisfacer la solicitud.

En el entorno de Node.js y TypeScript, este bucle no es una abstracción teórica, sino una implementación de flujo de control while(true) o recursiva. El sistema inyecta el estado actual de la memoria, el modelo "razona" sobre la necesidad de actualizar dicho estado, emite una solicitud de ejecución de herramienta (como update\_memory\_file), el entorno de ejecución procesa esta solicitud de manera asíncrona y devuelve el resultado al modelo. Solo entonces el modelo decide si la tarea está completa o si se requiere una nueva iteración.7 Este proceso transforma la memoria de ser un "documento de referencia" a ser un "organismo vivo" que evoluciona con cada interacción.

### **2.2 El Papel de Ollama como Motor de Inferencia Estructurada**

Ollama ha emergido como la pieza central en la infraestructura de IA local debido a su capacidad para exponer modelos cuantizados a través de una API compatible con OpenAI, simplificando drásticamente la integración de llamadas a herramientas.8 La capacidad crítica que Ollama aporta a este proyecto es la *imposición de gramáticas* y el manejo de tokens especiales de herramientas.

Cuando un modelo local como Qwen 2.5 o Llama 3.1 es instruido para usar una herramienta, no "ejecuta" la herramienta por sí mismo. En su lugar, genera una salida estructurada (típicamente JSON) que se adhiere a un esquema predefinido.10 Ollama se encarga de detener la generación tan pronto como se completa este bloque JSON, permitiendo que el software anfitrión (la app en TypeScript) intercepte el flujo, ejecute la lógica de negocio (como escribir en el disco) y devuelva la salida. Sin esta capa de abstracción, el desarrollador tendría que parsear texto libre y lidiar con alucinaciones de formato, lo cual haría inviable la modificación confiable de archivos de sistema.7

### **2.3 Persistencia Políglota: JSON vs. Markdown Semántico**

Para un sistema de memoria automodificable, la elección del formato de almacenamiento es una decisión arquitectónica crítica. Existen dos escuelas de pensamiento dominantes en 2025-2026: el almacenamiento estructurado rígido (JSON) y el almacenamiento semántico flexible (Markdown).

El enfoque JSON favorece la precisión programática. Permite actualizaciones atómicas de campos específicos (ej. usuario.preferencias.tema \= "oscuro"), lo cual es ideal para configuraciones del sistema. Sin embargo, los LLMs a menudo luchan con la sintaxis estricta de JSON en archivos grandes, propendiendo a errores de sintaxis si el archivo se trunca.11 Por otro lado, el enfoque de Markdown (popularizado por herramientas como AGENTS.md) trata la memoria como un documento narrativo. Esto es más natural para el LLM, permitiéndole "escribir un diario" de sus interacciones. Para un asistente personal robusto, la arquitectura recomendada es híbrida: JSON para configuraciones críticas y Markdown para la memoria episódica y semántica a largo plazo.12

## ---

**3\. Implementación Técnica de Llamadas a Funciones (Tool Calling)**

La implementación de llamadas a funciones en un entorno local requiere una comprensión profunda de cómo se definen, transmiten y procesan los esquemas de herramientas entre el cliente TypeScript y el servidor de inferencia Ollama. No se trata simplemente de "pedirle" al modelo que haga algo, sino de establecer un contrato estricto de interfaz.

### **3.1 Definición de Esquemas en TypeScript con Zod**

Para garantizar que el modelo respete la estructura de datos requerida para modificar archivos, es imperativo utilizar bibliotecas de validación de esquemas como Zod. Esto permite definir la "forma" de la función en TypeScript y exportarla automáticamente a un esquema JSON que Ollama pueda interpretar.14

La definición de la herramienta debe incluir no solo los parámetros, sino descripciones semánticas ricas. Los modelos de lenguaje modernos utilizan estas descripciones para inferir *cuándo* utilizar la herramienta. Por ejemplo, para una función de actualización de memoria, la descripción no debe ser simplemente "Escribe un archivo", sino "Utilice esta herramienta cuando necesite persistir un nuevo hecho sobre el usuario o actualizar una preferencia existente para futuras sesiones".7

A continuación se presenta una tabla que desglosa los componentes críticos de una definición de herramienta para Ollama:

| Componente del Esquema | Propósito Técnico | Importancia para el Modelo Local |
| :---- | :---- | :---- |
| **Name** | Identificador único de la función (ej. update\_memory). | Actúa como el token de activación. Modelos como Qwen son sensibles a nombres claros y descriptivos en inglés o *snake\_case*. |
| **Description** | Contexto semántico de la utilidad. | Es el "prompt" implícito de la herramienta. Una descripción ambigua llevará a que el modelo ignore la herramienta o la use incorrectamente. |
| **Parameters (Type)** | Define la estructura de datos (Object). | Obliga al modelo a pensar en términos de clave-valor estructurado en lugar de prosa libre. |
| **Properties** | Los argumentos individuales (ej. key, value, filepath). | Cada propiedad debe tener su propia descripción para guiar al modelo sobre qué formato de string generar (ej. ISO 8601 para fechas). |
| **Required** | Lista de campos obligatorios. | Crítico para evitar que el modelo alucine llamadas parciales que causarían errores en tiempo de ejecución en Node.js. |

### **3.2 El Ciclo de Vida de la Ejecución (The Agent Loop)**

El núcleo de la aplicación reside en el bucle de ejecución. A diferencia de una llamada simple a la API, el manejo de herramientas requiere un flujo de control de múltiples pasos. Cuando la aplicación envía el historial de chat y las definiciones de herramientas a Ollama, la respuesta puede ser texto (para el usuario) o una solicitud de llamada a herramienta (para el sistema).8

El manejo de este flujo en TypeScript debe ser robusto. El siguiente análisis detalla las fases de este ciclo:

1. **Fase de Detección:** La respuesta de Ollama se inspecciona para verificar la presencia del array tool\_calls. Es crucial notar que los modelos modernos pueden solicitar múltiples llamadas a herramientas en paralelo (ej. leer dos archivos simultáneamente), por lo que el código debe iterar sobre este array y no asumir una sola llamada.8  
2. **Fase de Enrutamiento:** Una vez detectada la llamada, el nombre de la función actúa como un enrutador. Un switch o un mapa de objetos en TypeScript dirige la ejecución hacia la función local correspondiente (fs.writeFile, child\_process.spawn, etc.).7  
3. **Fase de Ejecución y Captura:** La función local se ejecuta. Es vital capturar tanto el éxito (stdout/valor de retorno) como el fracaso (stderr/excepción). Si la operación de archivo falla (ej. permisos denegados), este error *debe* ser devuelto al modelo como el resultado de la herramienta. Esto permite que el agente intente corregirse a sí mismo o informe al usuario del problema técnico.15  
4. **Fase de Recursión:** El resultado de la herramienta se añade al historial de mensajes con el rol tool. Inmediatamente después, se realiza una nueva llamada a la API de Ollama con el historial actualizado. Esto permite que el modelo "vea" el resultado de su acción y genere la respuesta final en lenguaje natural.7

### **3.3 Consideraciones Específicas para Modelos de Razonamiento (DeepSeek-R1)**

La introducción de modelos de razonamiento como DeepSeek-R1 introduce una complejidad adicional: el proceso de "pensamiento" (Chain of Thought). Estos modelos generan una traza de razonamiento interna antes de emitir la llamada a la herramienta. En versiones recientes de Ollama (2025-2026), esta traza se expone a veces a través de un campo thinking o etiquetas \<think\> en el flujo de texto.16

Para una implementación correcta, la aplicación debe decidir si mostrar este pensamiento al usuario (transparencia) u ocultarlo. Sin embargo, para el funcionamiento interno del agente, es crucial manejar correctamente estos tokens. Si se trunca el pensamiento, el rendimiento del modelo en la selección de herramientas se degrada significativamente. Además, al pasar el historial de vuelta al modelo en el siguiente turno, se recomienda limpiar o resumir estas trazas de pensamiento extensas para no saturar la ventana de contexto, manteniendo solo el resultado final de la acción y la intención original.18

## ---

**4\. Arquitectura de Memoria Persistente Automodificable**

La capacidad de "automodificación" es lo que otorga verdadera autonomía al agente. Sin embargo, permitir que una IA sobrescriba sus propios archivos de definición es una operación de alto riesgo que requiere una arquitectura de sistema de archivos defensiva.

### **4.1 Estrategias de Actualización Atómica**

En un entorno Node.js asíncrono, la escritura directa de archivos (usando fs.writeFile) mientras el agente intenta leerlos puede resultar en condiciones de carrera y corrupción de datos (archivos vacíos o JSON malformado). Para la memoria del agente, se debe implementar un patrón de **escritura atómica**.19

El proceso técnico consiste en tres pasos indivisibles desde la perspectiva del lector:

1. **Escritura en Temporal:** El agente escribe los nuevos datos de memoria en un archivo temporal (ej. memory.json.tmp).  
2. **Sincronización (fsync):** Se asegura que los datos se hayan volcado físicamente al disco.  
3. **Renombrado Atómico:** Se utiliza la llamada al sistema rename (que es atómica en sistemas POSIX y NTFS modernos) para reemplazar el archivo original con el temporal.

Este patrón garantiza que la memoria siempre esté en un estado válido, incluso si el proceso del agente se interrumpe abruptamente durante una actualización.

### **4.2 Gestión de Memoria JSON mediante Parches**

En lugar de permitir que el agente reescriba todo el archivo de memoria cada vez (lo cual consume muchos tokens y aumenta el riesgo de alucinación de sintaxis), se recomienda implementar una herramienta de **JSON Patch**.20

Bajo este esquema, la herramienta expuesta al modelo no es save\_memory(full\_json\_content), sino patch\_memory(path, operation, value). Por ejemplo, si el agente quiere recordar que al usuario le gusta la programación en Python, enviaría:

{ "op": "add", "path": "/user/skills/-", "value": "Python" }.

Esto reduce drásticamente la carga cognitiva del modelo y el uso de ancho de banda de E/S, delegando la complejidad de la manipulación del archivo JSON al código TypeScript determinista, que es mucho más fiable para estas tareas estructurales.

### **4.3 Memoria Semántica y Recuperación (RAG Local)**

Para memorias a largo plazo que exceden la estructura rígida de un JSON, el agente debe tener capacidad de interactuar con un almacén vectorial local o un sistema de archivos Markdown indexado. Herramientas como LanceDB o Chroma pueden ejecutarse localmente en el mismo proceso de Node.js.22

Si se opta por un enfoque más ligero basado en archivos (ej. AGENTS.md), la estrategia de actualización debe ser append-only (solo agregar). El agente utiliza una herramienta log\_interaction o add\_knowledge que añade una entrada con marca de tiempo al final del archivo Markdown. Al inicio de cada sesión, o mediante una herramienta de search\_memory, el sistema recupera los fragmentos relevantes. Esto preserva la historia de la evolución del agente y permite auditoría humana.13

## ---

**5\. Acceso a Consola y Ejecución de Comandos del Sistema**

La solicitud del usuario incluye la intención de "darle acceso a la consola al modelo local". Desde una perspectiva de ingeniería de sistemas, esto transforma al agente en un operador del sistema. Si bien es técnicamente posible mediante el módulo child\_process de Node.js, representa la superficie de ataque más crítica de la aplicación.

### **5.1 Riesgos de Seguridad de la Ejecución de Shell**

Permitir que un LLM ejecute comandos de shell arbitrarios expone el sistema a riesgos de inyección de prompt indirecta. Un atacante podría incrustar un texto invisible en una página web que el agente lee, instruyéndole a ejecutar curl malware | sh.5 Incluso sin malicia externa, los modelos pueden alucinar comandos destructivos o malinterpretar rutas de archivos (ej. ejecutar un borrado en la raíz en lugar de una subcarpeta).24

### **5.2 Implementación de una "Shell Segura" (Sandboxed)**

Para satisfacer el requerimiento de acceso a consola manteniendo la seguridad, no se debe utilizar exec de forma directa. Se debe implementar una capa de abstracción o "Safe Shell" en TypeScript.25

Esta implementación implica:

1. **Lista Blanca de Comandos:** El agente no debe tener acceso a /bin/bash o cmd.exe. Solo debe poder invocar binarios específicos pre-aprobados (ej. git, ls, grep, npm).  
2. **Desactivación de Metacaracteres:** Al utilizar spawn en Node.js, se debe configurar la opción { shell: false }. Esto fuerza a que los argumentos se pasen directamente al binario, evitando la interpretación de operadores de shell como &&, ;, o |, que son vectores comunes de inyección de comandos.27  
3. **Jaula de Directorio (Chroot-ish):** Se debe forzar que el directorio de trabajo (cwd) de todos los comandos ejecutados sea estrictamente el directorio del proyecto o una subcarpeta segura. Cualquier intento de acceder a rutas relativas superiores (../) debe ser bloqueado por la lógica de validación de la herramienta antes de la ejecución.4

### **5.3 Aislamiento mediante Contenedores (Docker)**

Para un nivel de seguridad profesional, el acceso a la consola debe delegarse a un contenedor Docker efímero. Herramientas y patrones como RunShell demuestran cómo encapsular la ejecución. En lugar de ejecutar ls en la máquina anfitriona, el agente ejecuta un comando que instancia un contenedor Docker, monta un volumen específico y ejecuta el comando dentro de ese entorno aislado. Si el agente daña el sistema de archivos, solo afecta al contenedor desechable, protegiendo el sistema operativo del usuario.26

## ---

**6\. Selección y Evaluación de Modelos Locales**

La viabilidad de un agente que modifica sus propios archivos depende enteramente de la capacidad del modelo para seguir instrucciones complejas y generar JSON válido. En 2026, el paisaje de modelos locales ofrece varias opciones competentes.

### **6.1 Comparativa de Modelos para Llamada de Herramientas**

Basado en benchmarks recientes como el *Berkeley Function Calling Leaderboard*, se destacan los siguientes modelos para esta tarea específica:

| Modelo Local | Capacidad de Tool Calling | Recomendación Técnica |
| :---- | :---- | :---- |
| **Qwen 2.5 (14B/32B)** | Sobresaliente. Es actualmente el estado del arte en modelos abiertos para adherencia a esquemas JSON y razonamiento de código. | **Elección Primaria.** Su capacidad para manejar instrucciones de sistema complejas lo hace ideal para la automodificación. |
| **Llama 3.1 / 3.3 (8B/70B)** | Alta. La versión 8B es muy eficiente pero puede requerir reintentos en esquemas anidados complejos. La versión 70B es robusta pero exigente en hardware. | Alternativa sólida si se prefiere el ecosistema Meta o se requiere un tono más "occidental". |
| **DeepSeek-R1 (Distilled)** | Especializada. Excelente para razonar *por qué* hacer un cambio, pero su formato de salida requiere un manejo especial del bloque de pensamiento. | Útil para agentes de investigación compleja, pero añade sobrecarga de parsing en el bucle de herramientas. |
| **Mistral Nemo (12B)** | Moderada. Bueno para tareas simples, pero tiende a fallar en la generación de JSON Patch complejos comparado con Qwen. | Opción de respaldo para hardware de gama media. |

El análisis indica que para un proyecto en TypeScript que requiere manipulación precisa de archivos, **Qwen 2.5-Coder** (en sus variantes 14B o 32B) ofrece el mejor equilibrio entre rendimiento y precisión sintáctica.29

## ---

**7\. Protocolo de Contexto del Modelo (MCP) y Estandarización**

Aunque es posible implementar herramientas manualmente ("hardcoded") en la aplicación, la tendencia industrial hacia 2026 es la adopción del **Model Context Protocol (MCP)**. MCP propone una arquitectura cliente-servidor estandarizada para conectar LLMs con fuentes de datos y herramientas locales.32

Implementar la memoria y el acceso a consola como servidores MCP ofrece ventajas significativas:

* **Desacoplamiento:** La lógica de lectura/escritura de archivos se separa del bucle del agente.  
* **Reusabilidad:** Se pueden utilizar servidores MCP pre-construidos y auditados por la comunidad (ej. @modelcontextprotocol/server-filesystem) en lugar de escribir implementaciones propias propensas a errores.  
* **Seguridad:** Los servidores MCP implementan sus propias capas de validación y control de acceso.

Para el proyecto actual en TypeScript, utilizar el SDK de MCP (@modelcontextprotocol/sdk) para envolver las funcionalidades de sistema de archivos permitiría que el agente sea compatible no solo con Ollama, sino con futuros clientes o interfaces de IA que soporten el protocolo, asegurando la longevidad del software.34

## ---

**8\. Guía de Implementación en TypeScript**

A continuación se detalla la estructura de código necesaria para orquestar los componentes mencionados.

### **8.1 Configuración del Cliente Ollama y Zod**

Es esencial tipar las respuestas y las herramientas. El uso de ollama-js facilita la conexión, pero la validación de los argumentos que el modelo inventa debe hacerse con Zod.

TypeScript

import { Ollama } from 'ollama';  
import { z } from 'zod';  
import { zodToJsonSchema } from 'zod-to-json-schema';

const ollama \= new Ollama({ host: 'http://127.0.0.1:11434' });

// Esquema para la herramienta de actualización de memoria  
const UpdateMemorySchema \= z.object({  
  operation: z.enum(\['add', 'update', 'delete'\]).describe('Tipo de operación a realizar en la memoria'),  
  key: z.string().describe('La clave del objeto JSON a modificar (notación de puntos)'),  
  value: z.any().describe('El valor a almacenar. Puede ser string, número o objeto JSON serializado')  
});

// Definición de la herramienta para Ollama  
const memoryTool \= {  
  type: 'function',  
  function: {  
    name: 'manage\_memory',  
    description: 'Permite al agente leer o modificar su propia memoria persistente. Úsalo para guardar preferencias del usuario o nuevos hechos aprendidos.',  
    parameters: zodToJsonSchema(UpdateMemorySchema),  
  },  
};

### **8.2 Lógica del Bucle de Agente (ReAct Loop)**

El siguiente fragmento ilustra cómo manejar la recursividad necesaria para que el agente complete tareas de múltiples pasos (ej. leer memoria \-\> pensar \-\> modificar memoria \-\> responder).

TypeScript

async function agentChatLoop(userMessage: string) {  
  const messages \= \[  
    { role: 'system', content: 'Eres un asistente autónomo capaz de gestionar tu propia memoria.' },  
    { role: 'user', content: userMessage }  
  \];

  let isInteractionComplete \= false;  
    
  while (\!isInteractionComplete) {  
    // 1\. Inferencia  
    const response \= await ollama.chat({  
      model: 'qwen2.5:14b',  
      messages: messages,  
      tools:, // Inyección de herramientas  
    });

    // Añadir respuesta del asistente al historial  
    messages.push(response.message);

    // 2\. Verificación de llamadas a herramientas  
    if (response.message.tool\_calls && response.message.tool\_calls.length \> 0) {  
      console.log('🤖 El modelo solicita ejecutar herramientas...');  
        
      for (const tool of response.message.tool\_calls) {  
        if (tool.function.name \=== 'manage\_memory') {  
          // 3\. Ejecución segura (Sandboxed)  
          const args \= tool.function.arguments;  
          // Aquí se llamaría a la función real que hace fs.readFile / fs.writeFile  
          const result \= await executeSafeMemoryOperation(args);  
            
          // 4\. Inyección del resultado  
          messages.push({  
            role: 'tool',  
            content: JSON.stringify(result),  
            // Es crucial mantener la coherencia del historial para que el modelo sepa qué pasó  
          });  
        }  
      }  
      // El bucle continúa: el modelo recibirá el resultado de la herramienta en la siguiente iteración  
    } else {  
      // Si no hay herramientas, es la respuesta final al usuario  
      console.log('Respuesta Final:', response.message.content);  
      isInteractionComplete \= true;  
    }  
  }  
}

### **8.3 Integración de Acceso a Consola Seguro**

Para el acceso a consola, la implementación debe ser extremadamente defensiva.

TypeScript

import { spawn } from 'child\_process';

async function safeConsoleExec(command: string, args: string): Promise\<string\> {  
  // Lista blanca estricta  
  const ALLOWED\_BINARIES \= \['git', 'node', 'grep', 'ls'\];  
    
  if (\!ALLOWED\_BINARIES.includes(command)) {  
    return JSON.stringify({ error: 'Comando no permitido por política de seguridad' });  
  }

  return new Promise((resolve) \=\> {  
    const process \= spawn(command, args, {  
      cwd: './safe\_workspace', // Jaula de directorio  
      shell: false, // Prevención de inyección de shell  
      timeout: 5000 // Timeout para evitar procesos colgados  
    });

    let stdout \= '';  
    let stderr \= '';

    process.stdout.on('data', (d) \=\> stdout \+= d);  
    process.stderr.on('data', (d) \=\> stderr \+= d);

    process.on('close', (code) \=\> {  
      resolve(JSON.stringify({ code, stdout, stderr }));  
    });  
  });  
}

## ---

**9\. Conclusiones y Recomendaciones de Implementación**

La construcción de un agente local automodificable en TypeScript es un desafío de ingeniería que combina la gestión de estado de sistemas distribuidos con la incertidumbre probabilística de los LLMs. El análisis exhaustivo de las tecnologías disponibles en 2025-2026 permite concluir lo siguiente:

1. **Viabilidad Técnica:** Es totalmente factible implementar las funcionalidades solicitadas utilizando Ollama como backend de inferencia y Node.js como orquestador. La clave reside en el uso estricto de esquemas JSON para las llamadas a herramientas.  
2. **Seguridad Imperativa:** Dar acceso a la consola y al sistema de archivos a un modelo de IA requiere capas de seguridad redundantes. No se debe confiar en que el modelo "se comporte bien". La seguridad debe estar garantizada por el código TypeScript (validación de rutas, listas blancas de comandos y operaciones atómicas de archivos).  
3. **Modelo Recomendado:** Para tareas de manipulación de archivos y código, la familia de modelos **Qwen 2.5** demuestra un rendimiento superior en la adherencia a instrucciones de herramientas frente a otros modelos locales de tamaño similar.  
4. **Arquitectura de Memoria:** Se recomienda un enfoque híbrido donde la configuración crítica se maneje mediante parches JSON atómicos y la memoria episódica se gestione como un registro (log) en Markdown, facilitando tanto la lectura por parte del modelo como la depuración humana.

Esta arquitectura proporciona una base sólida para un asistente personal que no solo responde preguntas, sino que evoluciona y adapta su propio entorno operativo de manera autónoma y segura en un entorno local.

#### **Fuentes citadas**

1. Building Autonomous Agents with Node.js \- Library \- Grizzly Peak Software, acceso: febrero 9, 2026, [https://www.grizzlypeaksoftware.com/library/building-autonomous-agents-with-nodejs-rhyg9ler](https://www.grizzlypeaksoftware.com/library/building-autonomous-agents-with-nodejs-rhyg9ler)  
2. Ollama's documentation \- Ollama, acceso: febrero 9, 2026, [https://docs.ollama.com/](https://docs.ollama.com/)  
3. Self-Improving Coding Agents \- Addy Osmani, acceso: febrero 9, 2026, [https://addyosmani.com/blog/self-improving-agents/](https://addyosmani.com/blog/self-improving-agents/)  
4. Building File-System Tools for AI Agents Using Node.js \+ MCP | by NonCoderSuccess, acceso: febrero 9, 2026, [https://noncodersuccess.medium.com/building-file-system-tools-for-ai-agents-using-node-js-mcp-263cf49f2efa](https://noncodersuccess.medium.com/building-file-system-tools-for-ai-agents-using-node-js-mcp-263cf49f2efa)  
5. The Lethal Trifecta: Why LLMs Pose a Major Data Breach Risk, acceso: febrero 9, 2026, [https://getthematic.com/insights/lethal-trifecta-llm-security](https://getthematic.com/insights/lethal-trifecta-llm-security)  
6. LLM agents in cybersecurity: a double-edged sword \- I-TRACING, acceso: febrero 9, 2026, [https://i-tracing.com/blog/llm-agents-cybersecurity/](https://i-tracing.com/blog/llm-agents-cybersecurity/)  
7. A quick look at tool use/function calling with Node.js and Ollama | Red Hat Developer, acceso: febrero 9, 2026, [https://developers.redhat.com/blog/2024/09/10/quick-look-tool-usefunction-calling-nodejs-and-ollama](https://developers.redhat.com/blog/2024/09/10/quick-look-tool-usefunction-calling-nodejs-and-ollama)  
8. Tool calling \- Ollama's documentation, acceso: febrero 9, 2026, [https://docs.ollama.com/capabilities/tool-calling](https://docs.ollama.com/capabilities/tool-calling)  
9. Introduction \- Ollama's documentation, acceso: febrero 9, 2026, [https://docs.ollama.com/api/introduction](https://docs.ollama.com/api/introduction)  
10. Structured Outputs \- Ollama's documentation, acceso: febrero 9, 2026, [https://docs.ollama.com/capabilities/structured-outputs](https://docs.ollama.com/capabilities/structured-outputs)  
11. READ THIS Before You Feed Another JSON File to Your LLM | by Andre Le | Medium, acceso: febrero 9, 2026, [https://medium.com/@expdal3/read-this-before-you-feed-another-json-file-to-your-llm-1d6cb846ed13](https://medium.com/@expdal3/read-this-before-you-feed-another-json-file-to-your-llm-1d6cb846ed13)  
12. Improve your AI code output with AGENTS.md (+ my best tips) \- Builder.io, acceso: febrero 9, 2026, [https://www.builder.io/blog/agents-md](https://www.builder.io/blog/agents-md)  
13. I gave an AI agent persistent memory using just markdown files — here's how it works : r/ChatGPT \- Reddit, acceso: febrero 9, 2026, [https://www.reddit.com/r/ChatGPT/comments/1qx37t7/i\_gave\_an\_ai\_agent\_persistent\_memory\_using\_just/](https://www.reddit.com/r/ChatGPT/comments/1qx37t7/i_gave_an_ai_agent_persistent_memory_using_just/)  
14. Building an AI Assistant with NodeJs: Essential Tools and Concepts \- DEV Community, acceso: febrero 9, 2026, [https://dev.to/ataur39n/building-an-ai-assistant-with-nodejs-essential-tools-and-concepts-2n2p](https://dev.to/ataur39n/building-an-ai-assistant-with-nodejs-essential-tools-and-concepts-2n2p)  
15. Agents are just “LLM \+ loop \+ tools” (it's simpler than people make it) : r/LangChain \- Reddit, acceso: febrero 9, 2026, [https://www.reddit.com/r/LangChain/comments/1mynq4a/agents\_are\_just\_llm\_loop\_tools\_its\_simpler\_than/](https://www.reddit.com/r/LangChain/comments/1mynq4a/agents_are_just_llm_loop_tools_its_simpler_than/)  
16. deepseek-r1 \- Ollama, acceso: febrero 9, 2026, [https://ollama.com/library/deepseek-r1](https://ollama.com/library/deepseek-r1)  
17. Thinking \- Ollama's documentation, acceso: febrero 9, 2026, [https://docs.ollama.com/capabilities/thinking](https://docs.ollama.com/capabilities/thinking)  
18. Thinking Mode | DeepSeek API Docs, acceso: febrero 9, 2026, [https://api-docs.deepseek.com/guides/thinking\_mode](https://api-docs.deepseek.com/guides/thinking_mode)  
19. mcollina/fast-write-atomic: Fast way to write a file atomically ... \- GitHub, acceso: febrero 9, 2026, [https://github.com/mcollina/fast-write-atomic](https://github.com/mcollina/fast-write-atomic)  
20. JSON Whisperer: Efficient JSON Editing with LLMs \- arXiv, acceso: febrero 9, 2026, [https://arxiv.org/html/2510.04717v1](https://arxiv.org/html/2510.04717v1)  
21. Stitching Giant JSONs Together with JSON Patch \- DEV Community, acceso: febrero 9, 2026, [https://dev.to/shrsv/stitching-giant-jsons-together-with-json-patch-5gmc](https://dev.to/shrsv/stitching-giant-jsons-together-with-json-patch-5gmc)  
22. The Future of AI-Native Development is Local: Inside Continue's ..., acceso: febrero 9, 2026, [https://lancedb.com/blog/the-future-of-ai-native-development-is-local-inside-continues-lancedb-powered-evolution/](https://lancedb.com/blog/the-future-of-ai-native-development-is-local-inside-continues-lancedb-powered-evolution/)  
23. Building AI Agents That Actually Remember: A Developer's Guide to Memory Management in 2025 | by Nayeem Islam | Medium, acceso: febrero 9, 2026, [https://medium.com/@nomannayeem/building-ai-agents-that-actually-remember-a-developers-guide-to-memory-management-in-2025-062fd0be80a1](https://medium.com/@nomannayeem/building-ai-agents-that-actually-remember-a-developers-guide-to-memory-management-in-2025-062fd0be80a1)  
24. Taming your shell for LLMs \- rand\[om\], acceso: febrero 9, 2026, [https://ricardoanderegg.com/posts/control-shell-permissions-llm-codex/](https://ricardoanderegg.com/posts/control-shell-permissions-llm-codex/)  
25. divagr18/SecureShell: Plug-and-play terminal security layer ... \- GitHub, acceso: febrero 9, 2026, [https://github.com/divagr18/SecureShell](https://github.com/divagr18/SecureShell)  
26. iamlongalong/runshell: RunShell \- A secure command ... \- GitHub, acceso: febrero 9, 2026, [https://github.com/iamlongalong/runshell](https://github.com/iamlongalong/runshell)  
27. Child process | Node.js v25.6.0 Documentation, acceso: febrero 9, 2026, [https://nodejs.org/api/child\_process.html](https://nodejs.org/api/child_process.html)  
28. Child Processes in Node.js: spawn, exec, fork and Use Cases | by Aditya Yadav \- Medium, acceso: febrero 9, 2026, [https://dev-aditya.medium.com/child-processes-in-node-js-spawn-exec-fork-and-use-cases-6eab4ddb9dcf](https://dev-aditya.medium.com/child-processes-in-node-js-spawn-exec-fork-and-use-cases-6eab4ddb9dcf)  
29. Best Local LLMs \- 2025 : r/LocalLLaMA \- Reddit, acceso: febrero 9, 2026, [https://www.reddit.com/r/LocalLLaMA/comments/1pwh0q9/best\_local\_llms\_2025/](https://www.reddit.com/r/LocalLLaMA/comments/1pwh0q9/best_local_llms_2025/)  
30. LLM Benchmarks April 2025 \- timetoact group, acceso: febrero 9, 2026, [https://www.timetoact-group.at/en/insights/llm-benchmarks/llm-benchmarks-april-2025](https://www.timetoact-group.at/en/insights/llm-benchmarks/llm-benchmarks-april-2025)  
31. Ultimate Guide \- The Best Small LLMs For Offline Use In 2026 \- SiliconFlow, acceso: febrero 9, 2026, [https://www.siliconflow.com/articles/en/best-small-LLMs-for-offline-use](https://www.siliconflow.com/articles/en/best-small-LLMs-for-offline-use)  
32. Building an MCP Server in TypeScript and Connecting with OpenAI \- Medium, acceso: febrero 9, 2026, [https://medium.com/@yaroslavzhbankov/building-an-mcp-server-in-typescript-and-connecting-with-chatgpt-06047bfc41f8](https://medium.com/@yaroslavzhbankov/building-an-mcp-server-in-typescript-and-connecting-with-chatgpt-06047bfc41f8)  
33. Build an MCP server \- Model Context Protocol, acceso: febrero 9, 2026, [https://modelcontextprotocol.io/docs/develop/build-server](https://modelcontextprotocol.io/docs/develop/build-server)  
34. The official TypeScript SDK for Model Context Protocol servers and clients \- GitHub, acceso: febrero 9, 2026, [https://github.com/modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk)