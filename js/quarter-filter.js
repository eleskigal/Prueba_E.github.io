(() => {
  const baseRenderMatrix = renderMatrix;

  function quarterOf(value) {
    const d = parseDate(value);
    return d ? String(Math.floor(d.getMonth() / 3) + 1) : "sinfecha";
  }

  renderMatrix = function renderMatrixWithQuarter() {
    const selected = document.querySelector("#trimestre")?.value || "";
    if (!selected) return baseRenderMatrix();

    const original = REPORTES;
    REPORTES = original.filter((r) => quarterOf(r.fecha_limite) === selected);
    try {
      baseRenderMatrix();
      const count = document.querySelector("#matrix-count");
      if (count) count.textContent = `${REPORTES.length} registros · ${selected === "sinfecha" ? "sin fecha" : `T${selected}`}`;
    } finally {
      REPORTES = original;
    }
  };

  const bind = () => {
    const slicer = document.querySelector("#trimestre");
    if (!slicer || slicer.dataset.bound) return;
    slicer.dataset.bound = "true";
    slicer.addEventListener("change", () => { quickMode = null; renderMatrix(); });

    const clear = document.querySelector("#clear-filters");
    if (clear) clear.addEventListener("click", () => { slicer.value = ""; renderMatrix(); });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind, { once: true });
  else bind();

  // Control de layout independiente: el visor sigue operativo aun si esta capa no carga.
  const sidebarController = document.createElement("script");
  sidebarController.src = "./js/sidebar.js";
  sidebarController.defer = true;
  document.head.appendChild(sidebarController);
})();