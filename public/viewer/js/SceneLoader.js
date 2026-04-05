/**
 * SceneLoader.js
 * Motor principal que lee el JSON del tour y construye/destruye escenas A-Frame.
 *
 * Responsabilidades:
 *  - Cargar el JSON de configuración
 *  - Cambiar el cielo 360 (a-sky)
 *  - Inyectar hotspots dinámicamente
 *  - Gestionar la navegación entre escenas
 *  - Actualizar el HUD
 */

window.SceneLoader = (() => {
  // ── Estado interno ───────────────────────────
  let _tourData = null; // JSON completo
  let _currentIdx = 0; // índice de escena activa
  let _sceneMap = {}; // { id: escenaObj } para navegación por id
  let _currentScene = null;
  let _assetMap = {};

  // ── Referencias DOM ──────────────────────────
  const sky = document.getElementById("sky-sphere");
  const hotspotsCt = document.getElementById("hotspots-container");
  const assetCt = document.getElementById("asset-container");
  const hudTitle = document.getElementById("hud-title");
  const hudCounter = document.getElementById("hud-scene-counter");

  // ── Loading screen ────────────────────────────
  const _loader = {
    el: document.getElementById("loading-screen"),
    bar: document.getElementById("loading-bar"),
    title: document.getElementById("loading-title"),
    hint: document.getElementById("loading-hint"),

    show(texto = "Cargando escena") {
      this.title.textContent = texto;
      this.el.classList.remove("hidden");
      this._animate();
    },

    hide() {
      this.bar.style.width = "100%";
      setTimeout(() => this.el.classList.add("hidden"), 400);
    },

    _animate() {
      // Barra de progreso simulada — llega al 85% y espera al modelo
      let w = 0;
      this._raf && cancelAnimationFrame(this._raf);
      const step = () => {
        w = Math.min(w + (85 - w) * 0.04, 85);
        this.bar.style.width = w + "%";
        if (w < 84.9) this._raf = requestAnimationFrame(step);
      };
      step();
    },
  };

  // ── API pública ──────────────────────────────

  /**
   * Carga el archivo JSON y arranca el tour
   * @param {string} jsonPath - Ruta al archivo tour.json
   */
  async function load(jsonPath) {
    try {
      const res = await fetch(jsonPath);
      if (!res.ok) throw new Error(`No se pudo cargar: ${jsonPath}`);
      _tourData = await res.json();

      // Construir mapa id → escena para navegación rápida
      _tourData.escenas.forEach((esc) => {
        _sceneMap[esc.id] = esc;
      });

      // Actualizar título del tour en el HUD
      hudTitle.textContent = _tourData.titulo || "Virtual Tour";

      // Cargar primera escena
      _renderScene(_tourData.escenas[0], 0);
    } catch (err) {
      console.error("[SceneLoader] Error cargando JSON:", err);
      hudTitle.textContent = "⚠ Error cargando el tour";
    }
  }

  /**
   * Carga datos de tour directamente (para preview desde el studio)
   * @param {object} data - Objeto tour completo
   */
  async function loadData(data, startSceneId) {
    try {
      _tourData = data;
      _sceneMap = {};
      _tourData.escenas.forEach(esc => { _sceneMap[esc.id] = esc; });
      hudTitle.textContent = _tourData.titulo || 'Virtual Tour';

      const startEsc = startSceneId
        ? _tourData.escenas.find(s => s.id === startSceneId)
        : null;
      const idx = startEsc ? _tourData.escenas.indexOf(startEsc) : 0;
      _renderScene(startEsc || _tourData.escenas[0], idx);
    } catch (err) {
      console.error('[SceneLoader] Error en loadData:', err);
    }
  }

  // Crear el overlay una sola vez al inicio
  function _createFadeOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "fade-overlay";
    overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: #000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
  `;
    document.body.appendChild(overlay);
    return overlay;
  }

  const _fadeEl = _createFadeOverlay();

  function _fade(duration = 300) {
    return new Promise((resolve) => {
      _fadeEl.style.opacity = "1";
      setTimeout(() => {
        _fadeEl.style.opacity = "0";
        resolve();
      }, duration);
    });
  }

  /**
   * Navega a una escena por su ID
   * @param {string} id - ID de la escena destino
   */
  // pendingPunto: hotspot id to teleport to after the scene loads (optional)
  let _pendingPunto = null;

  function goToScene(id, pendingPunto) {
    const escena = _sceneMap[id];
    if (!escena) {
      console.warn("[SceneLoader] Escena no encontrada:", id);
      return;
    }
    _pendingPunto = pendingPunto || null;
    const idx = _tourData.escenas.indexOf(escena);
    _renderScene(escena, idx >= 0 ? idx : _currentIdx);
  }

  // ── Lógica interna ───────────────────────────
  function _renderScene(escena, idx) {
    _currentScene = escena;
    StateManager.loadSceneVars(escena.vars || {});
    _loader.show(escena.titulo || "Cargando escena");
    _currentIdx = idx;

    // Fondo (independiente del modelo 3D)
    if (escena.skybox && Object.values(escena.skybox).some(Boolean)) {
      _clearSky();
      if (escena.skybox.equirectangular) {
        _loadEquirect(escena.skybox.equirectangular);
      } else {
        _loadSkybox(escena.skybox);
      }
    } else {
      _clearSkybox();
      _loadSky(escena);
    }

    // Modelo 3D (independiente del fondo, puede convivir con cualquier fondo)
    if (escena.modelo3d) {
      _loadModel(escena);
    } else {
      _unloadModel();
    }

    // Limpiar hotspots anteriores
    hotspotsCt.innerHTML = "";
    (escena.hotspots || []).forEach((hs) => _createHotspot(hs));

    // Al final de _renderScene, después de crear todos los hotspots:
    const puntoInicial = escena.hotspots?.find(
      (h) => h.tipo === "teleport" && h.punto_inicial,
    );

    if (_pendingPunto) {
      // Cross-scene teleport to specific hotspot requested (from EffectEngine)
      const hs = (escena.hotspots || []).find(h => h.id === _pendingPunto);
      if (hs) teleportTo(hs.posicion, '0 0 0');
      _pendingPunto = null;
    } else if (puntoInicial) {
      teleportTo(puntoInicial.contenido.posicion, puntoInicial.contenido.rotacion);
    } else if (escena.spawnPosicion) {
      teleportTo(escena.spawnPosicion, escena.spawnRotacion || "0 0 0");
    }

    setTimeout(() => {
      const cursor = document.getElementById("main-cursor");
      if (cursor && cursor.components.raycaster)
        cursor.components.raycaster.refreshObjects();
    }, 200);

    const total = _tourData.escenas.length;
    hudTitle.textContent = escena.titulo || _tourData.titulo;
    hudCounter.textContent = `Escena ${idx + 1} / ${total}`;

    // Cambiar modo de cámara
    const camEl = document.getElementById("main-camera");
    const modo = escena.modo || "look";
    const velocidad = escena.velocidad || 3;
    const groundLock = escena.groundLock || false;
    const groundH = escena.groundHeight || 1.6;

    camEl.setAttribute(
      "keyboard-look",
      `mode: ${modo}; walkSpeed: ${velocidad}`,
    );
    camEl.setAttribute(
      "ground-lock",
      `enabled: ${groundLock}; height: ${groundH}`,
    );

    if (escena.spawnPosicion) {
      teleportTo(escena.spawnPosicion, escena.spawnRotacion || "0 0 0");
    }
  }
  function _loadSky(escena) {
    sky.setAttribute("visible", "true");

    if (escena.imagen360) {
      sky.removeAttribute("src"); // forzar recarga aunque la URL sea la misma
      sky.removeAttribute("color");
      sky.setAttribute("src", SceneLoader.resolveUrl(escena.imagen360));

      // Para imágenes 360, escuchar el evento de carga del a-sky
      sky.addEventListener(
        "materialtextureloaded",
        () => {
          _loader.hide();
          hotspotsCt.style.visibility = "visible";
        },
        { once: true },
      );

      // Fallback
      setTimeout(() => {
        _loader.hide();
        hotspotsCt.style.visibility = "visible";
      }, 10000);
    } else {
      // Color sólido — no hay nada que cargar
      sky.removeAttribute("src");
      sky.setAttribute("color", escena.colorFallback || "#1a1a2e");
      setTimeout(() => {
        _loader.hide();
        hotspotsCt.style.visibility = "visible";
      }, 300);
    }
  }

  function _clearSky() {
    sky.removeAttribute("src");
    sky.setAttribute("color", "#000000");
    sky.setAttribute("visible", "false");
  }

  function _loadSkybox(sb) {
    // Ocultar a-sky — el skybox va directo al background de THREE.js
    sky.setAttribute("visible", "false");

    const sceneEl = document.getElementById("main-scene");
    // Limpiar fondo anterior para forzar recarga
    if (sceneEl?.object3D?.background) sceneEl.object3D.background = null;
    const faces = [sb.px, sb.nx, sb.py, sb.ny, sb.pz, sb.nz];

    if (faces.some(f => !f)) {
      console.warn("[SceneLoader] Skybox incompleto — faltan caras");
      _loader.hide();
      hotspotsCt.style.visibility = "visible";
      return;
    }

    const loader = new THREE.CubeTextureLoader();
    loader.load(
      faces,
      (texture) => {
        sceneEl.object3D.background = texture;
        _loader.hide();
        hotspotsCt.style.visibility = "visible";
      },
      undefined,
      (err) => {
        console.error("[SceneLoader] Error cargando skybox:", err);
        _loader.hide();
        hotspotsCt.style.visibility = "visible";
      }
    );
  }

  function _clearSkybox() {
    const sceneEl = document.getElementById("main-scene");
    if (sceneEl?.object3D?.background) {
      sceneEl.object3D.background = null;
    }
  }

  function _loadEquirect(url) {
    sky.setAttribute("visible", "false");
    const sceneEl = document.getElementById("main-scene");
    // Limpiar fondo anterior para forzar recarga
    if (sceneEl?.object3D?.background) sceneEl.object3D.background = null;
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        sceneEl.object3D.background = texture;
        _loader.hide();
        hotspotsCt.style.visibility = "visible";
      },
      undefined,
      (err) => {
        console.error("[SceneLoader] Error cargando equirectangular:", err);
        _loader.hide();
        hotspotsCt.style.visibility = "visible";
      }
    );
  }

  function _loadModel(escena) {
    // Siempre eliminar y recrear la entidad para forzar recarga (evita caché de A-Frame)
    _unloadModel();

    const modelEntity = document.createElement("a-entity");
    modelEntity.id = "scene-model";

    // Escuchar event antes de agregar al DOM para no perderlo
    modelEntity.addEventListener(
      "model-loaded",
      () => {
        _fixAlphaMaterials(modelEntity);
        _loader.hide();
        hotspotsCt.style.visibility = "visible";
      },
      { once: true },
    );

    document.querySelector("a-scene").appendChild(modelEntity);
    // modelEntity.setAttribute("gltf-model", escena.modelo3d);
    modelEntity.setAttribute("gltf-model", SceneLoader.resolveUrl(escena.modelo3d));
    modelEntity.setAttribute("position", escena.modeloPosicion || "0 0 0");
    modelEntity.setAttribute("scale", escena.modeloEscala || "1 1 1");
    modelEntity.setAttribute("rotation", escena.modeloRotacion || "0 0 0");

    // Fallback — si el modelo tarda más de 15s, mostrar igual
    setTimeout(() => {
      _loader.hide();
      hotspotsCt.style.visibility = "visible";
    }, 15000);
  }

  /**
   * Post-procesa los materiales del modelo para mejorar el renderizado de follaje:
   *  - alphaToCoverage: suaviza bordes de transparencia usando MSAA (antialias ya activado)
   *  - DoubleSide: hojas y arbustos delgados visibles desde ambos lados
   *  - Anisotropía máxima: texturas más nítidas en perspectiva
   */
  function _fixAlphaMaterials(entity) {
    const obj = entity.getObject3D('mesh');
    if (!obj) return;

    const renderer = document.querySelector('a-scene')?.renderer;
    const maxAnisotropy = renderer?.capabilities?.getMaxAnisotropy?.() ?? 4;

    obj.traverse(node => {
      if (!node.isMesh) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach(mat => {
        if (!mat) return;

        // Solo materiales con alpha clip (alphaMode: MASK en GLB)
        // alphaToCoverage suaviza el borde duro usando los samples de MSAA
        if (mat.alphaTest > 0 && !mat.transparent) {
          mat.alphaToCoverage = true;
          mat.alphaTest = 0.1;  // umbral conservador
          mat.depthWrite = true;
          // DoubleSide solo en materiales con alpha (hojas, mallas, arbustos)
          mat.side = THREE.DoubleSide;
        }

        // Anisotropía en todas las texturas difusas: más nítidas en perspectiva
        if (mat.map) {
          mat.map.anisotropy = maxAnisotropy;
          mat.map.needsUpdate = true;
        }

        mat.needsUpdate = true;
      });
    });
  }

  function _unloadModel() {
    sky.setAttribute("visible", "true");
    const modelEntity = document.getElementById("scene-model");
    if (modelEntity) modelEntity.parentNode.removeChild(modelEntity);
  }

  /**
   * Crea una entidad hotspot y la agrega a la escena
   */
  function _createHotspot(hs) {
    const entity = document.createElement("a-entity");
    entity.setAttribute("position", hs.posicion);
    entity.classList.add("hotspot");
    entity.setAttribute("hotspot", `data: ${JSON.stringify(hs)}`);
    hotspotsCt.appendChild(entity);
  }

  function teleportTo(posicion, rotacion) {
    _fade(250);
    const camEl = document.getElementById("main-camera");

    // Mover posición
    const [x, y, z] = posicion.split(" ").map(Number);
    camEl.object3D.position.set(x, y, z);

    // Resetear rotación del keyboard-look al nuevo punto
    const kl = camEl.components["keyboard-look"];
    if (kl && rotacion) {
      const [rx, ry, rz] = rotacion.split(" ").map(Number);
      kl._pitch = rx;
      kl._yaw = ry;
      kl._roll = rz;
    }
  }

  /**
   * Reemplaza solo los hotspots de la escena activa sin recargar el fondo.
   * Llamado por ptah360:hotspots desde el studio.
   */
  function refreshHotspots(hotspots) {
    hotspotsCt.innerHTML = '';
    hotspotsCt.style.visibility = 'visible';
    (hotspots || []).forEach(hs => _createHotspot(hs));
    // Actualizar raycaster del cursor para los nuevos elementos
    setTimeout(() => {
      const cursor = document.getElementById('main-cursor');
      if (cursor?.components?.raycaster) cursor.components.raycaster.refreshObjects();
    }, 100);
  }

  // ── Export ───────────────────────────────────
  return {
    load,
    loadData,
    goToScene,
    teleportTo,
    refreshHotspots,
    getCurrentScene: () => _currentScene,
    getAllScenes: () => _tourData?.escenas || [],
    registerAsset: (path, blobUrl) => { _assetMap[path] = blobUrl; },
    resolveUrl: (path) => { return _assetMap[path] || path; }
  };
})();
