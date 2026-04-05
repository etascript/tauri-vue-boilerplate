/**
 * ground-lock.js
 * Bloquea la cámara a una altura fija en Y.
 * Solución temporal hasta implementar navmesh o física real.
 *
 * Uso: <a-camera ground-lock="height: 1.6; enabled: true">
 */

AFRAME.registerComponent('ground-lock', {

  schema: {
    height:  { type: 'number',  default: 1.6  },
    enabled: { type: 'boolean', default: false }
  },

  tick() {
    if (!this.data.enabled) return;
    if (!this.el.getAttribute('ground-lock')?.includes('true')) return;
    // Fuerza Y constante independiente del movimiento
    this.el.object3D.position.y = this.data.height;

  }

});
