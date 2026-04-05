use std::path::{Path, PathBuf};
use std::fs;
use std::io::{Write, Read};
use std::collections::BTreeMap;
use tauri::Manager;
use serde::{Deserialize, Serialize};
use zip::write::SimpleFileOptions;
use walkdir::WalkDir;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

// ─── Helpers de rutas ────────────────────────────────────────────────────────

fn project_dir<R: tauri::Runtime>(app: &tauri::AppHandle<R>, tour_id: &str) -> PathBuf {
    app.path()
        .app_data_dir()
        .expect("no appdata dir")
        .join("projects")
        .join(tour_id)
}

fn ptah_file<R: tauri::Runtime>(app: &tauri::AppHandle<R>, tour_id: &str) -> PathBuf {
    project_dir(app, tour_id).join("project.ptah")
}

fn assets_dir<R: tauri::Runtime>(app: &tauri::AppHandle<R>, tour_id: &str) -> PathBuf {
    project_dir(app, tour_id).join("assets")
}

fn history_dir<R: tauri::Runtime>(app: &tauri::AppHandle<R>, tour_id: &str) -> PathBuf {
    project_dir(app, tour_id).join("history")
}

fn asset_subdir(filename: &str) -> &'static str {
    let ext = Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();
    match ext.as_str() {
        "glb" | "gltf" => "models",
        "mp4" | "webm" | "ogg" => "video",
        _ => "images",
    }
}

// ─── DTOs ────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProjectMeta {
    pub id: String,
    pub titulo: String,
    pub version: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub scene_count: usize,
}

// ─── Comandos ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn create_project_dirs<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    tour_id: String,
) -> Result<String, String> {
    let base = project_dir(&app, &tour_id);
    fs::create_dir_all(assets_dir(&app, &tour_id).join("images")).map_err(|e| e.to_string())?;
    fs::create_dir_all(assets_dir(&app, &tour_id).join("models")).map_err(|e| e.to_string())?;
    fs::create_dir_all(assets_dir(&app, &tour_id).join("video")).map_err(|e| e.to_string())?;
    fs::create_dir_all(history_dir(&app, &tour_id)).map_err(|e| e.to_string())?;
    Ok(base.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn save_project<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    tour_id: String,
    json: String,
) -> Result<(), String> {
    let ptah = ptah_file(&app, &tour_id);
    fs::write(&ptah, &json).map_err(|e| e.to_string())?;

    let hist = history_dir(&app, &tour_id);
    fs::create_dir_all(&hist).map_err(|e| e.to_string())?;

    let timestamp = chrono::Utc::now().format("%Y-%m-%dT%H-%M-%S").to_string();
    let snap = hist.join(format!("{}.ptah", timestamp));
    fs::write(&snap, &json).map_err(|e| e.to_string())?;

    let mut snapshots: Vec<PathBuf> = fs::read_dir(&hist)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| p.extension().and_then(|x| x.to_str()) == Some("ptah"))
        .collect();

    snapshots.sort();

    if snapshots.len() > 20 {
        for old in snapshots.iter().take(snapshots.len() - 20) {
            let _ = fs::remove_file(old);
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn load_project<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    tour_id: String,
) -> Result<String, String> {
    let ptah = ptah_file(&app, &tour_id);
    fs::read_to_string(&ptah).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_projects<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<Vec<ProjectMeta>, String> {
    let projects_root = app
        .path()
        .app_data_dir()
        .expect("no appdata dir")
        .join("projects");

    if !projects_root.exists() {
        return Ok(vec![]);
    }

    let mut metas: Vec<ProjectMeta> = vec![];

    for entry in fs::read_dir(&projects_root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let ptah_path = entry.path().join("project.ptah");
        if !ptah_path.exists() {
            continue;
        }

        let raw = fs::read_to_string(&ptah_path).unwrap_or_default();
        let v: serde_json::Value = serde_json::from_str(&raw).unwrap_or_default();

        let scene_count = v["escenas"].as_array().map(|a| a.len()).unwrap_or(0);

        metas.push(ProjectMeta {
            id: v["id"].as_str().unwrap_or("").to_string(),
            titulo: v["titulo"].as_str().unwrap_or("Sin título").to_string(),
            version: v["version"].as_str().unwrap_or("2.0").to_string(),
            created_at: v["createdAt"].as_i64().unwrap_or(0),
            updated_at: v["updatedAt"].as_i64().unwrap_or(0),
            scene_count,
        });
    }

    metas.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(metas)
}

#[tauri::command]
pub async fn delete_project<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    tour_id: String,
) -> Result<(), String> {
    let dir = project_dir(&app, &tour_id);
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn list_history<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    tour_id: String,
) -> Result<Vec<String>, String> {
    let hist = history_dir(&app, &tour_id);
    if !hist.exists() {
        return Ok(vec![]);
    }

    let mut snaps: Vec<String> = fs::read_dir(&hist)
        .map_err(|e| e.to_string())?
        .filter_map(|e| {
            e.ok().and_then(|e| {
                let p = e.path();
                if p.extension().and_then(|x| x.to_str()) == Some("ptah") {
                    p.file_stem()
                        .and_then(|s| s.to_str())
                        .map(|s| s.to_string())
                } else {
                    None
                }
            })
        })
        .collect();

    snaps.sort_by(|a, b| b.cmp(a));
    Ok(snaps)
}

#[tauri::command]
pub async fn load_history_snapshot<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    tour_id: String,
    snapshot: String,
) -> Result<String, String> {
    let snap_path = history_dir(&app, &tour_id).join(format!("{}.ptah", snapshot));
    fs::read_to_string(&snap_path).map_err(|e| e.to_string())
}

// ─── Assets ──────────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct CopiedAsset {
    pub relative_path: String,
    pub absolute_path: String,
}

#[tauri::command]
pub async fn copy_asset<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    tour_id: String,
    source_path: String,
) -> Result<CopiedAsset, String> {
    let src = Path::new(&source_path);
    let filename = src
        .file_name()
        .ok_or("Nombre de archivo inválido")?
        .to_string_lossy()
        .to_string();

    let subdir = asset_subdir(&filename);
    let dest_dir = assets_dir(&app, &tour_id).join(subdir);
    fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

    let dest_path = unique_dest(&dest_dir, &filename);
    fs::copy(src, &dest_path).map_err(|e| e.to_string())?;

    let final_name = dest_path.file_name().unwrap().to_string_lossy().to_string();
    Ok(CopiedAsset {
        relative_path: format!("assets/{}/{}", subdir, final_name),
        absolute_path: dest_path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub async fn resolve_asset_path<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    tour_id: String,
    relative_path: String,
) -> Result<String, String> {
    let abs = project_dir(&app, &tour_id).join(&relative_path);
    Ok(abs.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn cleanup_orphan_assets<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    tour_id: String,
    referenced_paths: Vec<String>,
) -> Result<u32, String> {
    let assets = assets_dir(&app, &tour_id);
    if !assets.exists() {
        return Ok(0);
    }

    let mut removed = 0u32;

    for entry in WalkDir::new(&assets)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let abs = entry.path();
        let rel = abs
            .strip_prefix(project_dir(&app, &tour_id))
            .unwrap_or(abs)
            .to_string_lossy()
            .replace('\\', "/");

        if !referenced_paths.contains(&rel) {
            let _ = fs::remove_file(abs);
            removed += 1;
        }
    }

    Ok(removed)
}

// ─── Export ZIP ──────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn export_zip<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    tour_id: String,
    tour_json: String,
    output_path: String,
) -> Result<(), String> {
    let file = fs::File::create(&output_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    // Resolver la ruta al viewer:
    //   - Debug: src-tauri/../public/viewer  (compile-time constant)
    //   - Release: <resource_dir>/viewer     (empaquetado con la app)
    #[cfg(debug_assertions)]
    let viewer_src: PathBuf = {
        let _ = &app; // app se usa en otros comandos de esta fn; silenciar warning debug
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .ok_or("No se puede encontrar el directorio raíz del proyecto")?
            .join("public")
            .join("viewer")
    };

    #[cfg(not(debug_assertions))]
    let viewer_src: PathBuf = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("viewer");

    // ── 1. Assets del proyecto ────────────────────────────────────────────────────
    //
    // Cada asset se trata de dos formas:
    //   a) Se copia a assets/ en el ZIP  → funciona cuando se sirve desde servidor
    //   b) Se codifica como data URL     → funciona con file:// (sin CORS, sin XHR)
    //
    // El viewer usa __PTAH_ASSETS__ (data URLs) cuando existe; en servidor podría
    // usarse el path relativo directamente, pero las data URLs también funcionan.
    let assets_dir_path = assets_dir(&app, &tour_id);
    let mut asset_data_urls: BTreeMap<String, String> = BTreeMap::new();

    if assets_dir_path.exists() {
        let assets_canon = assets_dir_path.canonicalize()
            .unwrap_or_else(|_| assets_dir_path.clone());

        for entry in WalkDir::new(&assets_canon)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
        {
            let abs = entry.path();
            // sub = "images/foo.jpg"
            let sub = abs
                .strip_prefix(&assets_canon)
                .unwrap_or(abs)
                .to_string_lossy()
                .replace('\\', "/");
            // rel_key = "assets/images/foo.jpg"  (coincide con lo guardado en el tour JSON)
            let rel_key = format!("assets/{}", sub);

            let raw = fs::read(abs)
                .map_err(|e| format!("Error leyendo asset {}: {}", rel_key, e))?;

            // a) Copiar el archivo al ZIP
            zip.start_file(&rel_key, options).map_err(|e| e.to_string())?;
            zip.write_all(&raw).map_err(|e| e.to_string())?;

            // b) Generar data URL para file:// mode
            let ext = abs.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            let data_url = format!("data:{};base64,{}", mime_for_ext(&ext), BASE64.encode(&raw));
            asset_data_urls.insert(rel_key, data_url);
        }
    }

    // ── 2. Viewer: canonicalizar, inyectar datos y copiar archivos JS/CSS ────────
    let viewer_src = viewer_src.canonicalize()
        .map_err(|e| format!("No se encontró el viewer en {}: {}", viewer_src.display(), e))?;

    // Inyectar en index.html:
    //   window.__PTAH_ASSETS__  → mapa relPath → data URL (resuelve file:// CORS)
    //   window.__PTAH_TOUR__    → JSON del tour (evita fetch)
    let mut html = fs::read_to_string(viewer_src.join("index.html"))
        .map_err(|e| format!("No se puede leer viewer/index.html: {}", e))?;

    let assets_json = serde_json::to_string(&asset_data_urls).map_err(|e| e.to_string())?;
    let safe_tour   = tour_json.replace("</script>", r"<\/script>");
    let inject = format!(
        "<script>window.__PTAH_ASSETS__={};window.__PTAH_TOUR__={};</script>",
        assets_json, safe_tour
    );
    if html.contains("</head>") {
        html = html.replacen("</head>", &format!("{}\n</head>", inject), 1);
    } else {
        html = format!("{}\n{}", inject, html);
    }

    zip.start_file("index.html", options).map_err(|e| e.to_string())?;
    zip.write_all(html.as_bytes()).map_err(|e| e.to_string())?;

    // Copiar archivos del viewer (js/, css/…) — excluir assets/ de ejemplo
    for entry in WalkDir::new(&viewer_src)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
    {
        let abs = entry.path();
        let rel = abs
            .strip_prefix(&viewer_src)
            .unwrap_or(abs)
            .to_string_lossy()
            .replace('\\', "/");

        // Saltar index.html (ya procesado) y el directorio assets/ del viewer
        // (son archivos de ejemplo estáticos, no los del proyecto)
        if rel == "index.html" || rel.starts_with("assets/") { continue; }

        let mut raw = Vec::new();
        fs::File::open(abs)
            .and_then(|mut f| f.read_to_end(&mut raw))
            .map_err(|e| format!("Error leyendo {}: {}", rel, e))?;

        let content: Vec<u8> = match abs.extension().and_then(|e| e.to_str()) {
            Some("js")  => strip_js(&String::from_utf8_lossy(&raw)).into_bytes(),
            Some("css") => strip_css(&String::from_utf8_lossy(&raw)).into_bytes(),
            _ => raw,
        };

        zip.start_file(&rel, options).map_err(|e| e.to_string())?;
        zip.write_all(&content).map_err(|e| e.to_string())?;
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Helpers de exportación ──────────────────────────────────────────────────

fn mime_for_ext(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" => "image/jpeg",
        "png"          => "image/png",
        "webp"         => "image/webp",
        "gif"          => "image/gif",
        "hdr"          => "image/vnd.radiance",
        "exr"          => "image/x-exr",
        "glb"          => "model/gltf-binary",
        "gltf"         => "model/gltf+json",
        "mp4"          => "video/mp4",
        "webm"         => "video/webm",
        "ogg"          => "video/ogg",
        _              => "application/octet-stream",
    }
}

// ─── Ofuscación básica ────────────────────────────────────────────────────────
// Elimina comentarios de línea (//) y bloque (/* */), respetando strings y
// expresiones regulares. No renombra variables — es suficiente para que el
// código no sea legible directamente sin romper ningún archivo.

fn strip_js(src: &str) -> String {
    let mut out = String::with_capacity(src.len());
    let mut chars = src.chars().peekable();

    while let Some(c) = chars.next() {
        match c {
            // String con comillas simples, dobles o template literal
            '"' | '\'' | '`' => {
                out.push(c);
                let quote = c;
                while let Some(sc) = chars.next() {
                    out.push(sc);
                    if sc == '\\' {
                        if let Some(esc) = chars.next() { out.push(esc); }
                    } else if sc == quote {
                        break;
                    }
                }
            }
            '/' => {
                match chars.peek() {
                    Some('/') => {
                        // Comentario de línea — consumir hasta newline
                        chars.next();
                        for lc in chars.by_ref() {
                            if lc == '\n' { out.push('\n'); break; }
                        }
                    }
                    Some('*') => {
                        // Comentario de bloque — consumir hasta */
                        chars.next();
                        let mut prev = ' ';
                        for bc in chars.by_ref() {
                            if prev == '*' && bc == '/' { break; }
                            if bc == '\n' { out.push('\n'); } // preservar líneas para stack traces
                            prev = bc;
                        }
                    }
                    _ => out.push(c),
                }
            }
            _ => out.push(c),
        }
    }
    out
}

fn strip_css(src: &str) -> String {
    let mut out = String::with_capacity(src.len());
    let mut chars = src.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '/' && chars.peek() == Some(&'*') {
            chars.next();
            let mut prev = ' ';
            for bc in chars.by_ref() {
                if prev == '*' && bc == '/' { break; }
                prev = bc;
            }
        } else {
            out.push(c);
        }
    }
    out
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

fn unique_dest(dir: &Path, filename: &str) -> PathBuf {
    let stem = Path::new(filename)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let ext = Path::new(filename)
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();

    let mut candidate = dir.join(filename);
    let mut counter = 1u32;
    while candidate.exists() {
        candidate = dir.join(format!("{}_{}{}", stem, counter, ext));
        counter += 1;
    }
    candidate
}
