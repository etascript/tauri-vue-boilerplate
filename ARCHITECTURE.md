# Ptah Studio 360 — Documentación de sistema

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Shell nativo | Tauri 2 (Rust) |
| Frontend | Vue 3 + Vite + Pinia |
| Viewer 360° | A-Frame 1.5 / THREE.js |
| Persistencia | Sistema de archivos (AppData) vía Tauri IPC |
| Empaquetado | Rust `zip` crate |

---

## Estructura del proyecto

```
ptah_studio360_desktop/
├── src/                        # Frontend Vue
│   ├── views/
│   │   ├── HomeView.vue        # Panel de proyectos
│   │   └── EditorView.vue      # Editor principal
│   ├── components/
│   │   ├── PreviewPane.vue     # Iframe del viewer + bus de mensajes
│   │   ├── SceneForm.vue       # Formulario de configuración de escena
│   │   ├── SceneList.vue       # Lista de escenas (sidebar izquierdo)
│   │   ├── HotspotList.vue     # Lista de hotspots
│   │   ├── HotspotForm.vue     # Modal de creación/edición de hotspot
│   │   ├── ConditionInput.vue  # Input para condiciones de acceso/visibilidad
│   │   └── AppToast.vue        # Notificaciones toast
│   ├── stores/
│   │   ├── tourStore.js        # Estado global del tour (Pinia)
│   │   └── assetStore.js       # Registro de assets → URLs asset://
│   ├── router/index.js
│   └── main.js
│
├── public/
│   └── viewer/                 # Viewer A-Frame (HTML + JS puro, sin bundler)
│       ├── index.html
│       ├── css/hud.css
│       └── js/
│           ├── main.js         # Boot, bus postMessage, routing de mensajes
│           ├── SceneLoader.js  # Motor de escenas (sky, modelo, hotspots)
│           ├── StateManager.js # Variables de estado del tour
│           ├── EffectEngine.js # Ejecutor de efectos (ir_escena, set_var…)
│           └── components/
│               ├── hotspot.js
│               ├── panel.js
│               ├── keyboard-look.js
│               └── ground-lock.js
│
└── src-tauri/                  # Backend Rust / Tauri
    ├── src/
    │   ├── main.rs
    │   ├── lib.rs
    │   └── commands/
    │       ├── mod.rs
    │       └── project_cmd.rs  # Todos los comandos IPC
    ├── capabilities/
    │   └── default.json        # Permisos Tauri (fs, dialog, shell…)
    └── tauri.conf.json
```

---

## Arquitectura de comunicación Studio ↔ Viewer

El viewer corre dentro de un `<iframe>` en `PreviewPane.vue`. La comunicación es exclusivamente por `window.postMessage`.

### Mensajes Studio → Viewer

| Tipo | Payload | Descripción |
|---|---|---|
| `ptah360:asset` | `{ path, url }` | Registra un asset (ruta relativa → URL asset://) |
| `ptah360:load` | `{ tour, activeSceneId }` | Carga completa del tour |
| `ptah360:goto-scene` | `{ sceneId }` | Navega a una escena específica |
| `ptah360:hotspots` | `{ hotspots }` | Refresca solo los hotspots (sin recargar fondo) |
| `ptah360:editor-mode` | `{ enabled }` | Activa/desactiva modo editor (cámara libre) |
| `ptah360:place-mode` | `{ enabled }` | Activa/desactiva modo colocación de hotspot |
| `ptah360:capture` | `{ captureType }` | Solicita captura de posición/rotación de cámara |

### Mensajes Viewer → Studio

| Tipo | Payload | Descripción |
|---|---|---|
| `ptah360:ready` | — | Viewer listo para recibir datos |
| `ptah360:captured` | `{ captureType, position, rotation }` | Respuesta a una captura |
| `ptah360:place-mode-done` | — | El usuario colocó un hotspot en la escena |
| `ptah360:hotspot-moved` | `{ id, position }` | Hotspot arrastrado a nueva posición |

### Flujo de inicialización

```
Iframe carga
  └─ DOMContentLoaded → postMessage(ptah360:ready)
        └─ PreviewPane.onMessage → frameReady = true → sendUpdate()
              ├─ postMessage(ptah360:asset) × N   [assets registrados]
              └─ postMessage(ptah360:load)         [tour completo]
                    └─ main.js → _applyAssets() → SceneLoader.loadData()
                          └─ _renderScene() → carga sky + hotspots
```

---

## Gestión de assets

### En el studio (modo edición)

Los assets no se sirven desde `public/` sino desde AppData. El flujo al cargar un archivo:

```
Usuario selecciona archivo (Tauri dialog)
  └─ invoke('copy_asset', { tourId, sourcePath })
        └─ Rust copia el archivo a AppData/projects/{tourId}/assets/{subdir}/
        └─ Retorna { relative_path, absolute_path }
  └─ convertFileSrc(absolutePath)
        └─ Genera URL https://asset.localhost/... (Windows/WebView2)
  └─ assets Map: relativePath → { url, absolutePath, name, size }
```

Cuando el preview necesita mostrar un asset:
- `PreviewPane.sendUpdate()` itera `assets` Map y envía `ptah360:asset` al viewer
- El viewer guarda `_assetOverrides[relativePath] = assetUrl`
- Al procesar el tour (`_applyAssets`), sustituye los paths relativos por las URLs `asset://`

### En el export (modo standalone)

El tour JSON se inyecta directamente en el HTML como `window.__PTAH_TOUR__`, por lo que no se necesita `fetch()`. Los assets se copian a `assets/` en el ZIP con las mismas rutas relativas que usa el tour JSON.

---

## Modelo de datos — Tour JSON

```jsonc
{
  "id": "tour-abc123",
  "titulo": "Mi Tour",
  "version": "2.0",
  "createdAt": 1700000000000,
  "updatedAt": 1700000000000,
  "estado_inicial": { "puntuacion": 0, "vars": {} },
  "escena_inicio": "escena-01",
  "escenas": [
    {
      "id": "escena-01",
      "titulo": "Lobby",
      "modo": "tour",           // "tour" | "walk" | "look"
      "velocidad": 3,
      "imagen360": "assets/images/lobby.jpg",   // null si usa skybox
      "skybox": null,           // { px, nx, py, ny, pz, nz } | { equirectangular }
      "modelo3d": null,         // "assets/models/scene.glb"
      "modeloPosicion": "0 0 0",
      "modeloEscala": "1 1 1",
      "modeloRotacion": "0 0 0",
      "colorFallback": "#1a1a2e",
      "spawnPosicion": "0 1.6 0",
      "spawnRotacion": "0 0 0",
      "groundLock": false,
      "groundHeight": 1.6,
      "condicion_acceso": null,
      "hotspots": [
        {
          "id": "hs-info-1",
          "tipo": "info",        // info | trivia | decision | teleport | navegacion | video | dialogo
          "etiqueta": "Cartel",
          "posicion": "2 1.6 -4",
          "condicion_visible": null,
          "contenido": {
            "titulo": "Bienvenido",
            "texto": "Texto del panel",
            "imagen": ""
          }
        }
      ]
    }
  ]
}
```

---

## Comandos IPC (Rust)

Definidos en `src-tauri/src/commands/project_cmd.rs`:

| Comando | Parámetros | Retorno | Descripción |
|---|---|---|---|
| `create_project_dirs` | `tourId` | `String` (ruta) | Crea estructura de directorios en AppData |
| `save_project` | `tourId, json` | `()` | Guarda JSON + crea snapshot histórico |
| `load_project` | `tourId` | `String` (JSON) | Lee el `.ptah` del proyecto |
| `list_projects` | — | `Vec<ProjectMeta>` | Lista metadatos de todos los proyectos |
| `delete_project` | `tourId` | `()` | Elimina el directorio del proyecto |
| `copy_asset` | `tourId, sourcePath` | `CopiedAsset` | Copia un asset a AppData |
| `resolve_asset_path` | `tourId, relativePath` | `String` (ruta abs.) | Resuelve ruta relativa → absoluta |
| `cleanup_orphan_assets` | `tourId, referencedPaths` | `u32` (eliminados) | Borra assets no referenciados |
| `list_history` | `tourId` | `Vec<String>` | Lista snapshots históricos |
| `load_history_snapshot` | `tourId, snapshot` | `String` (JSON) | Carga un snapshot |
| `export_zip` | `tourId, tourJson, outputPath, viewerSrc` | `()` | Genera el ZIP exportable |

### Estructura en AppData

```
%APPDATA%\com.etascript.ptah-studio360\
└── projects\
    └── {tourId}\
        ├── project.ptah          # JSON del tour (formato propio)
        ├── assets\
        │   ├── images\           # Imágenes 360°, texturas
        │   ├── models\           # Archivos .glb / .gltf
        │   └── video\            # Videos
        └── history\
            ├── 2025-04-01T12-00-00.ptah
            └── ...               # Hasta 20 snapshots
```

---

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Modo desarrollo (hot reload Vue + Tauri)
npm run tauri dev

# Build de producción
npm run tauri build
```

### Requisitos de desarrollo

- Node.js 18+
- Rust (stable) + cargo
- Visual Studio Build Tools (Windows)
- WebView2 Runtime (incluido en Windows 11, descargable para Windows 10)

### Variables de entorno relevantes

El `devUrl` en `tauri.conf.json` apunta a `http://localhost:1420` (Vite). En producción, el frontend se sirve desde `tauri://localhost`.

---

## Estructura del export ZIP

```
index.html          # Viewer con window.__PTAH_TOUR__ injectado (sin iframe)
js/
  main.js           # Boot del viewer
  SceneLoader.js
  StateManager.js
  EffectEngine.js
  components/
    hotspot.js
    panel.js
    keyboard-look.js
    ground-lock.js
  editor-controls.js
css/
  hud.css
assets/
  images/           # Imágenes copiadas desde AppData
  models/           # Modelos copiados desde AppData
  video/
```

### Por qué no usa iframe ni fetch

El protocolo `file://` trata cada URL como origen único, bloqueando:
- `<iframe src="otra-carpeta/...">` — violación de same-origin
- `fetch('./data/tour.json')` — bloqueado en Chrome/Edge desde v79
- `XMLHttpRequest` para texturas (THREE.js r155+ usa FileLoader internamente)

**Soluciones aplicadas:**
1. El tour JSON se inyecta como `window.__PTAH_TOUR__` directamente en `index.html`
2. `main.js` parchea `THREE.ImageLoader.prototype.load` bajo `file://` para usar `<img>` en lugar de XHR
3. Los paths en el ZIP se calculan con `.canonicalize()` antes de `strip_prefix` para evitar mismatches de rutas en Windows (`\\?\` vs rutas normales)

### Minificación del export

Los archivos JS y CSS se minifican en Rust durante la exportación:
- **JS**: crate `minify-js` (modo `TopLevelMode::Global` — no renombra globals inter-script)
- **CSS**: implementación propia (elimina comentarios `/* */`, colapsa whitespace, elimina espacios alrededor de tokens)
- `index.html` no se minifica (contiene JSON incrustado que no debe tocarse)

---

## Permisos Tauri

Configurados en `src-tauri/capabilities/default.json`:

- `fs:allow-read-file`, `fs:allow-appdata-read-recursive` — lectura de assets en AppData
- `fs:allow-appdata-write-recursive` — escritura de proyectos y assets
- `fs:allow-remove`, `fs:allow-rename`, `fs:allow-copy-file` — gestión de archivos
- `dialog:allow-open`, `dialog:allow-save` — diálogos nativos de archivo
- `core:path:default` — resolución de rutas del sistema

El `assetProtocol` en `tauri.conf.json` está habilitado con `scope: ["**"]`, lo que permite a `convertFileSrc()` generar URLs `https://asset.localhost/...` accesibles desde el webview para cualquier ruta del sistema de archivos.
