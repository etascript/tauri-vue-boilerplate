/**
 * panel.js
 * PanelManager — controlador del overlay 2D de paneles.
 * Soporta paneles individuales y diálogos (array de pasos con navegación).
 */

window.PanelManager = (() => {
  const overlay  = document.getElementById("panel-overlay");
  const content  = document.getElementById("panel-content");
  const btnClose = document.getElementById("panel-close");

  let _steps   = null;  // null = panel individual, array = modo diálogo
  let _stepIdx = 0;

  btnClose.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  // ── API pública ──────────────────────────────

  /** Panel simple (tipo único) */
  function open(tipo, datos) {
    _steps   = null;
    _stepIdx = 0;
    content.innerHTML = _render(tipo, datos);
    overlay.classList.remove("hidden");
    if (tipo === "trivia")   _bindTrivia(datos, null);
    if (tipo === "decision") _bindDecision(datos, true);
  }

  /** Diálogo: array de pasos { tipo, contenido } */
  function openDialog(pasos) {
    if (!pasos?.length) return;
    _steps   = pasos;
    _stepIdx = 0;
    _showStep();
    overlay.classList.remove("hidden");
  }

  function close() {
    overlay.classList.add("hidden");
    content.innerHTML = "";
    _steps   = null;
    _stepIdx = 0;
  }

  // ── Lógica de diálogo ────────────────────────

  function _showStep() {
    const step   = _steps[_stepIdx];
    const isFirst = _stepIdx === 0;
    const isLast  = _stepIdx >= _steps.length - 1;
    // trivia y decision manejan su propio avance
    const showNavNext = step.tipo !== "decision" && step.tipo !== "trivia";

    content.innerHTML = `
      <div class="dialog-step">
        ${_render(step.tipo, step.contenido)}
        <div class="dialog-nav">
          <div class="dialog-nav-left">
            ${!isFirst ? `<button id="dlg-prev" class="dlg-btn">← Anterior</button>` : ""}
          </div>
          <span class="dialog-counter">${_stepIdx + 1} / ${_steps.length}</span>
          <div class="dialog-nav-right">
            ${showNavNext
              ? `<button id="dlg-next" class="dlg-btn dlg-btn-primary">${isLast ? "Cerrar" : "Siguiente →"}</button>`
              : ""}
          </div>
        </div>
      </div>`;

    if (step.tipo === "trivia")   _bindTrivia(step.contenido, isLast ? null : _nextStep);
    if (step.tipo === "decision") _bindDecision(step.contenido, isLast);

    document.getElementById("dlg-prev")?.addEventListener("click", _prevStep);
    document.getElementById("dlg-next")?.addEventListener("click", isLast ? close : _nextStep);
  }

  function _nextStep() {
    if (_steps && _stepIdx < _steps.length - 1) {
      _stepIdx++;
      _showStep();
    } else {
      close();
    }
  }

  function _prevStep() {
    if (_stepIdx > 0) { _stepIdx--; _showStep(); }
  }

  // ── Renderers ────────────────────────────────

  function _render(tipo, datos) {
    switch (tipo) {
      case "info":     return _renderInfo(datos);
      case "trivia":   return _renderTrivia(datos);
      case "video":    return _renderVideo(datos);
      case "decision": return _renderDecision(datos);
      default:         return `<p>Tipo desconocido: <strong>${tipo}</strong></p>`;
    }
  }

  function _renderInfo({ titulo, texto, imagen } = {}) {
    return `
      ${imagen ? `<img src="${imagen}" alt="${titulo || ""}" style="width:100%;border-radius:8px;margin-bottom:16px;">` : ""}
      <h2>${titulo || ""}</h2>
      <p>${texto || ""}</p>`;
  }

  function _renderTrivia({ pregunta, opciones } = {}) {
    return `
      <h2>Trivia</h2>
      <p class="trivia-question">${pregunta || ""}</p>
      <div class="trivia-options">
        ${(opciones || []).map((op, i) =>
          `<button class="trivia-option" data-index="${i}" data-correct="${op.correcta}">${op.texto}</button>`
        ).join("")}
      </div>
      <p class="trivia-feedback" id="trivia-feedback"></p>`;
  }

  function _renderVideo({ titulo, src, url } = {}) {
    const videoSrc = src || url || "";
    return `
      <h2>${titulo || ""}</h2>
      <video src="${videoSrc}" controls style="width:100%;border-radius:8px;margin-top:12px;"></video>`;
  }

  function _renderDecision({ titulo, descripcion, opciones } = {}) {
    return `
      <h2>${titulo || ""}</h2>
      <p class="panel-desc">${descripcion || ""}</p>
      <div class="panel-opciones">
        ${(opciones || []).map((op, i) =>
          `<button class="panel-opcion" data-idx="${i}">${op.texto}</button>`
        ).join("")}
      </div>`;
  }

  // ── Bindings interactivos ────────────────────

  /**
   * @param {object}        datos       - contenido trivia
   * @param {function|null} onAnswered  - callback tras responder (null = cerrar/no avanzar)
   */
  function _bindTrivia(datos, onAnswered) {
    const buttons  = content.querySelectorAll(".trivia-option");
    const feedback = content.querySelector("#trivia-feedback");

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const esCorrecta = btn.dataset.correct === "true";
        buttons.forEach((b) => b.setAttribute("disabled", true));
        btn.classList.add(esCorrecta ? "correct" : "incorrect");
        if (!esCorrecta) {
          buttons.forEach((b) => { if (b.dataset.correct === "true") b.classList.add("correct"); });
        }
        feedback.textContent = esCorrecta ? "✅ ¡Correcto!" : "❌ Incorrecto. La respuesta correcta está marcada.";
        feedback.style.color = esCorrecta ? "#00e676" : "#ff5252";

        // En modo diálogo: inyectar botón "Siguiente" tras responder
        if (onAnswered) {
          const navRight = content.querySelector(".dialog-nav-right");
          if (navRight) {
            const nextBtn = document.createElement("button");
            nextBtn.className = "dlg-btn dlg-btn-primary";
            nextBtn.textContent = "Siguiente →";
            nextBtn.addEventListener("click", onAnswered);
            navRight.appendChild(nextBtn);
          }
        }
      });
    });
  }

  /**
   * @param {object}  datos   - contenido decision
   * @param {boolean} isLast  - true = cerrar tras elegir, false = avanzar
   */
  function _bindDecision(datos, isLast) {
    document.querySelectorAll(".panel-opcion").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx    = parseInt(btn.dataset.idx);
        const opcion = datos.opciones[idx];
        EffectEngine.run(opcion.efectos);
        if (!isLast && _steps) _nextStep();
        else close();
      });
    });
  }

  // ── Export ───────────────────────────────────
  return { open, openDialog, close };
})();
