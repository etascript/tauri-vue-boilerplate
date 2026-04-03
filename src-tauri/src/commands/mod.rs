pub mod auth_cmd;

use tauri::Runtime;

pub fn set_routes<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder.invoke_handler(tauri::generate_handler![
        auth_cmd::register_cmd,
        auth_cmd::login_cmd,
        auth_cmd::forgot_password_cmd,
        auth_cmd::reset_password_cmd,
    ])
}
