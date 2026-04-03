# Guía de desarrollo backend (Rust)

> Escrita para alguien que viene de Java SpringBoot o Laravel PHP.
> No necesitas dominar Rust para seguir esta guía — basta con entender el patrón.

---

## Analogía con lo que ya conoces

| Este proyecto | SpringBoot | Laravel |
|---|---|---|
| `models/` | `@Entity` / DTO | `Model` / `FormRequest` |
| `repositories/` | `JpaRepository` | `Eloquent queries` |
| `services/` | `@Service` | `Service class` |
| `commands/` | `@RestController` | `Controller` |
| `lib.rs` | `Application.java` | `AppServiceProvider` |
| `db.rs` | `application.properties` (datasource) | `config/database.php` |
| `mod.rs` | (no tiene equivalente directo) | (no tiene equivalente) |

**Flujo de una petición:**

```
Vue (invoke) → command → service → repository → SQLite
                                                    ↓
Vue (recibe) ← command ← service ← repository ← resultado
```

Exactamente igual al flujo Controller → Service → Repository de SpringBoot o Laravel.

---

## Cómo están conectados los archivos

### `lib.rs` — el punto de arranque

Es el equivalente al `main` de tu aplicación. Hace tres cosas:

1. Carga las variables de entorno (`.env`)
2. Conecta a la base de datos y crea el pool
3. Registra los comandos que el frontend puede llamar

```rust
pub fn run() {
    dotenvy::dotenv().ok();                          // Carga .env
    let pool = establish_connection().await;          // Conecta a SQLite
    commands::set_routes(builder.manage(pool))        // Registra comandos
        .run(...)
}
```

### `db.rs` — la base de datos

Define el tipo `DbPool` y la función `establish_connection()` que:
- Abre (o crea) el archivo `todo_app.db`
- Ejecuta el `CREATE TABLE IF NOT EXISTS` de cada tabla
- Aplica migraciones simples con `ALTER TABLE`

### `models/` — los datos

Contiene structs (equivalente a clases en Java/PHP). Hay tres tipos:

- **Modelo DB** (`User`): mapea exactamente una fila de la tabla. Necesita `#[derive(FromRow)]`.
- **DTO de entrada** (`RegisterDto`, `LoginDto`...): lo que llega desde Vue. Necesita `#[derive(Deserialize)]`.
- **DTO de salida** (`UserResponseDto`): lo que se devuelve a Vue. Necesita `#[derive(Serialize, FromRow)]`.

### `repositories/` — las consultas SQL

Solo SQL. Sin lógica de negocio. Reciben el `pool` y parámetros, devuelven datos.

### `services/` — la lógica

Orquesta repositories, aplica reglas de negocio (validaciones, hashing, envío de email, etc.).

### `commands/` — la API

Las funciones decoradas con `#[tauri::command]` son el "endpoint" que Vue puede llamar con `invoke()`.

---

## Proceso completo: agregar un módulo nuevo

Ejemplo: agregar un módulo de **tareas** (`tasks`).

### Paso 1 — Agregar la tabla en `db.rs`

```rust
// src-tauri/src/db.rs

sqlx::query(
    "CREATE TABLE IF NOT EXISTS tasks (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER NOT NULL,
        title       TEXT NOT NULL,
        done        BOOLEAN NOT NULL DEFAULT 0,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );"
)
.execute(&pool)
.await?;
```

Si ya existe la tabla y quieres agregar una columna nueva:

```rust
// Esto falla silenciosamente si la columna ya existe — está bien así
let _ = sqlx::query("ALTER TABLE tasks ADD COLUMN priority INTEGER DEFAULT 0")
    .execute(&pool)
    .await;
```

> Nunca uses `query_as!` ni `query!` (macros con `!`). Usa siempre
> `sqlx::query_as::<_, TuStruct>(sql).bind(valor)` para evitar
> el error de `DATABASE_URL` en tiempo de compilación.

---

### Paso 2 — Crear el modelo en `models/`

Crea el archivo `src-tauri/src/models/task.rs`:

```rust
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// Modelo de la DB — mapea la tabla tasks
#[derive(Debug, FromRow)]
pub struct Task {
    pub id: i64,
    pub user_id: i64,
    pub title: String,
    pub done: bool,
    pub created_at: String,
}

// DTO de entrada (Vue → Rust)
#[derive(Debug, Deserialize)]
pub struct CreateTaskDto {
    pub user_id: i64,
    pub title: String,
}

// DTO de salida (Rust → Vue)
#[derive(Debug, Serialize, FromRow)]
pub struct TaskResponseDto {
    pub id: i64,
    pub title: String,
    pub done: bool,
    pub created_at: String,
}
```

Luego **expónlo en `models/mod.rs`**:

```rust
// src-tauri/src/models/mod.rs
pub mod user;
pub mod task;   // <-- agrega esta línea
```

---

### Paso 3 — Crear el repositorio en `repositories/`

Crea `src-tauri/src/repositories/task_repo.rs`:

```rust
use crate::db::DbPool;
use crate::models::task::{Task, TaskResponseDto};

pub async fn create_task(
    pool: &DbPool,
    user_id: i64,
    title: &str,
) -> Result<TaskResponseDto, sqlx::Error> {
    sqlx::query_as::<_, TaskResponseDto>(
        "INSERT INTO tasks (user_id, title) VALUES (?, ?) RETURNING id, title, done, created_at"
    )
    .bind(user_id)
    .bind(title)
    .fetch_one(pool)
    .await
}

pub async fn get_tasks_by_user(
    pool: &DbPool,
    user_id: i64,
) -> Result<Vec<TaskResponseDto>, sqlx::Error> {
    sqlx::query_as::<_, TaskResponseDto>(
        "SELECT id, title, done, created_at FROM tasks WHERE user_id = ? ORDER BY created_at DESC"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

pub async fn mark_done(pool: &DbPool, task_id: i64) -> Result<(), sqlx::Error> {
    sqlx::query("UPDATE tasks SET done = 1 WHERE id = ?")
        .bind(task_id)
        .execute(pool)
        .await?;
    Ok(())
}
```

Expónlo en `repositories/mod.rs`:

```rust
// src-tauri/src/repositories/mod.rs
pub mod user_repo;
pub mod task_repo;   // <-- agrega esta línea
```

---

### Paso 4 — Crear el servicio en `services/`

Crea `src-tauri/src/services/task_svc.rs`:

```rust
use crate::db::DbPool;
use crate::models::task::{CreateTaskDto, TaskResponseDto};
use crate::repositories::task_repo;

pub async fn create_task(pool: &DbPool, dto: CreateTaskDto) -> Result<TaskResponseDto, String> {
    task_repo::create_task(pool, dto.user_id, &dto.title)
        .await
        .map_err(|_| "Error al crear la tarea".into())
}

pub async fn get_tasks(pool: &DbPool, user_id: i64) -> Result<Vec<TaskResponseDto>, String> {
    task_repo::get_tasks_by_user(pool, user_id)
        .await
        .map_err(|_| "Error al obtener las tareas".into())
}

pub async fn complete_task(pool: &DbPool, task_id: i64) -> Result<(), String> {
    task_repo::mark_done(pool, task_id)
        .await
        .map_err(|_| "Error al completar la tarea".into())
}
```

Expónlo en `services/mod.rs`:

```rust
pub mod auth_svc;
pub mod task_svc;   // <-- agrega esta línea
```

---

### Paso 5 — Crear los comandos en `commands/`

Crea `src-tauri/src/commands/task_cmd.rs`:

```rust
use tauri::State;
use crate::db::DbPool;
use crate::models::task::{CreateTaskDto, TaskResponseDto};
use crate::services::task_svc;

#[tauri::command]
pub async fn create_task_cmd(
    dto: CreateTaskDto,
    pool: State<'_, DbPool>,
) -> Result<TaskResponseDto, String> {
    task_svc::create_task(&pool, dto).await
}

#[tauri::command]
pub async fn get_tasks_cmd(
    user_id: i64,
    pool: State<'_, DbPool>,
) -> Result<Vec<TaskResponseDto>, String> {
    task_svc::get_tasks(&pool, user_id).await
}

#[tauri::command]
pub async fn complete_task_cmd(
    task_id: i64,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    task_svc::complete_task(&pool, task_id).await
}
```

---

### Paso 6 — Registrar los comandos en `commands/mod.rs`

```rust
// src-tauri/src/commands/mod.rs
pub mod auth_cmd;
pub mod task_cmd;   // <-- declara el módulo

use tauri::Runtime;

pub fn set_routes<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder.invoke_handler(tauri::generate_handler![
        auth_cmd::register_cmd,
        auth_cmd::login_cmd,
        auth_cmd::forgot_password_cmd,
        auth_cmd::reset_password_cmd,
        task_cmd::create_task_cmd,   // <-- registra los comandos nuevos
        task_cmd::get_tasks_cmd,
        task_cmd::complete_task_cmd,
    ])
}
```

> `lib.rs` no necesita tocar — ya usa `commands::set_routes(builder)` que carga todo automáticamente.

---

### Paso 7 — Llamar desde Vue

```js
import { invoke } from '@tauri-apps/api/core'

// Crear tarea
const task = await invoke('create_task_cmd', {
  dto: { user_id: authStore.user.id, title: 'Mi primera tarea' }
})

// Obtener tareas
const tasks = await invoke('get_tasks_cmd', { userId: authStore.user.id })

// Completar tarea
await invoke('complete_task_cmd', { taskId: task.id })
```

**Regla importante:** los nombres de los parámetros en `invoke()` deben estar en `camelCase` en Vue — Tauri los convierte automáticamente a `snake_case` para Rust.

---

## Resumen del checklist para un módulo nuevo

```
[ ] 1. db.rs          → CREATE TABLE IF NOT EXISTS (y ALTER TABLE si es migración)
[ ] 2. models/        → nuevo archivo .rs con struct DB + DTOs + FromRow/Serialize/Deserialize
[ ] 3. models/mod.rs  → pub mod nuevo_modelo;
[ ] 4. repositories/  → nuevo archivo .rs con funciones SQL (query_as + .bind())
[ ] 5. repos/mod.rs   → pub mod nuevo_repo;
[ ] 6. services/      → nuevo archivo .rs con lógica de negocio
[ ] 7. services/mod.rs → pub mod nuevo_svc;
[ ] 8. commands/      → nuevo archivo .rs con funciones #[tauri::command]
[ ] 9. commands/mod.rs → pub mod nuevo_cmd; + registrar en generate_handler![]
[ ] 10. Vue           → invoke('nombre_cmd', { params })
```

---

## Tipos de Rust que más vas a usar

| Lo que conoces | Rust |
|---|---|
| `String` / `int` / `boolean` | `String`, `i64`, `bool` |
| `Optional<T>` / `null` | `Option<T>` (`Some(valor)` o `None`) |
| `throws Exception` | `Result<T, E>` (`Ok(valor)` o `Err(mensaje)`) |
| `List<T>` | `Vec<T>` |
| `try/catch` | `match result { Ok(v) => ..., Err(e) => ... }` |
| método `.get()` en Optional | `.unwrap_or(default)` o `.ok_or("error")?` |

### El operador `?`

Es un atajo para "si hay error, devuélvelo inmediatamente". Equivale al `throws` de Java:

```rust
// En vez de esto:
let user = match user_repo::find_by_email(pool, email).await {
    Ok(u) => u,
    Err(e) => return Err(e),
};

// Puedes escribir esto:
let user = user_repo::find_by_email(pool, email).await?;
```

---

## Errores comunes y cómo resolverlos

**`no 'algo' in 'modulo'`**
→ Falta `pub mod algo;` en el `mod.rs` del directorio correspondiente.

**`cannot find type 'MiStruct' in this scope`**
→ Falta el `use crate::models::mi_modulo::MiStruct;` al inicio del archivo.

**`the trait 'FromRow' is not implemented`**
→ Le falta `#[derive(sqlx::FromRow)]` al struct que usas en `query_as::<_, TuStruct>()`.

**`error: set DATABASE_URL to use query macros`**
→ Estás usando `sqlx::query_as!()` con `!`. Usa `sqlx::query_as::<_, T>()` sin `!`.

**`this function takes N arguments but M were supplied`**
→ El número de `.bind()` no coincide con los `?` en el SQL, o los parámetros del repositorio cambiaron.
