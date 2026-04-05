window.EffectEngine = (() => {

  function run(efectos) {
    if (!efectos?.length) return;
    efectos.forEach(ef => _apply(ef));
  }

  function _apply(ef) {
    switch (ef.tipo) {

      case 'set_var':
        StateManager.set(ef.clave, ef.valor);
        break;

      case 'sumar_puntos':
        StateManager.set('puntuacion', StateManager.get('puntuacion') + (ef.valor || 0));
        break;

      case 'ir_escena': {
        // Nuevo formato: { escena, punto }  |  legado: { valor }
        const sceneId = ef.escena || ef.valor;
        const punto   = ef.punto && ef.punto !== 'spawn' ? ef.punto : null;
        if (sceneId) SceneLoader.goToScene(sceneId, punto);
        break;
      }

      case 'mostrar_hotspot':
        _setHotspotVisible(ef.id, true);
        break;

      case 'ocultar_hotspot':
        _setHotspotVisible(ef.id, false);
        break;

      case 'abrir_hotspot': {
        const container = document.getElementById('hotspots-container');
        const entities   = Array.from(container?.querySelectorAll('[hotspot]') || []);
        const target     = entities.find(el => {
          try { return JSON.parse(el.components.hotspot.data.data).id === ef.id; }
          catch { return false; }
        });
        if (target) {
          const data = JSON.parse(target.components.hotspot.data.data);
          if (data.tipo === 'dialogo') PanelManager.openDialog(data.pasos || []);
          else PanelManager.open(data.tipo, data.contenido);
        }
        break;
      }

      case 'mostrar_escena':
        StateManager.set(`__escena_bloqueada_${ef.id}`, false);
        break;

      case 'ocultar_escena':
        StateManager.set(`__escena_bloqueada_${ef.id}`, true);
        break;

      case 'teleport': {
        const currentId = SceneLoader.getCurrentScene?.()?.id;
        const targetScene = ef.escena && ef.escena !== currentId ? ef.escena : null;

        if (targetScene) {
          // Cross-scene: go to scene (uses its spawn). Store pending punto for after load.
          SceneLoader.goToScene(targetScene, ef.punto !== 'spawn' ? ef.punto : null);
        } else {
          // Same scene — resolve punto
          let pos = ef.posicion;
          let rot = ef.rotacion || '0 0 0';

          if (!ef.punto || ef.punto === 'spawn') {
            const sc = SceneLoader.getCurrentScene?.();
            pos = sc?.spawnPosicion || '0 1.6 0';
            rot = sc?.spawnRotacion || '0 0 0';
          } else {
            const container = document.getElementById('hotspots-container');
            const entities = Array.from(container?.querySelectorAll('[hotspot]') || []);
            const target = entities.find(el => {
              try { return JSON.parse(el.components.hotspot.data.data).id === ef.punto; }
              catch { return false; }
            });
            if (target) {
              const data = JSON.parse(target.components.hotspot.data.data);
              pos = data.posicion;
            }
          }
          if (pos) SceneLoader.teleportTo(pos, rot);
        }
        break;
      }
    }
  }

  function _setHotspotVisible(id, visible) {
    const container = document.getElementById('hotspots-container');
    if (!container) return;
    const entities = Array.from(container.querySelectorAll('[hotspot]'));
    const target = entities.find(el => {
      try {
        const data = JSON.parse(el.components['hotspot'].data.data);
        return data.id === id;
      } catch { return false; }
    });
    if (target) target.setAttribute('visible', visible);
  }

  return { run };
})();
