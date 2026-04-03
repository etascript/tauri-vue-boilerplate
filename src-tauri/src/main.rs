// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod models;
mod repositories;
mod services;
mod commands;
mod db;

use tauri::Manager;

fn main() {
// 1. Iniciamos el constructor por defecto
    let builder = tauri::Builder::default();
    // 2. Pasamos el constructor por nuestro "enrutador" (api.php)
    let builder = commands::set_routes(builder);
    // 3. Continuamos con el setup y la ejecución
    builder
        .setup(|app| {
            tauri::async_runtime::block_on(async {
                match db::establish_connection().await {
                    Ok(pool) => {
                        println!("Base de datos conectada exitosamente.");
                        app.manage(pool); 
                    }
                    Err(e) => eprintln!("Error: {}", e),
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
