use serde::{Deserialize, Serialize};
use sqlx::FromRow;

// ── Modelo de base de datos ──────────────────────────────────────────────────

#[derive(Debug, FromRow)]
pub struct User {
    pub id: i64,
    pub name: String,
    pub lastname: String,
    pub email: String,
    pub password_hash: String,
    pub created_at: String,
}

// ── DTOs de entrada (Vue → Rust) ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct RegisterDto {
    pub name: String,
    pub lastname: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginDto {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct ForgotPasswordDto {
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct ResetPasswordDto {
    pub token: String,
    pub new_password: String,
}

// ── DTOs de salida (Rust → Vue) ──────────────────────────────────────────────

/// Nunca incluye el password_hash por seguridad.
#[derive(Debug, Serialize, FromRow)]
pub struct UserResponseDto {
    pub id: i64,
    pub name: String,
    pub lastname: String,
    pub email: String,
}
