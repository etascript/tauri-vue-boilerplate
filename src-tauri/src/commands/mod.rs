pub mod project_cmd;

use tauri::Runtime;

pub fn set_routes<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder.invoke_handler(tauri::generate_handler![
        project_cmd::create_project_dirs,
        project_cmd::save_project,
        project_cmd::load_project,
        project_cmd::list_projects,
        project_cmd::delete_project,
        project_cmd::list_history,
        project_cmd::load_history_snapshot,
        project_cmd::copy_asset,
        project_cmd::resolve_asset_path,
        project_cmd::cleanup_orphan_assets,
        project_cmd::export_zip,
    ])
}
