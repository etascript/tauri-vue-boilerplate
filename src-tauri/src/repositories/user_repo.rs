use crate::db::DbPool;
use crate::models::user::{User, UserResponseDto};

// ── Crear usuario ────────────────────────────────────────────────────────────

pub async fn create_user(
    pool: &DbPool,
    name: &str,
    lastname: &str,
    email: &str,
    password_hash: &str,
) -> Result<UserResponseDto, sqlx::Error> {
    let row = sqlx::query_as::<_, UserResponseDto>(
        "INSERT INTO users (name, lastname, email, password_hash)
         VALUES (?, ?, ?, ?)
         RETURNING id, name, lastname, email",
    )
    .bind(name)
    .bind(lastname)
    .bind(email)
    .bind(password_hash)
    .fetch_one(pool)
    .await?;

    Ok(row)
}

// ── Buscar por email ─────────────────────────────────────────────────────────

pub async fn find_by_email(pool: &DbPool, email: &str) -> Result<Option<User>, sqlx::Error> {
    let row = sqlx::query_as::<_, User>(
        "SELECT id, name, lastname, email, password_hash, created_at
         FROM users WHERE email = ?",
    )
    .bind(email)
    .fetch_optional(pool)
    .await?;

    Ok(row)
}

// ── Guardar token de recuperación ────────────────────────────────────────────

pub async fn save_reset_token(
    pool: &DbPool,
    user_id: i64,
    token: &str,
    expires_at: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE users
         SET reset_token = ?, reset_token_expires_at = ?
         WHERE id = ?",
    )
    .bind(token)
    .bind(expires_at)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

// ── Buscar usuario por token válido (no expirado) ────────────────────────────

pub async fn find_by_valid_reset_token(
    pool: &DbPool,
    token: &str,
) -> Result<Option<i64>, sqlx::Error> {
    let row = sqlx::query_scalar::<_, i64>(
        "SELECT id FROM users
         WHERE reset_token = ?
           AND reset_token_expires_at > datetime('now')",
    )
    .bind(token)
    .fetch_optional(pool)
    .await?;

    Ok(row)
}

// ── Actualizar contraseña y borrar token ─────────────────────────────────────

pub async fn update_password(
    pool: &DbPool,
    user_id: i64,
    password_hash: &str,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "UPDATE users
         SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL
         WHERE id = ?",
    )
    .bind(password_hash)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}
