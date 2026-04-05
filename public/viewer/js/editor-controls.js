/**
 * editor-controls.js
 * Pro editor interactions for god mode:
 *   - Click-to-place: click on scene surface → send position to studio
 *   - Drag-to-reposition: click+drag a hotspot to move it
 *   - Scroll-while-dragging: adjust depth along camera→hotspot axis
 */
window.EditorControls = (() => {
  let _enabled    = false;
  let _placeMode  = false;
  let _inGodMode  = false;
  let _drag       = null;   // { entity, id }
  let _canvas     = null;
  let _rc         = null;   // THREE.Raycaster
  let _mv         = null;   // THREE.Vector2
  let _banner     = null;
  let _depthHint  = null;   // tooltip shown during depth scroll

  function _f(n) { return +(Math.round(n * 100) / 100).toFixed(2); }
  function _studio() { return window.parent !== window ? window.parent : window.opener; }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    const scene = document.getElementById('main-scene');
    const attach = () => {
      _canvas = scene.canvas;
      _rc = new THREE.Raycaster();
      _mv = new THREE.Vector2();
      _canvas.addEventListener('click',     _onClick,     true);
      _canvas.addEventListener('mousedown', _onMouseDown, true);
      _canvas.addEventListener('mousemove', _onMouseMove, true);
      _canvas.addEventListener('mouseup',   _onMouseUp,   true);
      _canvas.addEventListener('wheel',     _onWheel,     { capture: true, passive: false });
    };
    if (scene.hasLoaded) attach();
    else scene.addEventListener('loaded', attach, { once: true });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && _placeMode) {
        setPlaceMode(false);
        _studio()?.postMessage({ type: 'ptah360:place-mode-done' }, '*');
      }
    });
  }

  function enable()  { _enabled = true; }
  function disable() {
    _enabled = false; _placeMode = false; _drag = null;
    _showBanner(false);
    if (_canvas) _canvas.style.cursor = '';
  }
  function setGodMode(on) { _inGodMode = on; }

  // ── Place mode ────────────────────────────────────────────────────────────
  function setPlaceMode(on) {
    _placeMode = on;
    if (_canvas) _canvas.style.cursor = on ? 'crosshair' : '';
    _showBanner(on);

    // Suspend look-controls while placing so camera doesn't spin on click
    const camEl = document.getElementById('main-camera');
    if (on) {
      camEl?.setAttribute('look-controls', 'enabled: false');
    } else if (_inGodMode) {
      camEl?.setAttribute('look-controls',
        'enabled: true; pointerLockEnabled: false; reverseMouseDrag: false');
    }
  }

  function _showBanner(on) {
    if (!_banner) {
      _banner = document.createElement('div');
      _banner.style.cssText = `
        display:none; position:fixed; bottom:22px; left:50%; transform:translateX(-50%);
        background:rgba(0,0,0,0.82); border:1px solid rgba(0,229,255,0.45);
        color:#00e5ff; font-size:11px; font-family:monospace; letter-spacing:.07em;
        padding:6px 18px; border-radius:20px; z-index:9999; pointer-events:none;
        white-space:nowrap;
      `;
      _banner.textContent = '⊕  Clic para colocar  ·  Esc cancelar';
      document.body.appendChild(_banner);
    }
    _banner.style.display = on ? 'block' : 'none';
  }

  // ── THREE helpers ─────────────────────────────────────────────────────────
  function _updateMouse(e) {
    const r = _canvas.getBoundingClientRect();
    _mv.x = ((e.clientX - r.left) / r.width)  *  2 - 1;
    _mv.y = -((e.clientY - r.top)  / r.height) *  2 + 1;
  }

  function _getCamera() {
    const el = document.getElementById('main-camera');
    return el?.components?.camera?.camera || el?.getObject3D?.('camera');
  }

  function _getMeshes(excludeHotspots, excludeSky) {
    const sceneEl = document.getElementById('main-scene');
    const ctObj   = document.getElementById('hotspots-container')?.object3D;
    const skyObj  = excludeSky ? document.getElementById('sky-sphere')?.object3D : null;
    const out = [];
    sceneEl.object3D.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      if (excludeHotspots && ctObj) {
        let p = o.parent; while (p) { if (p === ctObj) return; p = p.parent; }
      }
      if (skyObj) {
        let p = o.parent; while (p) { if (p === skyObj) return; p = p.parent; }
      }
      out.push(o);
    });
    return out;
  }

  function _hotspotUnderMouse() {
    const cam = _getCamera();
    if (!cam) return null;
    _rc.setFromCamera(_mv, cam);
    for (const entity of document.querySelectorAll('#hotspots-container > a-entity[hotspot]')) {
      const meshes = [];
      entity.object3D.traverse(o => { if (o.isMesh) meshes.push(o); });
      if (meshes.length && _rc.intersectObjects(meshes, true).length) return entity;
    }
    return null;
  }

  // Try to hit real geometry (excluding sky). Returns null if only sky would be hit.
  function _raycastScenePoint() {
    const cam = _getCamera();
    if (!cam) return null;
    _rc.setFromCamera(_mv, cam);
    // First pass: exclude sky sphere so we only hit actual model/floor geometry
    const noSky = _getMeshes(true, true);
    const hits  = _rc.intersectObjects(noSky, true);
    return hits.length ? hits[0].point : null;
    // (null → caller falls back to 3 m in-front, correct for panorama scenes)
  }

  // Panorama fallback: mantiene la distancia actual del hotspot a la cámara
  // pero mueve en la dirección que apunta el mouse. Requiere que _rc ya tenga
  // el ray actualizado (llamar siempre después de _raycastScenePoint).
  function _panoramaPoint(entity) {
    const camEl = document.getElementById('main-camera');
    if (!camEl) return null;
    const camPos = new THREE.Vector3();
    camEl.object3D.getWorldPosition(camPos);
    const hsPos = new THREE.Vector3();
    entity.object3D.getWorldPosition(hsPos);
    const dist = Math.max(0.3, camPos.distanceTo(hsPos));
    const dir = _rc.ray.direction.clone().normalize();
    return camPos.clone().add(dir.multiplyScalar(dist));
  }

  // ── Fallback: 3 m in front of camera ─────────────────────────────────────
  function _frontPoint() {
    const camEl = document.getElementById('main-camera');
    const pos   = camEl.object3D.position;
    const dir   = new THREE.Vector3(0, 0, -3).applyQuaternion(camEl.object3D.quaternion);
    return { x: pos.x + dir.x, y: pos.y + dir.y, z: pos.z + dir.z };
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  function _onClick(e) {
    if (!_enabled) return;

    // Always suppress click after a drag so hotspot panel doesn't open
    if (_drag) { e.stopPropagation(); e.stopImmediatePropagation(); _drag = null; return; }

    if (!_placeMode) return;
    e.stopPropagation(); e.stopImmediatePropagation();

    _updateMouse(e);
    const pt = _raycastScenePoint() || _frontPoint();
    const camEl = document.getElementById('main-camera');
    const rot   = camEl.object3D.rotation;

    _studio()?.postMessage({
      type: 'ptah360:captured', captureType: 'hotspot',
      position: `${_f(pt.x)} ${_f(pt.y)} ${_f(pt.z)}`,
      rotation: `0 ${_f(rot.y * 180 / Math.PI)} 0`
    }, '*');

    setPlaceMode(false);
    _studio()?.postMessage({ type: 'ptah360:place-mode-done' }, '*');
  }

  function _onMouseDown(e) {
    if (!_enabled || _placeMode) return;
    _updateMouse(e);
    const entity = _hotspotUnderMouse();
    if (!entity) return;

    const id = entity.components?.hotspot?.hotspotData?.id;
    if (!id) return;

    _drag = { entity, id };
    e.stopPropagation(); e.stopImmediatePropagation(); e.preventDefault();
    _canvas.style.cursor = 'grabbing';

    // Suspend camera while dragging
    const camEl = document.getElementById('main-camera');
    camEl.setAttribute('look-controls',  'enabled: false');
    camEl.setAttribute('wasd-controls',  'enabled: false');
    camEl.setAttribute('keyboard-look',  'enabled: false');
  }

  function _onMouseMove(e) {
    if (!_enabled || _placeMode) return;
    _updateMouse(e);

    if (!_drag) {
      const entity = _hotspotUnderMouse();
      _canvas.style.cursor = entity ? 'grab' : '';
      return;
    }

    e.stopPropagation();
    // _raycastScenePoint actualiza _rc internamente; el fallback lo reutiliza
    const pt = _raycastScenePoint() || _panoramaPoint(_drag.entity);
    if (pt) _drag.entity.setAttribute('position', `${_f(pt.x)} ${_f(pt.y)} ${_f(pt.z)}`);
  }

  // ── Scroll: hover over hotspot + scroll to push/pull depth ──────────────
  // Works independently from drag — no need to hold the mouse button.
  const SCROLL_STEP = 0.1; // metres per wheel notch
  let _scrollAccum  = 0;   // accumulator for smooth trackpad input

  function _onWheel(e) {
    if (!_enabled || _placeMode) return;

    // Prefer the currently-dragged entity; fall back to hotspot under cursor
    const entity = _drag?.entity ?? _hotspotUnderMouse();
    if (!entity) return;

    e.preventDefault();
    e.stopPropagation();

    const id = _drag?.id ?? entity.components?.hotspot?.hotspotData?.id;
    if (!id) return;

    // Accumulate deltas so trackpad (many small pixels) and mouse wheel
    // (one big line) both feel like distinct notch steps.
    const pixelDelta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY; // lines→px
    _scrollAccum += pixelDelta;

    const notches = Math.trunc(_scrollAccum / 50); // 50 px ≈ one notch
    if (notches === 0) return;
    _scrollAccum -= notches * 50;

    const camEl = document.getElementById('main-camera');
    const camPos = new THREE.Vector3();
    camEl.object3D.getWorldPosition(camPos);

    const hsPos = new THREE.Vector3();
    entity.object3D.getWorldPosition(hsPos);

    const dir  = hsPos.clone().sub(camPos);
    const dist = dir.length();
    if (dist < 0.01) return;
    dir.normalize();

    const newDist = Math.max(0.3, dist + notches * SCROLL_STEP);
    const newPos  = camPos.clone().add(dir.multiplyScalar(newDist));

    entity.setAttribute('position', `${_f(newPos.x)} ${_f(newPos.y)} ${_f(newPos.z)}`);
    _showDepthHint(newDist);

    // Notify studio so the panel & store stay in sync
    _studio()?.postMessage({
      type: 'ptah360:hotspot-moved',
      id,
      position: `${_f(newPos.x)} ${_f(newPos.y)} ${_f(newPos.z)}`
    }, '*');
  }

  let _depthHintTimer = null;
  function _showDepthHint(dist) {
    if (!_depthHint) {
      _depthHint = document.createElement('div');
      _depthHint.style.cssText = `
        display:none; position:fixed; top:18px; right:18px;
        background:rgba(0,0,0,0.82); border:1px solid rgba(255,152,0,0.5);
        color:#ff9800; font-size:11px; font-family:monospace; letter-spacing:.07em;
        padding:5px 14px; border-radius:16px; z-index:9999; pointer-events:none;
      `;
      document.body.appendChild(_depthHint);
    }
    _depthHint.textContent = `⬤  profundidad: ${dist.toFixed(2)} m`;
    _depthHint.style.display = 'block';
    clearTimeout(_depthHintTimer);
    _depthHintTimer = setTimeout(() => { _depthHint.style.display = 'none'; }, 1200);
  }

  function _onMouseUp(e) {
    if (!_enabled || !_drag) return;
    e.stopPropagation(); e.stopImmediatePropagation();

    const p = _drag.entity.object3D.position;
    _studio()?.postMessage({
      type: 'ptah360:hotspot-moved',
      id: _drag.id,
      position: `${_f(p.x)} ${_f(p.y)} ${_f(p.z)}`
    }, '*');

    // Restore camera controls
    const camEl = document.getElementById('main-camera');
    if (_inGodMode) {
      camEl.setAttribute('look-controls',
        'enabled: true; pointerLockEnabled: false; reverseMouseDrag: false');
      camEl.setAttribute('wasd-controls', 'enabled: true; fly: true; acceleration: 20');
    } else {
      camEl.setAttribute('keyboard-look',
        'enabled: true; speed: 60; enableRoll: false; mouseSens: 0.25');
    }

    _canvas.style.cursor = '';
    _drag = null;
  }

  return { init, enable, disable, setGodMode, setPlaceMode };
})();
