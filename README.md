# Tauri + Vue 3 — Boilerplate con Auth completa

Plantilla base para aplicaciones de escritorio multiplataforma con autenticación lista para usar. Pensada para ser forkeada o copiada como punto de partida para cualquier proyecto nuevo.

---

## Tecnologías

| Capa | Tecnología | Versión |
|---|---|---|
| Frontend | Vue 3 (`<script setup>`) | ^3.5 |
| Build / Dev server | Vite | ^6.4 |
| Desktop runtime | Tauri | ^2 |
| Enrutamiento | Vue Router | ^4.6 |
| Estado global | Pinia | ^3 |
| Backend / Lógica | Rust | 2021 edition |
| Base de datos | SQLite (via SQLx) | ^0.8 |
| Email (desarrollo) | Mailtrap SMTP | — |
| Estilos | Tailwind CSS | ^3 |

---

## Qué incluye este boilerplate

### Autenticación completa
- Registro de usuario (nombre, apellido, email, contraseña)
- Login con redirección a ruta privada
- Recuperación de contraseña por email (token con expiración de 2 horas)
- Establecer nueva contraseña con código recibido por email
- Logout con limpieza de sesión

### Protección de rutas
- Rutas privadas (`requiresAuth`) — redirigen a `/login` si no hay sesión
- Rutas de invitado (`guestOnly`) — redirigen a `/` si ya hay sesión activa
- Sesión persistida en `localStorage` via Pinia

### Estructura backend lista para escalar
- Patrón por capas: Commands → Services → Repositories → DB
- SQLite embebido, sin servidor externo
- Pool de conexiones asíncronas con SQLx

---

## Requisitos previos

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://rustup.rs/) (toolchain estable)
- [Tauri CLI prerequisites](https://tauri.app/start/prerequisites/) para tu sistema operativo
- Una cuenta en [Mailtrap](https://mailtrap.io/) (gratuita) para pruebas de email

---

## Instalación

```bash
# 1. Clona o copia el repositorio
git clone <url-del-repo> mi-nuevo-proyecto
cd mi-nuevo-proyecto

# 2. Instala las dependencias de Node
npm install

# 3. Configura las variables de entorno del backend
# Edita el archivo src-tauri/.env con tus credenciales de Mailtrap
```

### Configurar Mailtrap

1. Ve a [mailtrap.io](https://mailtrap.io) → Email Testing → tu inbox
2. Haz clic en SMTP Settings
3. Copia las credenciales al archivo `src-tauri/.env`:

```env
DATABASE_URL=sqlite://todo_app.db

MAILTRAP_HOST=sandbox.smtp.mailtrap.io
MAILTRAP_PORT=587
MAILTRAP_USER=tu_usuario
MAILTRAP_PASS=tu_password
```

---

## Desarrollo

```bash
npm run tauri dev
```

Esto levanta Vite en `http://localhost:1420` y compila el backend de Rust simultáneamente.

> La primera compilación de Rust puede tardar varios minutos. Las siguientes son incrementales y mucho más rápidas.

## Build de producción

```bash
npm run tauri build
```

Genera el instalador para tu sistema operativo en `src-tauri/target/release/bundle/`.

---

## Estructura del proyecto

```
todo-app/
├── src/                        # Frontend Vue
│   ├── main.js                 # Punto de entrada, registra Pinia y Router
│   ├── App.vue                 # Layout raíz con nav condicional
│   ├── router/
│   │   └── index.js            # Rutas y navigation guards
│   ├── stores/
│   │   └── auth.js             # Store de autenticación (Pinia)
│   └── views/
│       ├── HomeView.vue        # Vista privada principal
│       └── auth/
│           ├── LoginView.vue
│           ├── RegisterView.vue
│           ├── ForgotPasswordView.vue
│           └── ResetPasswordView.vue
│
└── src-tauri/                  # Backend Rust
    ├── .env                    # Variables de entorno (no commitear)
    ├── Cargo.toml              # Dependencias Rust
    └── src/
        ├── main.rs             # Entrypoint binario
        ├── lib.rs              # Configuración de la app Tauri
        ├── db.rs               # Conexión y esquema SQLite
        ├── models/             # Structs de DB y DTOs
        ├── repositories/       # Consultas SQL
        ├── services/           # Lógica de negocio
        └── commands/           # Comandos expuestos al frontend
```

---

## Cómo usar como template para un nuevo proyecto

1. **Copia o forkea** este repositorio
2. Renombra el proyecto en `package.json` y `src-tauri/Cargo.toml`
3. Actualiza el `productName` en `src-tauri/tauri.conf.json`
4. Configura `src-tauri/.env` con tus credenciales
5. Implementa tus propios módulos siguiendo el patrón existente

> Ver `BACKEND_GUIDE.md` para una guía paso a paso de cómo agregar nuevas funcionalidades al backend.

---

## IDE recomendado

- [VS Code](https://code.visualstudio.com/)
- Extensiones: [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) · [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) · [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
