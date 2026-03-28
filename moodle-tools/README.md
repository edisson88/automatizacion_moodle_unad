# Moodle UNAD — Automatización de Foros con UserScripts

Conjunto de scripts JavaScript (Tampermonkey/UserScript) que automatizan la gestión de foros por grupos en la plataforma Moodle de la UNAD (`campus153.unad.edu.co`). Permiten monitorear actividad nueva, analizar participaciones y enviar respuestas masivas sin interacción manual repetitiva.

---

## Tabla de contenido

- [Problema que resuelve](#problema-que-resuelve)
- [Cómo funciona a alto nivel](#cómo-funciona-a-alto-nivel)
- [Scripts disponibles](#scripts-disponibles)
- [Instalación en Tampermonkey](#instalación-en-tampermonkey)
- [Uso de cada script](#uso-de-cada-script)
  - [Monitor de grupos](#1-monitor-de-grupos)
  - [Análisis de discusiones](#2-análisis-de-discusiones)
  - [Envío masivo por grupos](#3-envío-masivo-por-grupos)
- [Arquitectura del flujo](#arquitectura-del-flujo)
- [Variables clave de Moodle](#variables-clave-de-moodle)
- [Buenas prácticas y advertencias](#buenas-prácticas-y-advertencias)
- [Ejemplos de uso](#ejemplos-de-uso)
- [Limitaciones actuales](#limitaciones-actuales)
- [Posibles mejoras futuras](#posibles-mejoras-futuras)

---

## Problema que resuelve

En los foros de la UNAD, los estudiantes deben participar activamente en múltiples grupos de trabajo. Esto implica:

- Revisar manualmente cada grupo para detectar mensajes nuevos.
- Identificar si ya se participó en una discusión o si hay respuestas posteriores.
- Responder en cada grupo de forma individual y repetitiva.

Estos scripts eliminan esa fricción: detectan actividad nueva de forma automática, identifican en qué grupos falta responder y permiten enviar el mismo mensaje a todos los grupos con un solo clic.

---

## Cómo funciona a alto nivel

```
view.php (lista de grupos)
    │
    ├── Detecta badges de mensajes nuevos por grupo
    ├── Itera sobre cada grupo disponible (groupid)
    │
    ▼
discuss.php (hilo de discusión)
    │
    ├── Extrae todos los posts del DOM
    ├── Identifica autores y detecta tu última participación
    ├── Marca mensajes posteriores a tu intervención como nuevos
    │
    ▼
post.php?reply=... (formulario de respuesta)
    │
    └── Envía FormData con message[text] + message[format]=1 (HTML)
```

Los scripts operan íntegramente en el navegador: leen el DOM de Moodle, construyen peticiones `fetch` con las mismas credenciales de sesión del usuario logueado y no requieren ningún servidor externo.

---

## Scripts disponibles

| Archivo | Tipo | Versión | Propósito |
|---|---|---|---|
| `unad-forum-monitor.user.js` | UserScript | 5.0 | Monitor principal: detecta badges azules y analiza discusiones bajo demanda |
| `moodle-monitor-grupos.js` | UserScript | 2.0 | Monitor con estado local (revisado/oculto) por ítem |
| `moodle-mass-send.js` | UserScript | 2.0 | Envío masivo del mismo mensaje a todos los grupos |
| `scrip-acceder-url-responder.js` | Script de consola | — | Extrae IDs y URLs de respuesta desde la página de discusión activa |

---

## Instalación en Tampermonkey

### Requisitos

- Navegador Chrome, Firefox o Edge.
- Extensión [Tampermonkey](https://www.tampermonkey.net/) instalada.

### Pasos

1. Abre el **Dashboard** de Tampermonkey desde el ícono en la barra del navegador.
2. Haz clic en **Crear nuevo script** (ícono `+`).
3. Borra el contenido por defecto del editor.
4. Pega el contenido del archivo `.js` correspondiente.
5. Guarda con `Ctrl + S`.
6. Navega a la URL del foro en Moodle — el script se activa automáticamente.

> Los scripts con cabecera `// ==UserScript==` se instalan directamente. El archivo `scrip-acceder-url-responder.js` es un snippet de consola: se ejecuta pegándolo en las DevTools (`F12 → Consola`).

### URL de activación

Todos los UserScripts están configurados para ejecutarse en:

```
https://campus153.unad.edu.co/ses69/mod/forum/view.php*
```

Si tu curso usa una ruta diferente (otro `ses`), actualiza la directiva `@match` en la cabecera del script.

---

## Uso de cada script

### 1. Monitor de grupos

**Archivo:** `unad-forum-monitor.user.js` (v5.0) o `moodle-monitor-grupos.js` (v2.0)

Al navegar a `view.php`, aparece un botón flotante azul en la esquina inferior derecha:

```
[ Revisar grupos ]
```

**Al hacer clic:**

1. El script itera sobre todos los grupos disponibles en la página.
2. Detecta discusiones que tienen el **badge azul** de mensajes nuevos.
3. Muestra un panel lateral con:
   - Nombre del grupo.
   - Cantidad de mensajes nuevos detectados.
   - Enlace directo a la discusión.
4. Permite marcar ítems como **revisados** u **ocultos** (estado persistido en `localStorage`).

**Identificación del usuario:**

El script v5.0 busca tu nombre en los posts usando el array `MY_NAMES`. Si tu nombre aparece diferente en Moodle, agrégalo al array:

```js
const MY_NAMES = [
  'EDISSON EDUARDO OTALORA',
  'EDISSON OTALORA',
  // agrega variantes de tu nombre aquí
];
```

---

### 2. Análisis de discusiones

**Archivo:** `scrip-acceder-url-responder.js`

Se ejecuta como snippet en la consola del navegador estando dentro de una página `discuss.php`.

**Qué hace:**

- Selecciona todos los elementos `[data-region-content="forum-post-core"]` del DOM.
- Por cada post extrae:
  - `autor` — nombre del participante.
  - `mensaje` — preview de los primeros 120 caracteres.
  - `replyId` — el ID numérico del parámetro `reply=`.
  - `replyUrl` — URL completa del botón "Responder".

**Salida en consola:**

```js
console.table(resultados);
// ┌───────┬──────────────────────┬──────────┬─────────────────────────────────┐
// │ index │ autor                │ replyId  │ replyUrl                        │
// ├───────┼──────────────────────┼──────────┼─────────────────────────────────┤
// │ 0     │ JUAN PÉREZ           │ 123456   │ https://campus153.../post.php…  │
// │ 1     │ EDISSON OTALORA      │ 123457   │ https://campus153.../post.php…  │
// └───────┴──────────────────────┴──────────┴─────────────────────────────────┘
```

Usa la tabla resultante para identificar el `replyId` correcto antes de enviar una respuesta manual o programática.

---

### 3. Envío masivo por grupos

**Archivo:** `moodle-mass-send.js`

Al navegar a `view.php`, aparece un botón flotante verde en la esquina inferior derecha:

```
[ Enviar a todos los grupos ]
```

**Al hacer clic se abre un modal** con:

- Campo de texto para el **mensaje** (soporta HTML).
- Vista previa del HTML renderizado.
- Botón **Enviar a todos**.

**Flujo de envío:**

1. El script recolecta todos los grupos listados en `view.php`.
2. Por cada grupo, navega a la primera discusión visible.
3. Localiza el botón "Responder" y extrae la URL `post.php?reply=...`.
4. Construye un `FormData` con los parámetros necesarios.
5. Envía la petición `fetch` usando la sesión activa del navegador.
6. Reporta el resultado (éxito / error) por cada grupo en el modal.

**Formato del mensaje:**

```js
const formData = new FormData();
formData.append('message[text]', '<p>Tu mensaje en HTML</p>');
formData.append('message[format]', '1'); // 1 = HTML, 0 = texto plano
formData.append('discussion', discussionId);
formData.append('parent', parentId);
formData.append('reply', replyId);
```

---

## Arquitectura del flujo

```
┌─────────────────────────────────────────────────────────────┐
│  view.php?id={cmid}&group={groupid}                         │
│                                                             │
│  • Lista de discusiones del grupo actual                    │
│  • Badge azul = mensajes sin leer                           │
│  • selector de grupo → itera groupid                        │
└────────────────────┬────────────────────────────────────────┘
                     │ enlace a la discusión
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  discuss.php?d={discussionId}                               │
│                                                             │
│  • Árbol de posts en el DOM                                 │
│  • data-region-content="forum-post-core" por cada mensaje  │
│  • Botón "Responder" → href contiene reply={postId}         │
└────────────────────┬────────────────────────────────────────┘
                     │ fetch POST
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  post.php                                                   │
│                                                             │
│  FormData:                                                  │
│    discussion   → ID del hilo                               │
│    parent       → ID del post padre                         │
│    reply        → ID del post al que se responde            │
│    message[text]   → contenido del mensaje                  │
│    message[format] → 1 (HTML) / 0 (texto plano)             │
│    sesskey      → token CSRF de la sesión activa            │
└─────────────────────────────────────────────────────────────┘
```

---

## Variables clave de Moodle

| Variable | Fuente | Descripción |
|---|---|---|
| `discussion` | URL de `discuss.php?d=` o atributo del DOM | ID único del hilo de discusión |
| `parent` | Atributo del post en el DOM | ID del post que actúa como padre directo |
| `reply` | Parámetro en `href` del botón "Responder" (`reply=`) | ID del post al que se responde; Moodle lo usa para anidar la respuesta |
| `groupid` | Parámetro `group=` en la URL de `view.php` | Identifica el grupo de trabajo dentro del foro |
| `message[text]` | FormData al enviar a `post.php` | Contenido del mensaje; acepta HTML si `format=1` |
| `message[format]` | FormData al enviar a `post.php` | `1` = HTML enriquecido, `0` = texto sin formato |
| `sesskey` | Campo oculto en formularios de Moodle | Token CSRF requerido para autenticar el envío; se extrae del DOM |

---

## Buenas prácticas y advertencias

> **Advertencia:** El uso de automatizaciones en plataformas académicas puede ir en contra de las políticas de uso de la UNAD o de las normas académicas del curso. Úsalos con criterio y responsabilidad.

- **No envíes el mismo mensaje genérico en todos los grupos** si el contenido de las discusiones difiere. Los scripts permiten personalizar el mensaje antes de enviar.
- **Verifica el `sesskey`** antes de cada envío masivo. Si la sesión expira entre iteraciones, las peticiones fallarán silenciosamente.
- **Usa el modo de prueba** primero: envía a un solo grupo y revisa el resultado antes de aplicarlo a todos.
- **Respetar los tiempos de carga:** el script incluye delays entre grupos para no saturar el servidor ni activar protecciones anti-bot de Moodle.
- **localStorage** se usa para persistir estados (revisado/oculto). Si limpias el almacenamiento del navegador, se reinicia el estado.
- Los scripts operan con **la sesión del usuario logueado**. Nunca exponen credenciales; usan las cookies establecidas por Moodle.
- Mantén actualizados los arrays de nombres propios (`MY_NAMES`) para que la detección de tu participación sea precisa.

---

## Ejemplos de uso

### Detectar grupos con mensajes nuevos

1. Inicia sesión en `campus153.unad.edu.co`.
2. Entra al foro de tu curso (`view.php`).
3. Haz clic en el botón **"Revisar grupos"** (esquina inferior derecha).
4. El panel muestra los grupos con actividad y el número de mensajes nuevos.

### Extraer IDs de respuesta desde la consola

```js
// Estando en discuss.php, abre DevTools (F12) y pega:
const posts = Array.from(document.querySelectorAll('[data-region-content="forum-post-core"]'));
posts.forEach((post, i) => {
  const replyLink = post.querySelector('a[href*="reply="]');
  const replyId = replyLink?.href.match(/reply=(\d+)/)?.[1];
  console.log(`Post ${i} → reply=${replyId}`);
});
```

### Enviar un mensaje HTML a todos los grupos

```js
// Fragmento interno de moodle-mass-send.js
const formData = new FormData();
formData.append('message[text]', '<p>Buen día, compañeros. Mi aporte al debate es...</p>');
formData.append('message[format]', '1');
formData.append('discussion', '98765');
formData.append('parent', '11111');
formData.append('reply', '22222');
formData.append('sesskey', document.querySelector('input[name="sesskey"]').value);

await fetch('/ses69/mod/forum/post.php', {
  method: 'POST',
  body: formData,
  credentials: 'same-origin'
});
```

---

## Limitaciones actuales

- **Dependencia del DOM de Moodle:** los selectores CSS están basados en la estructura actual de `campus153.unad.edu.co`. Un cambio de tema o versión de Moodle puede romper la detección.
- **Sin soporte para adjuntos:** el envío masivo solo soporta texto/HTML; no permite adjuntar archivos.
- **Sesión única:** los scripts no manejan renovación de sesión. Si el token expira durante un envío masivo con muchos grupos, las peticiones posteriores fallarán.
- **Un solo hilo por grupo:** el envío masivo responde únicamente a la **primera discusión visible** de cada grupo. No itera sobre múltiples hilos del mismo grupo.
- **Sin reintentos automáticos:** si una petición falla (red, timeout), el script lo reporta pero no reintenta.
- **Nombres de usuario sensibles a mayúsculas:** la detección en `MY_NAMES` compara con `toUpperCase()`; variaciones tipográficas inesperadas en Moodle pueden causar falsos negativos.

---

## Posibles mejoras futuras

- [ ] **Selector de hilo:** permitir elegir a qué discusión de cada grupo responder, no solo la primera visible.
- [ ] **Reintentos con backoff:** reintentar automáticamente peticiones fallidas con espera incremental.
- [ ] **Plantillas de mensaje:** guardar múltiples plantillas en `localStorage` y seleccionarlas antes del envío.
- [ ] **Exportar reporte:** descargar un CSV con el resultado del envío masivo (grupo, estado, timestamp).
- [ ] **Detección de sesskey dinámica:** extraer el token CSRF de forma robusta antes de cada envío en lugar de depender del formulario visible.
- [ ] **Compatibilidad multi-campus:** parametrizar la URL base (`@match`) para funcionar en otras instancias de Moodle UNAD.
- [ ] **Panel de historial:** mostrar un log de los últimos envíos realizados con fecha y grupo.
- [ ] **Soporte dark mode:** adaptar la UI flotante al tema oscuro del sistema operativo.

---

## Estructura del repositorio

```
moodle-tools/
├── README.md
├── docs/
│   └── como-usarlos.md        # Guía extendida de uso (en construcción)
└── scripts/
    ├── unad-forum-monitor.user.js     # Monitor principal v5.0
    ├── moodle-monitor-grupos.js       # Monitor con estado local v2.0
    ├── moodle-mass-send.js            # Envío masivo por grupos v2.0
    └── scrip-acceder-url-responder.js # Snippet de consola para extraer reply IDs
```

---

> Desarrollado para uso personal en el contexto académico de la UNAD. No está afiliado ni respaldado oficialmente por la universidad.
