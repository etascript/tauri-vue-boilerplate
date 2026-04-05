/**
 * keyboard-look.js
 *
 * MODO 'look'  → solo rotación (tours 360 con imagen/esfera)
 * MODO 'walk'  → movimiento libre FPS (escenas con modelos 3D)
 * MODO 'tour'  → igual que look
 *
 * En ambos modos:
 *   A/D        → yaw   (girar izq/der)
 *   W/S        → pitch (mirar arriba/abajo) en modo look/tour
 *               → caminar adelante/atrás    en modo walk
 *   Q/Z        → subir/bajar en eje Y (solo modo walk)
 *   Mouse drag → rotación libre
 *   Espacio    → simula click en el hotspot apuntado
 */

AFRAME.registerComponent("keyboard-look", {
  schema: {
    mode:       { type: "string",  default: "look" },
    speed:      { type: "number",  default: 60 },
    walkSpeed:  { type: "number",  default: 3 },
    mouseSens:  { type: "number",  default: 0.25 },
    enableRoll: { type: "boolean", default: false },
    enabled:    { type: "boolean", default: true },
  },

  init() {
    this._keys  = {};
    this._pitch = 0;
    this._yaw   = 0;
    this._roll  = 0;
    this._mouse = { down: false, lastX: 0, lastY: 0 };

    // ── Teclado ───────────────────────────────────────────────────
    this._onKeyDown = (e) => {
      if (window.__editorFormOpen) return;
      this._keys[e.code] = true;
      if (e.code === "Space") {
        e.preventDefault();
        this._triggerCursorClick();
      }
    };
    this._onKeyUp = (e) => {
      this._keys[e.code] = false;
    };

    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup",   this._onKeyUp);

    // ── Mouse ─────────────────────────────────────────────────────
    this._onMouseDown = (e) => {
      this._mouse.down  = true;
      this._mouse.lastX = e.clientX;
      this._mouse.lastY = e.clientY;
    };
    this._onMouseUp = () => {
      this._mouse.down = false;
    };
    this._onMouseMove = (e) => {
      if (!this._mouse.down) return;
      const dx = e.clientX - this._mouse.lastX;
      const dy = e.clientY - this._mouse.lastY;
      this._yaw   -= dx * this.data.mouseSens;
      this._pitch -= dy * this.data.mouseSens;
      this._pitch  = Math.max(-85, Math.min(85, this._pitch));
      this._mouse.lastX = e.clientX;
      this._mouse.lastY = e.clientY;
    };

    window.addEventListener("mousedown",  this._onMouseDown);
    window.addEventListener("mouseup",    this._onMouseUp);
    window.addEventListener("mousemove",  this._onMouseMove);
  },

  tick(time, delta) {
    if (window.__editorFormOpen) return;
    if (!this.data.enabled) return;

    const dt        = delta / 1000;
    const keys      = this._keys;
    const turnSpeed = this.data.speed * dt;
    const moveSpeed = this.data.walkSpeed * dt;

    // ── Yaw (A/D) — todos los modos ──────────────────────────────
    if (keys["KeyA"]) this._yaw += turnSpeed;
    if (keys["KeyD"]) this._yaw -= turnSpeed;

    // ── Roll — todos los modos si enableRoll ──────────────────────
    if (this.data.enableRoll) {
      if (keys["KeyQ"]) this._roll += turnSpeed;
      if (keys["KeyE"]) this._roll -= turnSpeed;
    }

    // ── Modos de movimiento ───────────────────────────────────────
    if (this.data.mode === "walk") {

      // W/S — caminar en la dirección del yaw
      const yawRad = THREE.MathUtils.degToRad(this._yaw);
      const dx = -Math.sin(yawRad) * moveSpeed;
      const dz = -Math.cos(yawRad) * moveSpeed;
      const pos = this.el.object3D.position;

      if (keys["KeyW"]) { pos.x += dx; pos.z += dz; }
      if (keys["KeyS"]) { pos.x -= dx; pos.z -= dz; }

      // Q/Z — subir/bajar en world Y (sin importar hacia donde miras)
      if (keys["KeyQ"]) pos.y += moveSpeed;
      if (keys["KeyZ"]) pos.y -= moveSpeed;

    } else {
      // MODO look / tour — W/S controlan pitch
      if (keys["KeyW"]) this._pitch += turnSpeed;
      if (keys["KeyS"]) this._pitch -= turnSpeed;
      this._pitch = Math.max(-85, Math.min(85, this._pitch));
    }

    // ── Aplicar rotación ──────────────────────────────────────────
    this.el.object3D.rotation.set(
      THREE.MathUtils.degToRad(this._pitch),
      THREE.MathUtils.degToRad(this._yaw),
      THREE.MathUtils.degToRad(this._roll),
    );
  },

  _triggerCursorClick() {
    const cursorEl = document.getElementById("main-cursor");
    if (!cursorEl) return;
    const raycaster = cursorEl.components.raycaster;
    if (!raycaster) return;
    const intersections = raycaster.intersections;
    if (!intersections || intersections.length === 0) return;
    const target = intersections[0].object.el;
    if (target) target.emit("click", {}, false);
  },

  remove() {
    window.removeEventListener("keydown",    this._onKeyDown);
    window.removeEventListener("keyup",      this._onKeyUp);
    window.removeEventListener("mousedown",  this._onMouseDown);
    window.removeEventListener("mouseup",    this._onMouseUp);
    window.removeEventListener("mousemove",  this._onMouseMove);
  },
});
