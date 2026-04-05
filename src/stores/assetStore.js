/**
 * assetStore — gestión de assets en modo desktop (Tauri).
 *
 * Usa convertFileSrc para generar URLs asset:// (https://asset.localhost/... en Windows)
 * que Tauri sirve directamente desde AppData. Estas URLs funcionan en cualquier
 * contexto del webview: iframes, WebGL/THREE.js, CSS, etc.
 *
 * Map: ruta relativa → { url: asset://, absolutePath, name, size }
 */
import { reactive } from 'vue'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'

// Map: ruta relativa (ej: "assets/images/foto.jpg") → { url, absolutePath, name, size }
export const assets = reactive(new Map())

/**
 * Copia un archivo al directorio de assets del proyecto en AppData
 * y retorna una URL asset:// usable en el viewer (iframes, WebGL, CSS).
 */
export async function registerAsset(tourId, sourcePath, name, size) {
  // En Tauri v2, 'sourcePath' desde el diálogo a veces es un objeto { path, name }.
  const pathString = typeof sourcePath === 'object' && sourcePath !== null ? sourcePath.path : sourcePath;

  const result = await invoke('copy_asset', { tourId, sourcePath: pathString })

  // Soportar tanto snake_case de Rust como camelCase
  const absPath = result.absolutePath || result.absolute_path;
  const relPath = result.relativePath || result.relative_path;

  const url = convertFileSrc(absPath)

  assets.set(relPath, {
    url,
    absolutePath: absPath,
    name: name || relPath.split('/').pop(),
    size: size || 0,
  })

  return { relativePath: relPath, url }
}

/**
 * Carga un asset ya existente en AppData (al abrir un proyecto guardado).
 * Genera una URL asset:// sin necesidad de leer el archivo.
 */
export async function loadExistingAsset(tourId, relativePath) {
  if (assets.has(relativePath)) return assets.get(relativePath).url

  try {
    const absolutePath = await invoke('resolve_asset_path', { tourId, relativePath })
    const url = convertFileSrc(absolutePath)
    assets.set(relativePath, { url, absolutePath, name: relativePath.split('/').pop(), size: 0 })
    return url
  } catch (e) {
    console.warn('[assetStore] No se pudo cargar asset:', relativePath, e)
    return null
  }
}

/**
 * Retorna la URL Blob de un asset registrado.
 * Si no está en el Map, retorna el path relativo tal cual (fallback).
 */
export function getAssetUrl(path) {
  return assets.get(path)?.url ?? path ?? null
}

export function hasAsset(path) {
  return assets.has(path)
}

/**
 * Limpia el Map en memoria.
 * No borra archivos de disco — eso lo hace cleanup_orphan_assets en Rust.
 */
export function clearAssets() {
  assets.clear()
}
