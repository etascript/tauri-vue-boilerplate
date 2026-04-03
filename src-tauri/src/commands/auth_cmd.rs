use tauri::State;
use crate::db::DbPool;
use crate::models::user::{ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, UserResponseDto};
use crate::services::auth_svc;

#[tauri::command]
pub async fn register_cmd(
    dto: RegisterDto,
    pool: State<'_, DbPool>,
) -> Result<UserResponseDto, String> {
    auth_svc::register(&pool, dto).await
}

#[tauri::command]
pub async fn login_cmd(
    dto: LoginDto,
    pool: State<'_, DbPool>,
) -> Result<UserResponseDto, String> {
    auth_svc::login(&pool, dto).await
}

#[tauri::command]
pub async fn forgot_password_cmd(
    dto: ForgotPasswordDto,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    auth_svc::forgot_password(&pool, dto).await
}

#[tauri::command]
pub async fn reset_password_cmd(
    dto: ResetPasswordDto,
    pool: State<'_, DbPool>,
) -> Result<(), String> {
    auth_svc::reset_password(&pool, dto).await
}
