use sqlx::{sqlite::SqlitePoolOptions, Pool, Sqlite};

pub type DbPool = Pool<Sqlite>;

pub async fn establish_connection() -> Result<DbPool, sqlx::Error> {
    let database_url = "sqlite://todo_app.db?mode=rwc";

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect(database_url)
        .await?;

    // Crea la tabla users si no existe (con todos los campos desde el inicio)
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS users (
            id                      INTEGER PRIMARY KEY AUTOINCREMENT,
            name                    TEXT NOT NULL,
            lastname                TEXT NOT NULL,
            email                   TEXT UNIQUE NOT NULL,
            password_hash           TEXT NOT NULL,
            reset_token             TEXT,
            reset_token_expires_at  DATETIME,
            created_at              DATETIME DEFAULT CURRENT_TIMESTAMP
        );"
    )
    .execute(&pool)
    .await?;

    // Migración segura: agrega columnas si la tabla ya existía sin ellas
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN reset_token TEXT")
        .execute(&pool)
        .await;
    let _ = sqlx::query("ALTER TABLE users ADD COLUMN reset_token_expires_at DATETIME")
        .execute(&pool)
        .await;

    Ok(pool)
}
