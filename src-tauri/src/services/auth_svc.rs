use crate::db::DbPool;
use crate::models::user::{ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, UserResponseDto};
use crate::repositories::user_repo;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Hash simple para desarrollo. Reemplazar por bcrypt/argon2 en producción.
fn hash_password(password: &str) -> String {
    format!("hashed_{}", password)
}

async fn send_email(to: &str, subject: &str, body: String) -> Result<(), String> {
    let host = std::env::var("MAILTRAP_HOST")
        .unwrap_or_else(|_| "sandbox.smtp.mailtrap.io".to_string());
    let port: u16 = std::env::var("MAILTRAP_PORT")
        .unwrap_or_else(|_| "587".to_string())
        .parse()
        .unwrap_or(587);
    let user = std::env::var("MAILTRAP_USER").map_err(|_| "MAILTRAP_USER no configurado".to_string())?;
    let pass = std::env::var("MAILTRAP_PASS").map_err(|_| "MAILTRAP_PASS no configurado".to_string())?;

    let email = Message::builder()
        .from("TodoTauri <noreply@todotauri.dev>".parse().map_err(|e: lettre::address::AddressError| e.to_string())?)
        .to(to.parse().map_err(|e: lettre::address::AddressError| e.to_string())?)
        .subject(subject)
        .body(body)
        .map_err(|e| e.to_string())?;

    let creds = Credentials::new(user, pass);

    let mailer = AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&host)
        .map_err(|e| e.to_string())?
        .credentials(creds)
        .port(port)
        .build();

    mailer.send(email).await.map_err(|e| e.to_string())?;
    Ok(())
}

// ── Registro ─────────────────────────────────────────────────────────────────

pub async fn register(pool: &DbPool, dto: RegisterDto) -> Result<UserResponseDto, String> {
    let password_hash = hash_password(&dto.password);

    match user_repo::create_user(pool, &dto.name, &dto.lastname, &dto.email, &password_hash).await {
        Ok(user) => Ok(user),
        Err(sqlx::Error::Database(e)) if e.message().contains("UNIQUE") => {
            Err("El correo ya está registrado".into())
        }
        Err(_) => Err("Error al crear el usuario".into()),
    }
}

// ── Login ────────────────────────────────────────────────────────────────────

pub async fn login(pool: &DbPool, dto: LoginDto) -> Result<UserResponseDto, String> {
    let user = user_repo::find_by_email(pool, &dto.email)
        .await
        .map_err(|_| "Error al buscar el usuario".to_string())?
        .ok_or_else(|| "Credenciales incorrectas".to_string())?;

    let expected_hash = hash_password(&dto.password);
    if user.password_hash != expected_hash {
        return Err("Credenciales incorrectas".into());
    }

    Ok(UserResponseDto {
        id: user.id,
        name: user.name,
        lastname: user.lastname,
        email: user.email,
    })
}

// ── Recuperar contraseña ─────────────────────────────────────────────────────

pub async fn forgot_password(pool: &DbPool, dto: ForgotPasswordDto) -> Result<(), String> {
    let user = user_repo::find_by_email(pool, &dto.email)
        .await
        .map_err(|_| "Error interno".to_string())?;

    // Si el email no existe, respondemos igual para no revelar información
    let Some(user) = user else { return Ok(()); };

    let token = uuid::Uuid::new_v4().to_string().replace('-', "");
    let expires_at = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(2))
        .unwrap()
        .format("%Y-%m-%d %H:%M:%S")
        .to_string();

    user_repo::save_reset_token(pool, user.id, &token, &expires_at)
        .await
        .map_err(|_| "Error al guardar el token".to_string())?;

    let body = format!(
        "Hola {},\n\nRecibiste este correo porque solicitaste restablecer tu contraseña.\n\nTu código de recuperación es:\n\n    {}\n\nO haz clic en este enlace:\nhttp://localhost:1420/reset-password?token={}\n\nEste enlace expira en 2 horas.\n\nSi no solicitaste esto, ignora este correo.",
        user.name, token, token
    );

    send_email(&user.email, "Recuperación de contraseña - TodoTauri", body).await
}

// ── Establecer nueva contraseña ──────────────────────────────────────────────

pub async fn reset_password(pool: &DbPool, dto: ResetPasswordDto) -> Result<(), String> {
    let user_id = user_repo::find_by_valid_reset_token(pool, &dto.token)
        .await
        .map_err(|_| "Error interno".to_string())?
        .ok_or_else(|| "Token inválido o expirado".to_string())?;

    let password_hash = hash_password(&dto.new_password);

    user_repo::update_password(pool, user_id, &password_hash)
        .await
        .map_err(|_| "Error al actualizar la contraseña".to_string())
}
