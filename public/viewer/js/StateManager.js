/**
 * StateManager.js
 * Gestiona el estado global de la experiencia.
 * Persiste en memoria durante la sesión.
 */

window.StateManager = (() => {
  let _state = {};
  let _inicial = {};

  // Inicializar desde el JSON del tour
  function init(estado_inicial = {}) {
    _inicial = {
      puntuacion: 0,
      ...estado_inicial,
      vars: { ...(estado_inicial.vars || {}) },
    };
    _state = JSON.parse(JSON.stringify(_inicial)); // copia profunda
    console.log("[StateManager] Inicializado:", _state);
  }

  // Leer variable — busca en vars primero, luego en raíz
  function get(clave) {
    if (clave in _state.vars) return _state.vars[clave];
    if (clave in _state) return _state[clave];
    return undefined;
  }

  // Escribir variable
  function set(clave, valor) {
    if (clave === "puntuacion") {
      _state.puntuacion = valor;
    } else {
      _state.vars[clave] = valor;
    }
    console.log(
      `[StateManager] set("${clave}", ${JSON.stringify(valor)}) →`,
      _state.vars,
    );
  }

  // Sumar a un número
  function add(clave, cantidad) {
    const actual = get(clave);
    set(clave, (Number(actual) || 0) + cantidad);
  }

  // Push a un array
  function push(clave, valor) {
    const actual = get(clave);
    const arr = Array.isArray(actual) ? actual : [];
    arr.push(valor);
    set(clave, arr);
  }

  // Evaluar una condición { clave, operador, valor }
  function evalCondicion(condicion) {
    if (!condicion) return true; // sin condición = siempre visible
    const actual = get(condicion.clave);
    const esperado = condicion.valor;
    switch (condicion.operador) {
      case "==":
        return actual == esperado;
      case "!=":
        return actual != esperado;
      case ">":
        return actual > esperado;
      case ">=":
        return actual >= esperado;
      case "<":
        return actual < esperado;
      case "<=":
        return actual <= esperado;
      case "includes":
        return Array.isArray(actual) && actual.includes(esperado);
      case "!includes":
        return !Array.isArray(actual) || !actual.includes(esperado);
      default:
        return true;
    }
  }

  // Resetear al estado inicial
  function reset() {
    _state = JSON.parse(JSON.stringify(_inicial));
    console.log("[StateManager] Reset:", _state);
  }

  // Ver estado completo (debug)
  function dump() {
    return JSON.parse(JSON.stringify(_state));
  }

  function loadSceneVars(vars = {}) {
    // Resetear solo las vars, mantener puntuación global
    _state.vars = JSON.parse(JSON.stringify(vars));
    console.log("[StateManager] Vars de escena cargadas:", _state.vars);
  }

  return {
    init,
    get,
    set,
    add,
    push,
    evalCondicion,
    reset,
    dump,
    loadSceneVars,
  };
})();
