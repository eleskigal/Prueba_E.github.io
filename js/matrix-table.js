(() => {
  const STORAGE_KEY = 'dcd-matrix-column-widths-v2';
  const DEFAULTS = [300, 190, 135, 190, 132, 126, 92, 280, 64];
  const MINS = [220, 130, 90, 130, 108, 104, 72, 180, 54];
  const MAXS = [520, 360, 260, 360, 220, 220, 170, 520, 110];
  const desktop = () => window.matchMedia('(min-width: 901px)').matches;
  const collator = new Intl.Collator('es-CO', { sensitivity: 'base', numeric: true });

  const table = document.querySelector('#view-matriz table');
  const toolbar = document.querySelector('#view-matriz .matrix-toolbar');
  if (!table || !toolbar) return;

  // Segmentadores adicionales: Tema y Plataforma.
  function ensureFilter(id, label, firstOption) {
    let select = document.querySelector(`#${id}`);
    if (select) return select;
    select = document.createElement('select');
    select.id = id;
    select.setAttribute('aria-label', label);
    select.innerHTML = `<option value="">${firstOption}</option>`;
    const quarter = document.querySelector('#trimestre');
    toolbar.insertBefore(select, quarter || null);
    return select;
  }
  const topicFilter = ensureFilter('tema', 'Filtrar por tema', 'Todos los temas');
  const platformFilter = ensureFilter('plataforma', 'Filtrar por plataforma', 'Todas las plataformas');

  // Observaciones como columna operativa visible, antes de la acción de detalle.
  const headerRow = table.querySelector('thead tr');
  if (headerRow && !headerRow.querySelector('[data-matrix-column="observaciones"]')) {
    const th = document.createElement('th');
    th.textContent = 'Observaciones';
    th.dataset.matrixColumn = 'observaciones';
    headerRow.insertBefore(th, headerRow.lastElementChild);
  }

  table.classList.add('resizable-table');

  const baseFillFilters = fillFilters;
  fillFilters = function fillFiltersExtended() {
    baseFillFilters();
    const topics = [...new Set(REPORTES.map((r) => r.tema).filter(Boolean))].sort(collator.compare);
    const platforms = [...new Set(REPORTES.map((r) => r.plataforma).filter(Boolean))].sort(collator.compare);
    topicFilter.innerHTML = '<option value="">Todos los temas</option>' + topics.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
    platformFilter.innerHTML = '<option value="">Todas las plataformas</option>' + platforms.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('');
  };

  const baseClearMatrixFilters = clearMatrixFilters;
  clearMatrixFilters = function clearMatrixFiltersExtended() {
    baseClearMatrixFilters();
    topicFilter.value = '';
    platformFilter.value = '';
  };

  let sortState = { key: null, direction: 'asc' };
  const sortKeys = ['reporte', 'instrumento', 'accion', 'responsable', 'fecha_limite', 'estado', 'plazo', 'observaciones', null];

  function recordValue(record, key) {
    if (!record) return '';
    switch (key) {
      case 'reporte': return titleOf(record) || '';
      case 'instrumento': return instrumentOf(record) || '';
      case 'accion': return actionOf(record) || '';
      case 'responsable': return record.responsable || '';
      case 'fecha_limite': return record.fecha_limite || '';
      case 'estado': return state(record).label || '';
      case 'plazo': {
        const d = daysTo(record.fecha_limite);
        return d === null ? Number.POSITIVE_INFINITY : d;
      }
      case 'observaciones': return record.observaciones || '';
      default: return '';
    }
  }

  function rowId(row) {
    const handler = row.getAttribute('onclick') || '';
    return handler.match(/detail\('([^']+)'\)/)?.[1] || null;
  }

  function ensureObservationCells() {
    const byId = new Map(REPORTES.map((r) => [String(r.id), r]));
    table.querySelectorAll('tbody tr').forEach((row) => {
      const empty = row.querySelector('td.empty');
      if (empty) {
        empty.colSpan = 9;
        return;
      }
      if (row.querySelector('.matrix-observations-cell')) return;
      const id = rowId(row);
      const record = id ? byId.get(String(id)) : null;
      const cell = document.createElement('td');
      cell.className = 'matrix-observations-cell';
      const text = record?.observaciones || '—';
      cell.textContent = text;
      if (record?.observaciones) cell.title = record.observaciones;
      row.insertBefore(cell, row.lastElementChild);
    });
  }

  function applySort() {
    if (!sortState.key) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const records = new Map(enriched().map((r) => [String(r.id), r]));
    const rows = [...tbody.querySelectorAll('tr')].filter((row) => !row.querySelector('td.empty'));
    const factor = sortState.direction === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const ra = records.get(String(rowId(a)));
      const rb = records.get(String(rowId(b)));
      const va = recordValue(ra, sortState.key);
      const vb = recordValue(rb, sortState.key);
      if (typeof va === 'number' || typeof vb === 'number') {
        const na = Number(va), nb = Number(vb);
        return ((Number.isFinite(na) ? na : 1e12) - (Number.isFinite(nb) ? nb : 1e12)) * factor;
      }
      return collator.compare(String(va ?? ''), String(vb ?? '')) * factor;
    });
    rows.forEach((row) => tbody.appendChild(row));
  }

  const baseRenderMatrix = renderMatrix;
  renderMatrix = function renderMatrixExtended() {
    const selectedTopic = topicFilter.value || '';
    const selectedPlatform = platformFilter.value || '';
    const original = REPORTES;
    REPORTES = original
      .filter((r) => !selectedTopic || r.tema === selectedTopic)
      .filter((r) => !selectedPlatform || r.plataforma === selectedPlatform);
    try {
      baseRenderMatrix();
      ensureObservationCells();
      applySort();
    } finally {
      REPORTES = original;
    }
  };

  [topicFilter, platformFilter].forEach((select) => {
    select.addEventListener('change', () => { quickMode = null; renderMatrix(); });
  });

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

  function applyWidths() {
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
    applyWidths();
    if (save) persist();
  }

  function syncSortHeaders() {
    headers.forEach((th, index) => {
      const key = sortKeys[index];
      if (!key) return;
      const active = sortState.key === key;
      th.classList.toggle('is-sorted', active);
      th.dataset.sortDirection = active ? sortState.direction : 'none';
      th.setAttribute('aria-sort', active ? (sortState.direction === 'asc' ? 'ascending' : 'descending') : 'none');
    });
  }

  headers.forEach((th, index) => {
    const key = sortKeys[index];
    if (key) {
      th.classList.add('sortable-column');
      th.tabIndex = 0;
      th.title = 'Ordenar columna';
      const toggleSort = () => {
        sortState = sortState.key === key
          ? { key, direction: sortState.direction === 'asc' ? 'desc' : 'asc' }
          : { key, direction: 'asc' };
        syncSortHeaders();
        renderMatrix();
      };
      th.addEventListener('click', (event) => {
        if (event.target.closest('.column-resizer')) return;
        toggleSort();
      });
      th.addEventListener('keydown', (event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.target.classList.contains('column-resizer')) {
          event.preventDefault();
          toggleSort();
        }
      });
    }

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
    handle.addEventListener('click', (event) => event.stopPropagation());
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
      if (event.key === 'ArrowLeft') { event.preventDefault(); event.stopPropagation(); setWidth(index, widths[index] - step); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); event.stopPropagation(); setWidth(index, widths[index] + step); }
      else if (event.key === 'Home') { event.preventDefault(); event.stopPropagation(); setWidth(index, MINS[index]); }
      else if (event.key === 'End') { event.preventDefault(); event.stopPropagation(); setWidth(index, MAXS[index]); }
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
    applyWidths();
  });

  window.addEventListener('resize', () => requestAnimationFrame(applyWidths), { passive: true });
  syncSortHeaders();
  applyWidths();
})();
