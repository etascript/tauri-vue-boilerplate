/**
 * hotspot.js
 * Componente A-Frame que representa un punto interactivo en la escena 360.
 * Recibe los datos del hotspot y delega la apertura del panel correcto.
 *
 * Uso en HTML/JS:
 *   <a-entity hotspot="data: {...}"></a-entity>
 */

AFRAME.registerComponent("hotspot", {
  schema: {
    // Recibe el objeto hotspot completo serializado como JSON string
    data: { type: "string", default: "{}" },
  },

  init() {
    const hotspotData = JSON.parse(this.data.data);
    this.hotspotData = hotspotData;
    this._hovered = false;
    // Cached vectors to avoid per-frame allocations in tick()
    this._camPos = new THREE.Vector3();
    this._hsPos = new THREE.Vector3();

    this._buildVisual(hotspotData.tipo);

    if (this.hotspotData.tipo === "teleport") {
      this.el.setAttribute("visible", window.EditorState?.active || false);

      // Guardar referencia para poder removerlo después
      this._editorToggleHandler = (e) => {
        this.el.setAttribute("visible", e.detail.active);
      };
      window.addEventListener("editor-toggle", this._editorToggleHandler);
    }

    this.el.addEventListener("click", () => this._onClick());
    this.el.addEventListener("mouseenter", () => this._onHover(true));
    this.el.addEventListener("mouseleave", () => this._onHover(false));
  },

  remove() {
    if (this._editorToggleHandler) {
      window.removeEventListener("editor-toggle", this._editorToggleHandler);
    }
  },

  // Billboard + distance-based scale — tick() is sole authority on both.
  // Scale inversely proportional to distance: closer = explicitly bigger.
  // Manual lookAt is more reliable than the look-at attribute after TP/scene changes.
  tick() {
    const cam = document.getElementById('main-camera');
    if (!cam) return;

    // Always face camera (full 3D billboard)
    cam.object3D.getWorldPosition(this._camPos);
    this.el.object3D.lookAt(this._camPos);

    // Distance-based scaling: closer = bigger, farther = smaller
    // Reference size at 3 units; clamped to avoid extremes
    this.el.object3D.getWorldPosition(this._hsPos);
    const dist = this._camPos.distanceTo(this._hsPos);
    const base = this._hovered ? 0.16 : 0.12;
    const s = Math.max(0.04, Math.min(0.5, base * 3 / Math.max(dist, 0.5)));
    if (Math.abs(this.el.object3D.scale.x - s) > 0.001) {
      this.el.object3D.scale.setScalar(s);
    }
  },

  /**
   * Crea la representación visual según el tipo de hotspot
   * tipo: 'info' | 'trivia' | 'navegacion' | 'video'
   */
  _buildVisual(tipo) {
    const colors = {
      info: "#00e5ff",
      trivia: "#ffea00",
      navegacion: "#c61cba",
      video: "#ff4081",
      teleport: "#ff9800",
      decision: "#911787",
    };
    const color = colors[tipo] || "#ffffff";

    // Esfera exterior (anillo pulsante)
    const ring = document.createElement("a-entity");
    ring.setAttribute(
      "geometry",
      "primitive: ring; radiusInner: 0.18; radiusOuter: 0.22",
    );
    ring.setAttribute(
      "material",
      `color: ${color}; shader: flat; opacity: 0.7; side: double`,
    );
    ring.setAttribute(
      "animation",
      "property: scale; from: 1 1 1; to: 1.3 1.3 1; dir: alternate; loop: true; dur: 1200; easing: easeInOutSine",
    );
    ring.setAttribute("rotation", "0 0 0");

    // Icono central (esfera sólida pequeña)
    const core = document.createElement("a-entity");
    core.setAttribute("geometry", "primitive: sphere; radius: 0.12");
    core.setAttribute(
      "material",
      `color: ${color}; shader: flat; opacity: 0.9`,
    );

    // Billboard: handled manually in tick() for reliability after TP/scene changes

    this.el.setAttribute("geometry", "primitive: sphere; radius: 0.25");
    this.el.setAttribute(
      "material",
      "opacity: 0; transparent: true; shader: flat; depthWrite: false",
    );

    this.el.appendChild(ring);
    this.el.appendChild(core);

    // Etiqueta de texto flotante
    if (this.hotspotData.etiqueta) {
      const label = document.createElement("a-text");
      label.setAttribute("value", this.hotspotData.etiqueta);
      label.setAttribute("align", "center");
      label.setAttribute("color", color);
      label.setAttribute("position", "0 0.35 0");
      label.setAttribute("scale", "0.6 0.6 0.6");
      label.setAttribute("font", "exo2bold");
      this.el.appendChild(label);
    }

    this._color = color;
  },

  _onClick() {
    if (window.EditorControls?._drag) return; // ignore clicks ending a drag

    const { tipo, contenido } = this.hotspotData;

    if (tipo === "navegacion") {
      const sceneId = contenido?.escena_destino;
      const punto   = contenido?.punto_destino && contenido.punto_destino !== 'spawn'
        ? contenido.punto_destino : null;
      if (sceneId) window.SceneLoader?.goToScene(sceneId, punto);
      return;
    }

    if (tipo === "teleport") {
      window.SceneLoader?.teleportTo(contenido.posicion, contenido.rotacion || '0 0 0');
      return;
    }

    if (tipo === "dialogo") {
      window.PanelManager?.openDialog(this.hotspotData.pasos || []);
      return;
    }

    window.PanelManager?.open(tipo, contenido);
  },

  _onHover(isEnter) {
    this._hovered = isEnter;
    // Scale is handled entirely by tick() — no attribute animation needed.
  },
});
