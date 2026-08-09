(() => {
  const STORAGE_KEY = 'dcd-matrix-column-widths-v1';
  const DEFAULTS = [300, 190, 135, 190, 132, 126, 92, 64];
  const MINS = [220, 130, 90, 130, 108, 104, 72, 54];
  const MAXS = [520, 360, 260, 360, 220, 220, 170, 110];
  const desktop = () => window.matchMedia('(min-width: 901px)').matches;

  const table = document.querySelector('#view-matriz table');
  if (!table) return;
  table.classList.add('resizable-table');

  let colgroup = table.querySelector('colgroup');
  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    DEFAULTS.forEach((_, index) => {
      const col = document.createElement('col');
      col.dataset.column = String(index);
      colgroup.appendChild(col);
    });
    table.prepend(colgroup);
  }

  const cols = [...colgroup.querySelectorAll('col')];
  const headers = [...table.querySelectorAll('thead th')];
  if (cols.length !== headers.length) return;

  const clamp = (value, index) => Math.max(MINS[index], Math.min(MAXS[index], value));
  const getSaved = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return Array.isArray(parsed) && parsed.length === DEFAULTS.length ? parsed : null;
    } catch (_) {
      return null;
    }
  };
  const widths = (getSaved() || DEFAULTS).map((v, i) => clamp(Number(v) || DEFAULTS[i], i));

  function apply() {
    if (!desktop()) {
      table.style.removeProperty('width');
      return;
    }
    let total = 0;
    cols.forEach((col, index) => {
      const width = clamp(widths[index], index);
      widths[index] = width;
      col.style.width = `${width}px`;
      total += width;
    });
    table.style.width = `${Math.max(total, table.parentElement?.clientWidth || 0)}px`;
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widths));
  }

  function setWidth(index, next, save = true) {
    widths[index] = clamp(Math.round(next), index);
    apply();
    if (save) persist();
  }

  headers.forEach((th, index) => {
    if (index === headers.length - 1) return;
    const handle = document.createElement('span');
    handle.className = 'column-resizer';
    handle.setAttribute('role', 'separator');
    handle.setAttribute('aria-orientation', 'vertical');
    handle.setAttribute('aria-label', `Ajustar ancho de columna ${th.textContent.trim() || index + 1}`);
    handle.tabIndex = 0;
    th.appendChild(handle);

    let startX = 0;
    let startWidth = 0;

    const move = (event) => {
      const x = event.clientX;
      if (typeof x !== 'number') return;
      setWidth(index, startWidth + (x - startX), false);
    };

    const end = () => {
      handle.classList.remove('is-dragging');
      document.body.classList.remove('is-resizing-columns');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      persist();
    };

    handle.addEventListener('pointerdown', (event) => {
      if (!desktop()) return;
      event.preventDefault();
      event.stopPropagation();
      startX = event.clientX;
      startWidth = widths[index];
      handle.setPointerCapture?.(event.pointerId);
      handle.classList.add('is-dragging');
      document.body.classList.add('is-resizing-columns');
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end, { once: true });
      window.addEventListener('pointercancel', end, { once: true });
    });

    handle.addEventListener('dblclick', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setWidth(index, DEFAULTS[index]);
    });

    handle.addEventListener('keydown', (event) => {
      if (!desktop()) return;
      const step = event.shiftKey ? 24 : 8;
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setWidth(index, widths[index] - step);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setWidth(index, widths[index] + step);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setWidth(index, MINS[index]);
      } else if (event.key === 'End') {
        event.preventDefault();
        setWidth(index, MAXS[index]);
      }
    });
  });

  const meta = document.querySelector('#view-matriz .matrix-meta');
  if (meta && !document.querySelector('#reset-columns')) {
    const existing = [...meta.children].filter((node) => node.id !== 'matrix-count');
    const actions = document.createElement('div');
    actions.className = 'matrix-actions';
    existing.forEach((node) => actions.appendChild(node));
    const reset = document.createElement('button');
    reset.id = 'reset-columns';
    reset.className = 'matrix-columns-reset';
    reset.type = 'button';
    reset.textContent = 'Restablecer columnas';
    reset.title = 'Volver a los anchos recomendados';
    actions.prepend(reset);
    meta.appendChild(actions);
  }

  document.querySelector('#reset-columns')?.addEventListener('click', () => {
    DEFAULTS.forEach((value, index) => { widths[index] = value; });
    localStorage.removeItem(STORAGE_KEY);
    apply();
  });

  window.addEventListener('resize', () => requestAnimationFrame(apply), { passive: true });
  apply();
})();
