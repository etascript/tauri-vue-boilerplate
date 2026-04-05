// Asset overrides: path → asset:// URL sent from the studio via postMessage
const _assetOverrides = {};
let _sceneReady = false;
let _pendingLoad = null;
let _godMode = false;

// Destination for outgoing messages: parent frame (iframe mode) or opener (popup mode)
const _studio = window.parent !== window ? window.parent : (window.opener || null);

// ── Studio message bus ────────────────────────────────────────────────────────
window.addEventListener('message', (e) => {
  if (!e.data?.type?.startsWith('ptah360:')) return;

  if (e.data.type === 'ptah360:asset') {
    _assetOverrides[e.data.path] = e.data.url;
  }

  if (e.data.type === 'ptah360:load') {
    const tour = _applyAssets(JSON.parse(JSON.stringify(e.data.tour)));
    const sceneId = e.data.activeSceneId || null;
    if (_sceneReady) {
      StateManager.init(tour.estado_inicial || {});
      SceneLoader.loadData(tour, sceneId);
    } else {
      _pendingLoad = { tour, sceneId };
    }
  }

  if (e.data.type === 'ptah360:goto-scene') {
    if (_sceneReady) SceneLoader.goToScene(e.data.sceneId);
  }

  if (e.data.type === 'ptah360:editor-mode') {
    if (_sceneReady) {
      _setGodMode(e.data.enabled);
      EditorControls.setGodMode(e.data.enabled);
      if (e.data.enabled) EditorControls.enable();
      else { EditorControls.disable(); }
    } else {
      _godMode = e.data.enabled;
    }
  }

  if (e.data.type === 'ptah360:place-mode') {
    if (_sceneReady) EditorControls.setPlaceMode(e.data.enabled);
  }

  // Hotspot-only refresh — no background reload
  if (e.data.type === 'ptah360:hotspots') {
    if (_sceneReady) SceneLoader.refreshHotspots(e.data.hotspots);
  }

  // Capturar posición/rotación de la cámara y enviarla al studio
  if (e.data.type === 'ptah360:capture') {
    _captureAndSend(e.data.captureType);
  }
});

// ── Asset & scene helpers ─────────────────────────────────────────────────────
const _SKYBOX_FACES = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

function _resolveOverride(path) {
  if (!path) return null;

  // 1. Export standalone: data URLs injectadas en window.__PTAH_ASSETS__
  if (window.__PTAH_ASSETS__?.[path]) return window.__PTAH_ASSETS__[path];

  // 2. Studio mode: asset:// URLs enviadas via postMessage
  if (_assetOverrides[path]) return _assetOverrides[path];

  // 3. Fuzzy match (normaliza prefijos asset://, ./, /)
  const cleanPath = path.replace(/^(asset:\/\/|\.\/|\/)/, '');
  for (const key in _assetOverrides) {
    const cleanKey = key.replace(/^(asset:\/\/|\.\/|\/)/, '');
    if (cleanKey === cleanPath) return _assetOverrides[key];
  }

  return path;
}

function _applyAssets(tour) {
  tour.escenas = tour.escenas.map(esc => {
    const updated = {
      ...esc,
      // FIX: Usamos nuestra función inteligente para buscar la ruta
      imagen360: _resolveOverride(esc.imagen360),
      modelo3d:  _resolveOverride(esc.modelo3d),
    };
    
    if (esc.skybox) {
      updated.skybox = {};
      for (const face of _SKYBOX_FACES) {
        updated.skybox[face] = _resolveOverride(esc.skybox[face]);
      }
      updated.skybox.equirectangular = _resolveOverride(esc.skybox.equirectangular);
    }
    return updated;
  });

  if (tour.escena_inicio) {
    const idx = tour.escenas.findIndex(s => s.id === tour.escena_inicio);
    if (idx > 0) {
      const [initial] = tour.escenas.splice(idx, 1);
      tour.escenas.unshift(initial);
    }
  }

  return tour;
}

// ── God mode (free camera) ────────────────────────────────────────────────────
function _setGodMode(enabled) {
  _godMode = enabled;
  const cam = document.getElementById('main-camera');
  if (!cam) return;

  const overlay = _getGodOverlay();

  if (enabled) {
    // Disable tour camera controls
    cam.setAttribute('keyboard-look', 'enabled: false');
    // Enable A-Frame free camera: mouse drag + WASD fly
    cam.setAttribute('look-controls', 'enabled: true; pointerLockEnabled: false; reverseMouseDrag: false');
    cam.setAttribute('wasd-controls', 'enabled: true; fly: true; acceleration: 20');
    overlay.style.display = 'flex';
  } else {
    cam.setAttribute('look-controls', 'enabled: false');
    cam.setAttribute('wasd-controls', 'enabled: false');
    cam.setAttribute('keyboard-look', 'enabled: true; speed: 60; enableRoll: false; mouseSens: 0.25');
    overlay.style.display = 'none';
  }
}

function _getGodOverlay() {
  let el = document.getElementById('god-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'god-overlay';
    el.style.cssText = `
      display: none; position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.75); border: 1px solid rgba(52,211,153,0.4);
      color: #34d399; font-size: 11px; font-family: monospace;
      padding: 5px 14px; border-radius: 20px; z-index: 9999;
      pointer-events: none; letter-spacing: 0.08em;
    `;
    el.textContent = '⬡ MODO EDITOR  ·  WASD mover  ·  Arrastrar mirar  ·  Q/E bajar/subir';
    document.body.appendChild(el);
  }
  return el;
}

// ── Coordinate capture ────────────────────────────────────────────────────────
function _f(n) { return +(Math.round(n * 100) / 100).toFixed(2); }

function _captureAndSend(captureType) {
  const cam = document.getElementById('main-camera');
  if (!cam) return;

  const pos = cam.object3D.position;

  if (captureType === 'spawn') {
    const rot = cam.object3D.rotation;
    // Convert radians to degrees
    const toDeg = r => _f(r * (180 / Math.PI));
    _studio?.postMessage({
      type: 'ptah360:captured',
      captureType: 'spawn',
      position: `${_f(pos.x)} ${_f(pos.y)} ${_f(pos.z)}`,
      rotation: `${toDeg(rot.x)} ${toDeg(rot.y)} 0`
    }, '*');
  }

  if (captureType === 'hotspot') {
    // 3m in front of camera (works well for 360° scenes; depth = fixed radius)
    const DEPTH = 3;
    const dir = new THREE.Vector3(0, 0, -DEPTH);
    dir.applyQuaternion(cam.object3D.quaternion);
    _studio?.postMessage({
      type: 'ptah360:captured',
      captureType: 'hotspot',
      position: `${_f(pos.x + dir.x)} ${_f(pos.y + dir.y)} ${_f(pos.z + dir.z)}`,
      rotation: `0 ${_f(cam.object3D.rotation.y * (180 / Math.PI))} 0`
    }, '*');
  }
}

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const scene = document.getElementById('main-scene');

  scene.addEventListener('loaded', () => {
    _sceneReady = true;

    // Apply any pending god mode request
    if (_godMode) _setGodMode(true);

    if (_pendingLoad) {
      StateManager.init(_pendingLoad.tour.estado_inicial || {});
      SceneLoader.loadData(_pendingLoad.tour, _pendingLoad.sceneId);
      _pendingLoad = null;
      return;
    }

    // Iframe or popup mode: wait for studio to send data via postMessage.
    // Only fall back to other sources if there's no studio at all.
    if (_studio) {
      // Studio will respond to ptah360:ready with asset+load messages
      return;
    }

    // Exported standalone build: tour data inlined by the exporter.
    // Pasar por _applyAssets para que las rutas se sustituyan por las data URLs
    // de window.__PTAH_ASSETS__ antes de llegar a A-Frame/THREE.js.
    if (window.__PTAH_TOUR__) {
      const tour = _applyAssets(JSON.parse(JSON.stringify(window.__PTAH_TOUR__)));
      StateManager.init(tour.estado_inicial || {});
      SceneLoader.loadData(tour);
      return;
    }

    const previewRaw = localStorage.getItem('ptah360_preview');
    if (previewRaw) {
      try {
        const data = _applyAssets(JSON.parse(previewRaw));
        StateManager.init(data.estado_inicial || {});
        SceneLoader.loadData(data);
        return;
      } catch (e) {
        console.warn('[Viewer] Preview data inválida:', e);
      }
    }

    fetch('./data/tour.json')
      .then(r => r.json())
      .then(data => {
        StateManager.init(data.estado_inicial || {});
        SceneLoader.loadData(data);
      })
      .catch(err => console.error('[Viewer] Error cargando tour.json:', err));
  });

  EditorControls.init();

  // Notify studio (parent iframe or popup opener)
  _studio?.postMessage({ type: 'ptah360:ready' }, '*');
});
