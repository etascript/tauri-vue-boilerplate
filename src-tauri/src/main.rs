// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

use tauri::Manager;

fn main() {
    let builder = commands::set_routes(tauri::Builder::default());

    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Crear directorio base de proyectos si no existe
            let projects_dir = app
                .path()
                .app_data_dir()
                .expect("no appdata dir")
                .join("projects");
            std::fs::create_dir_all(&projects_dir)
                .expect("no se pudo crear directorio de proyectos");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar Ptah Studio 360");
}
