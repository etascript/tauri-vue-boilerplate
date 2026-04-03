mod db;
mod models;
mod repositories;
mod services;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Carga variables de entorno desde src-tauri/.env
    dotenvy::dotenv().ok();

    // Establece la conexión a la DB antes de iniciar la app
    let pool = tauri::async_runtime::block_on(db::establish_connection())
        .expect("Error al conectar con la base de datos");

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(pool); // Inyecta el pool como estado global de Tauri

    commands::set_routes(builder)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
