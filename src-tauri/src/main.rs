// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod models;
mod repositories;
mod services;
mod commands;
mod db;

use tauri::Manager;

fn main() {
    // Carga .env desde la carpeta src-tauri/ usando ruta absoluta en compilación
    let env_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
    println!("[ENV] Buscando .env en: {:?}", env_path);
    println!("[ENV] ¿Existe? {}", env_path.exists());

    match dotenvy::from_path(&env_path) {
        Ok(_)  => println!("[ENV] .env cargado OK"),
        Err(e) => println!("[ENV] Error al cargar .env: {}", e),
    }

    println!("[ENV] MAILTRAP_HOST = {:?}", std::env::var("MAILTRAP_HOST"));
    println!("[ENV] MAILTRAP_USER = {:?}", std::env::var("MAILTRAP_USER"));
    println!("[ENV] MAILTRAP_PASS = {:?}", std::env::var("MAILTRAP_PASS").map(|v| format!("{}...", &v[..4])));

    let builder = commands::set_routes(tauri::Builder::default());

    builder
        .setup(|app| {
            tauri::async_runtime::block_on(async {
                match db::establish_connection().await {
                    Ok(pool) => {
                        println!("[DB] Base de datos conectada exitosamente.");
                        app.manage(pool);
                    }
                    Err(e) => eprintln!("[DB] Error: {}", e),
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
