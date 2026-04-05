# Ptah Studio 360

Herramienta de escritorio para crear y exportar experiencias interactivas 360°. Construida con **Tauri 2 + Vue 3**, genera como output un paquete ZIP autocontenido listo para abrir directamente en cualquier navegador.

---

## Guía de usuario

### Requisitos del sistema

- Windows 10/11 (64-bit)
- Sin dependencias adicionales — el instalador incluye todo lo necesario

---

### Inicio rápido

1. Abre la aplicación. Verás el panel de proyectos.
2. Haz clic en **+ Nuevo proyecto** y asígnale un nombre.
3. Se abre el editor con una escena vacía lista para configurar.

---

### El editor

La interfaz principal tiene tres zonas:

| Zona | Descripción |
|---|---|
| **Panel izquierdo** | Lista de escenas del tour |
| **Centro** | Previsualización en tiempo real (A-Frame/WebGL) |
| **Panel derecho** | Configuración de escena y lista de hotspots |

#### Barra superior

- **← Volver** — regresa al panel de proyectos (pide confirmación si hay cambios sin guardar)
- **Nombre del tour** — editable directamente; confirma con Enter o clic afuera
- **● Sin guardar / ✓ Guardado** — indicador de estado
- **⏱ Auto** — activa autosave cada 3 minutos
- **↺ Historial** — restaura versiones anteriores (guarda hasta 20 snapshots por proyecto)
- **💾 Guardar** — guarda manualmente (también con **Ctrl+S**)
- **⬡ Preview** — abre el viewer en ventana emergente
- **↓ Exportar ZIP** — genera el paquete distribuible

---

### Configurar una escena

Selecciona la escena en el panel izquierdo y usa el formulario derecho.

#### Fondo

Elige uno de tres modos:

- **✕ Ninguno** — fondo de color sólido (configurable en "Color fallback")
- **🖼 Panorama 360°** — imagen equirectangular (jpg, png, webp). Haz clic en ↑ para seleccionar el archivo desde tu disco.
- **🌐 Skybox** — 6 caras de un cubo (cubemap) o imagen equirectangular HDR/EXR

#### Modelo 3D (opcional)

Carga un archivo `.glb` o `.gltf` para añadir geometría 3D sobre el fondo 360°. Ajusta posición, escala y rotación con los campos correspondientes.

#### Spawn

Define dónde aparece la cámara al entrar en la escena:
- **Spawn posición** — coordenadas X Y Z (ej: `0 1.6 0`)
- **Spawn rotación** — orientación inicial en grados

#### Color fallback

Color de fondo cuando no hay imagen ni skybox.

---

### Hotspots

Los hotspots son puntos interactivos que el usuario activa haciendo clic en la escena 360°.

#### Tipos disponibles

| Tipo | Descripción |
|---|---|
| **info** | Panel de texto con título, descripción e imagen opcional |
| **trivia** | Pregunta con opciones y retroalimentación por respuesta |
| **decision** | Elección con múltiples opciones que disparan acciones |
| **teleport** | Waypoint invisible que mueve la cámara a otra posición |
| **navegacion** | Navega a otra escena del tour |
| **video** | Reproduce un video local |
| **dialogo** | Secuencia de pasos (info, trivia, decisión, video) |

#### Crear un hotspot

1. Haz clic en **+ Nuevo** en el panel de hotspots.
2. Configura ID, etiqueta, tipo y posición.
3. Haz clic en **✓ Guardar hotspot**. Aparece inmediatamente en el preview.

#### Posicionar con precisión — Modo Editor

Activa el **Modo Editor** (botón `⬡ Modo Editor` sobre el preview):

- **WASD** — mover la cámara libremente
- **Arrastrar** — rotar la vista
- **📍 Spawn** — captura la posición/rotación actual como punto de inicio de la escena
- **⊕ Colocar hotspot** — clic en cualquier punto de la escena para capturar coordenadas exactas

---

### Exportar el tour

1. Haz clic en **↓ Exportar ZIP**.
2. Elige la carpeta y nombre de destino.
3. Extrae el ZIP. Abre `index.html` directamente en el navegador.

El ZIP contiene:
```
index.html          — viewer con el tour incrustado
js/                 — motor A-Frame y scripts del viewer
css/                — estilos del viewer
assets/images/      — imágenes 360° y texturas
assets/models/      — modelos 3D
```

> **Nota:** los modelos 3D (`.glb`) requieren abrir el tour desde un servidor local (no funciona con `file://` por limitaciones del navegador). Las escenas de imagen 360° funcionan directamente.

---

### Historial de versiones

Cada vez que guardas, se crea automáticamente un snapshot. Para restaurar:

1. Haz clic en **↺ Historial** en la barra superior.
2. Selecciona el snapshot y haz clic en **Restaurar**.

Se mantienen los últimos 20 snapshots por proyecto.

---

### Atajos de teclado

| Atajo | Acción |
|---|---|
| **Ctrl+S** | Guardar proyecto |
| **WASD** (Modo Editor activo) | Mover cámara |
| **Arrastrar ratón** (Modo Editor) | Rotar vista |
| **Q / E** (Modo Editor) | Bajar / subir cámara |

---

### Dónde se guardan los proyectos

Los proyectos se guardan automáticamente en:
```
%APPDATA%\com.etascript.ptah-studio360\projects\
```

Cada proyecto tiene su propio directorio con los assets copiados localmente, por lo que mover o renombrar los archivos originales no afecta al proyecto.
