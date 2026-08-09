const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

let REPORTES = [];
let CAL_DATE = new Date();
let quickMode = null;

const TODAY = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const parseDate = (v) => (v ? new Date(`${v}T00:00:00`) : null);
const daysTo = (v) => {
  const d = parseDate(v);
  return d === null ? null : Math.ceil((d - TODAY()) / 86400000);
};
const safe = (v) => v ?? "—";
const esc = (v) => String(v ?? "").replace(/[&<>'"]/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
}[c]));
const fmtDate = (v, opt = { day: "2-digit", month: "short", year: "numeric" }) =>
  v ? new Intl.DateTimeFormat("es-CO", opt).format(parseDate(v)) : "—";
const monthName = (d) => new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric" })
  .format(d).replace(/^./, (c) => c.toUpperCase());

function state(r) {
  const source = (r.estado_fuente || "").trim().toLowerCase();
  if (source === "entregado") return { key: "cerrado", label: "Entregado", rank: 9 };
  if (source === "atrasado") return { key: "vencido", label: "Atrasado", rank: 0 };

  const d = daysTo(r.fecha_limite);
  if (d === null) {
    if (source === "en proceso") return { key: "seguimiento", label: "En proceso", rank: 4 };
    if (source === "pendiente") return { key: "sinfecha", label: "Pendiente · sin fecha", rank: 3 };
    return { key: "sinfecha", label: r.estado_fuente || "Sin estado", rank: 5 };
  }
  if (d < 0) return { key: "vencido", label: "Vencido", rank: 0 };
  if (d === 0) return { key: "critico", label: "Vence hoy", rank: 1 };
  if (d <= 3) return { key: "critico", label: "Crítico", rank: 1 };
  if (d <= 7) return { key: "seguimiento", label: "Seguimiento", rank: 2 };
  return { key: "plazo", label: source === "en proceso" ? "En proceso" : "En plazo", rank: 6 };
}

function instrumentOf(r) { return r.instrumento || r.tipo_actividad || "Sin instrumento"; }
function actionOf(r) { return r.accion || r.nombre_reporte || null; }
function actionDescriptionOf(r) { return r.descripcion_accion || r.accion_descripcion || r.descripcion || null; }
function titleOf(r) { return r.tema || r.nombre_reporte || instrumentOf(r) || "Registro sin tema"; }
function instrumentAction(r) {
  const instrument = instrumentOf(r);
  const action = actionOf(r);
  return action ? `${instrument} · ${action}` : instrument;
}
function calendarLabel(r) {
  const action = actionOf(r);
  return action ? `${instrumentOf(r)} · ${action}` : instrumentOf(r);
}
function evidenceHref(r) {
  const u = r.evidencia_url;
  return u && typeof u === "string" && /^(https?:\/\/)/i.test(u) ? u : null;
}
function enriched() {
  return REPORTES.map((r) => ({
    ...r,
    instrumento: instrumentOf(r),
    accion: actionOf(r),
    estado: state(r),
    dias: daysTo(r.fecha_limite)
  }));
}
function dueText(r) {
  if (r.estado.key === "cerrado") return "Cerrado";
  if (r.dias === null) return "Sin fecha";
  if (r.dias < 0) return `${Math.abs(r.dias)} d vencido`;
  if (r.dias === 0) return "Hoy";
  return `${r.dias} d`;
}

function go(view) {
  $$(".nav-item").forEach((b) => {
    const active = b.dataset.view === view;
    b.classList.toggle("active", active);
    b.toggleAttribute("aria-current", active);
  });
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${view}`));

  const copy = {
    resumen: ["Control de gestión", "Qué requiere atención, quién responde y cuál es el próximo hito."],
    calendario: ["Calendario de compromisos", "Vencimientos por instrumento, acción y responsable."],
    matriz: ["Matriz de seguimiento", "Consulta el instrumento, la acción y el detalle operativo de cada reporte."]
  }[view];

  $("#page-title").textContent = copy[0];
  $("#page-subtitle").textContent = copy[1];
  history.replaceState(null, "", `#${view}`);
  $("#sidebar").classList.remove("open");

  if (view === "calendario") renderCalendar();
  if (view === "matriz") renderMatrix();
}

function clearMatrixFilters() {
  ["buscar", "estado", "responsable", "instrumento"].forEach((id) => {
    const el = $(`#${id}`);
    if (el) el.value = "";
  });
}

function openMatrix(filters = {}) {
  clearMatrixFilters();
  quickMode = null;
  if (filters.estado) $("#estado").value = filters.estado;
  if (filters.responsable) $("#responsable").value = filters.responsable;
  if (filters.instrumento) $("#instrumento").value = filters.instrumento;
  if (filters.buscar) $("#buscar").value = filters.buscar;
  if (filters.attention) quickMode = "attention";
  if (filters.window7) quickMode = "window7";
  go("matriz");
}
window.openMatrix = openMatrix;

function renderSummary() {
  const all = enriched();
  const open = all.filter((r) => r.estado.key !== "cerrado");
  const overdue = all.filter((r) => r.estado.key === "vencido");
  const next7 = open.filter((r) => r.dias !== null && r.dias >= 0 && r.dias <= 7);
  const upcoming = open.filter((r) => r.dias !== null && r.dias >= 0 && r.dias <= 30)
    .sort((a, b) => a.dias - b.dias);
  const closed = all.filter((r) => r.estado.key === "cerrado");
  const noDate = open.filter((r) => r.dias === null);
  const rate = all.length ? Math.round((closed.length / all.length) * 100) : 0;
  const priority = open
    .filter((r) => ["vencido", "critico", "seguimiento", "sinfecha"].includes(r.estado.key))
    .sort((a, b) => a.estado.rank - b.estado.rank || (a.dias ?? 9999) - (b.dias ?? 9999));
  const lead = priority[0] || upcoming[0] || open[0] || all[0];

  $("#hero-rate").textContent = `${rate}%`;
  $("#progress-orbit").style.setProperty("--progress", `${rate * 3.6}deg`);
  if (lead) {
    $("#hero-title").textContent = lead.estado.key === "cerrado"
      ? "Portafolio sin alertas críticas"
      : `${lead.estado.label}: ${instrumentAction(lead)}`;
    $("#hero-copy").textContent = `${titleOf(lead)} · ${lead.responsable || "Sin responsable"}${lead.fecha_limite ? ` · vence ${fmtDate(lead.fecha_limite)}` : " · sin fecha límite"}`;
    $("#hero-primary").dataset.id = lead.id;
  } else {
    $("#hero-title").textContent = "Sin registros disponibles";
    $("#hero-copy").textContent = "No hay información para priorizar.";
    $("#hero-primary").removeAttribute("data-id");
  }

  const next = upcoming[0];
  $("#hero-next-date").textContent = next ? fmtDate(next.fecha_limite, { day: "2-digit", month: "short" }) : "—";
  $("#hero-next-label").textContent = next ? instrumentAction(next) : "Sin vencimientos próximos";

  const kpis = [
    { label: "Vencidos", value: overdue.length, note: "Gestión inmediata", tone: "red", filter: { estado: "vencido" } },
    { label: "Próximos 7 días", value: next7.length, note: "Ventana crítica", tone: "amber", filter: { window7: true } },
    { label: "Cumplimiento", value: `${rate}%`, note: `${closed.length} de ${all.length} entregados`, tone: "green", filter: { estado: "cerrado" } },
    { label: "Sin fecha", value: noDate.length, note: "Requieren definición", tone: "blue", filter: { estado: "sinfecha" } }
  ];

  $("#summary-kpis").innerHTML = kpis.map((k, i) => `
    <button class="kpi-card interactive" data-kpi="${i}" aria-label="${esc(k.label)}: ${esc(k.value)}. Ver detalle">
      <span class="kpi-accent ${k.tone}"></span>
      <span class="kpi-label">${esc(k.label)}</span>
      <strong class="kpi-value">${esc(k.value)}</strong>
      <span class="kpi-note">${esc(k.note)}</span>
      <span class="kpi-arrow">↗</span>
    </button>`).join("");
  $$('[data-kpi]').forEach((b, i) => { b.onclick = () => openMatrix(kpis[i].filter); });

  $("#priority-alerts").innerHTML = priority.length
    ? priority.slice(0, 5).map((r, i) => `
      <button class="priority-card ${i === 0 ? "featured" : ""}" onclick="detail('${r.id}')">
        <span class="priority-index">${String(i + 1).padStart(2, "0")}</span>
        <span class="priority-content">
          <small>${esc(instrumentAction(r))}</small>
          <strong>${esc(titleOf(r))}</strong>
          <span>${esc(r.responsable || "Sin responsable")} · ${esc(dueText(r))}</span>
        </span>
        <span class="status-pill ${r.estado.key}">${esc(r.estado.label)}</span>
      </button>`).join("")
    : '<div class="empty">No hay prioridades abiertas.</div>';

  const instruments = [...new Set(all.map((r) => r.instrumento))].map((name) => {
    const rows = all.filter((r) => r.instrumento === name);
    const opened = rows.filter((r) => r.estado.key !== "cerrado");
    const nextDue = opened.filter((r) => r.dias !== null && r.dias >= 0).sort((a, b) => a.dias - b.dias)[0];
    return { name, total: rows.length, open: opened.length, next: nextDue };
  }).sort((a, b) => b.open - a.open || b.total - a.total).slice(0, 8);
  const maxI = Math.max(...instruments.map((x) => x.total), 1);
  $("#instrument-map").innerHTML = instruments.map((x) => `
    <button class="instrument-card" data-instrument="${esc(x.name)}">
      <span class="instrument-top"><strong>${esc(x.name)}</strong><em>${x.open} abiertos</em></span>
      <span class="instrument-track"><i style="width:${(x.total / maxI) * 100}%"></i></span>
      <span class="instrument-bottom"><span>${x.total} registros</span><span>${x.next ? `Próx. ${fmtDate(x.next.fecha_limite, { day: "2-digit", month: "short" })}` : "Sin hito próximo"}</span></span>
    </button>`).join("") || '<div class="empty">Sin instrumentos.</div>';
  $$("[data-instrument]").forEach((b) => { b.onclick = () => openMatrix({ instrumento: b.dataset.instrument }); });

  $("#upcoming-list").innerHTML = upcoming.length
    ? upcoming.slice(0, 6).map((r) => {
      const d = parseDate(r.fecha_limite);
      return `<button class="timeline-item" onclick="detail('${r.id}')">
        <span class="date-chip"><strong>${d.getDate()}</strong><span>${new Intl.DateTimeFormat("es-CO", { month: "short" }).format(d)}</span></span>
        <span class="timeline-copy"><strong>${esc(instrumentAction(r))}</strong><small>${esc(titleOf(r))}</small></span>
        <span class="timeline-days">${esc(dueText(r))}</span>
      </button>`;
    }).join("")
    : '<div class="empty">Sin vencimientos en los próximos 30 días.</div>';

  const owners = [...new Set(all.map((r) => r.responsable).filter(Boolean))].map((name) => {
    const rows = all.filter((r) => r.responsable === name);
    const opened = rows.filter((r) => r.estado.key !== "cerrado");
    const risk = opened.filter((r) => ["vencido", "critico"].includes(r.estado.key)).length;
    return { name, total: rows.length, open: opened.length, risk };
  }).sort((a, b) => b.risk - a.risk || b.open - a.open).slice(0, 8);
  const maxO = Math.max(...owners.map((x) => x.open), 1);
  $("#owner-load").innerHTML = owners.map((o) => `
    <button class="owner-row" data-owner="${esc(o.name)}">
      <span class="owner-main"><strong>${esc(o.name)}</strong><small>${o.risk ? `${o.risk} en riesgo` : "Sin alertas críticas"}</small></span>
      <span class="owner-track"><i style="width:${(o.open / maxO) * 100}%"></i></span>
      <span class="owner-count">${o.open}/${o.total}</span>
    </button>`).join("") || '<div class="empty">Sin responsables registrados.</div>';
  $$("[data-owner]").forEach((b) => { b.onclick = () => openMatrix({ responsable: b.dataset.owner }); });

  const statuses = [
    ["Entregados", "cerrado"], ["En plazo", "plazo"], ["Seguimiento", "seguimiento"],
    ["Críticos", "critico"], ["Vencidos", "vencido"], ["Sin fecha", "sinfecha"]
  ].map(([label, key]) => ({ label, key, value: all.filter((r) => r.estado.key === key).length }));
  const maxS = Math.max(...statuses.map((x) => x.value), 1);
  $("#status-breakdown").innerHTML = statuses.map((s) => `
    <button class="status-row" data-status="${s.key}">
      <span class="status-label"><i class="status-dot-mini ${s.key}"></i>${esc(s.label)}</span>
      <span class="status-track"><i style="width:${(s.value / maxS) * 100}%"></i></span>
      <strong>${s.value}</strong>
    </button>`).join("");
  $$("[data-status]").forEach((b) => { b.onclick = () => openMatrix({ estado: b.dataset.status }); });
}

function renderCalendar() {
  const y = CAL_DATE.getFullYear();
  const m = CAL_DATE.getMonth();
  $("#calendar-month").textContent = monthName(CAL_DATE);
  const first = new Date(y, m, 1);
  const start = (first.getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const all = enriched();
  let html = "";

  for (let i = 0; i < 42; i++) {
    let day, cy = y, cm = m, outside = false;
    if (i < start) {
      day = prevDays - start + i + 1;
      cm = m - 1;
      if (cm < 0) { cm = 11; cy--; }
      outside = true;
    } else if (i >= start + days) {
      day = i - start - days + 1;
      cm = m + 1;
      if (cm > 11) { cm = 0; cy++; }
      outside = true;
    } else {
      day = i - start + 1;
    }

    const date = `${cy}-${String(cm + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const events = all.filter((r) => r.fecha_limite === date).sort((a, b) => a.estado.rank - b.estado.rank);
    const td = TODAY();
    const isToday = td.getFullYear() === cy && td.getMonth() === cm && td.getDate() === day;

    html += `<div class="calendar-day ${outside ? "outside" : ""} ${isToday ? "today" : ""}">
      <div class="day-number">${day}</div>
      <div class="day-events">
        ${events.slice(0, 3).map((r) => `<button class="cal-event ${r.estado.key}" onclick="detail('${r.id}')" title="${esc(titleOf(r))} · ${esc(instrumentAction(r))}">${esc(calendarLabel(r))}</button>`).join("")}
        ${events.length > 3 ? `<span class="cal-event plazo">+${events.length - 3} más</span>` : ""}
      </div>
    </div>`;
  }
  $("#calendar-grid").innerHTML = html;

  const monthEvents = all.filter((r) => {
    const d = parseDate(r.fecha_limite);
    return d && d.getFullYear() === y && d.getMonth() === m;
  }).sort((a, b) => a.fecha_limite.localeCompare(b.fecha_limite) || a.estado.rank - b.estado.rank);

  $("#month-agenda").innerHTML = monthEvents.length
    ? monthEvents.map((r) => {
      const d = parseDate(r.fecha_limite);
      return `<button class="agenda-item" onclick="detail('${r.id}')">
        <span class="agenda-date"><strong>${d.getDate()}</strong><span>${new Intl.DateTimeFormat("es-CO", { month: "short" }).format(d)}</span></span>
        <span class="agenda-copy"><strong>${esc(instrumentAction(r))}</strong><small>${esc(titleOf(r))} · ${esc(r.responsable || "Sin responsable")}</small></span>
        <span class="status-pill ${r.estado.key}">${esc(r.estado.label)}</span>
      </button>`;
    }).join("")
    : '<div class="empty">No hay fechas límite registradas en este mes.</div>';
}

function fillFilters() {
  const owners = [...new Set(REPORTES.map((r) => r.responsable).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  $("#responsable").innerHTML = '<option value="">Todos los responsables</option>' + owners.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
  const instruments = [...new Set(REPORTES.map(instrumentOf).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  $("#instrumento").innerHTML = '<option value="">Todos los instrumentos</option>' + instruments.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join("");
}

function renderMatrix() {
  const q = ($("#buscar")?.value || "").trim().toLowerCase();
  const st = $("#estado")?.value || "";
  const owner = $("#responsable")?.value || "";
  const instrument = $("#instrumento")?.value || "";

  let rows = enriched()
    .filter((r) => !q || [r.tema, r.instrumento, r.accion, r.responsable, r.plataforma, r.descripcion_accion, r.descripcion, r.tipo_reporte].join(" ").toLowerCase().includes(q))
    .filter((r) => !st || r.estado.key === st)
    .filter((r) => !owner || r.responsable === owner)
    .filter((r) => !instrument || r.instrumento === instrument);

  if (quickMode === "attention") {
    rows = rows.filter((r) => r.estado.key !== "cerrado" && ["vencido", "critico", "seguimiento", "sinfecha"].includes(r.estado.key));
  } else if (quickMode === "window7") {
    rows = rows.filter((r) => r.estado.key !== "cerrado" && r.dias !== null && r.dias >= 0 && r.dias <= 7);
  }
  quickMode = null;

  rows.sort((a, b) => a.estado.rank - b.estado.rank || (a.dias ?? 9999) - (b.dias ?? 9999));
  $("#matrix-count").textContent = `${rows.length} de ${REPORTES.length} registros`;

  $("#tbody").innerHTML = rows.length
    ? rows.map((r) => `<tr tabindex="0" role="button" aria-label="Abrir detalle de ${esc(titleOf(r))}" onclick="detail('${r.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();detail('${r.id}')} ">
        <td><strong>${esc(titleOf(r))}</strong><small>${esc([r.tipo_reporte, r.plataforma].filter(Boolean).join(" · ") || "—")}</small></td>
        <td><strong>${esc(r.instrumento)}</strong></td>
        <td>${esc(r.accion || "—")}</td>
        <td>${esc(safe(r.responsable))}</td>
        <td>${fmtDate(r.fecha_limite)}</td>
        <td><span class="status-pill ${r.estado.key}">${esc(r.estado.label)}</span></td>
        <td>${esc(dueText(r))}</td>
        <td><button class="linkbtn" tabindex="-1" onclick="event.stopPropagation();detail('${r.id}')">Ver →</button></td>
      </tr>`).join("")
    : '<tr><td colspan="8" class="empty">No hay registros con estos filtros.</td></tr>';
}

window.detail = (id) => {
  const r = enriched().find((x) => x.id === id);
  if (!r) return;
  const evidence = evidenceHref(r);
  const evidenceHtml = evidence
    ? `<a class="evidence-link" href="${esc(evidence)}" target="_blank" rel="noopener noreferrer">Abrir evidencia ↗</a>`
    : (r.evidencia_disponible ? "Registrada en la matriz" : "No registrada");
  const desc = actionDescriptionOf(r);

  $("#drawer-body").innerHTML = `
    <div class="drawer-eyebrow">${esc(r.id)} · fila ${esc(r.fila_fuente)}</div>
    <h2>${esc(titleOf(r))}</h2>
    <span class="status-pill ${r.estado.key}">${esc(r.estado.label)}</span>
    <div class="drawer-summary"><strong>${esc(r.instrumento)}</strong>${r.accion ? ` · Acción ${esc(r.accion)}` : ""}${desc ? `<p>${esc(desc)}</p>` : ""}</div>
    <dl>
      <dt>Instrumento</dt><dd>${esc(r.instrumento)}</dd>
      <dt>Acción / identificador</dt><dd>${esc(r.accion || "—")}</dd>
      <dt>Tipo de reporte</dt><dd>${esc(safe(r.tipo_reporte))}</dd>
      <dt>Plataforma</dt><dd>${esc(safe(r.plataforma))}</dd>
      <dt>Responsable</dt><dd>${esc(safe(r.responsable))}</dd>
      <dt>Periodicidad</dt><dd>${esc(safe(r.periodicidad || r.periodicidad_reporte))}</dd>
      <dt>Dependencia</dt><dd>${esc(safe(r.dependencia_solicitante))}</dd>
      <dt>Fecha interna</dt><dd>${fmtDate(r.fecha_reporte_interno)}</dd>
      <dt>Fecha límite</dt><dd>${fmtDate(r.fecha_limite)}</dd>
      <dt>Entrega interna</dt><dd>${fmtDate(r.fecha_entrega_interna)}</dd>
      <dt>Entrega solicitante</dt><dd>${fmtDate(r.fecha_entrega_solicitante)}</dd>
      <dt>Estado matriz</dt><dd>${esc(safe(r.estado_fuente))}</dd>
      <dt>Evidencia</dt><dd>${evidenceHtml}</dd>
    </dl>
    ${r.observaciones ? `<div class="drawer-section"><h3>Observaciones</h3><p>${esc(r.observaciones)}</p></div>` : ""}`;

  $("#drawer").classList.add("open");
  $("#drawer-backdrop").classList.add("open");
  $("#drawer").setAttribute("aria-hidden", "false");
  $("#close").focus();
};

function closeDrawer() {
  $("#drawer").classList.remove("open");
  $("#drawer-backdrop").classList.remove("open");
  $("#drawer").setAttribute("aria-hidden", "true");
}

async function init() {
  const res = await fetch("./data/reportes.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  REPORTES = await res.json();
  if (window.SOURCE_OVERRIDES) {
    REPORTES = REPORTES.map((r) => ({ ...r, ...(window.SOURCE_OVERRIDES[r.fila_fuente] || {}) }));
  }

  CAL_DATE = new Date();
  $("#updated-at").textContent = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", year: "numeric" }).format(new Date());
  fillFilters();
  renderSummary();
  renderMatrix();
  renderCalendar();

  $$(".nav-item").forEach((b) => b.addEventListener("click", () => go(b.dataset.view)));
  $$('[data-go]').forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.filter === "attention") quickMode = "attention";
    go(b.dataset.go);
  }));
  ["buscar", "estado", "responsable", "instrumento"].forEach((id) => {
    $("#" + id).addEventListener(id === "buscar" ? "input" : "change", renderMatrix);
  });
  $("#clear-filters").addEventListener("click", () => { clearMatrixFilters(); quickMode = null; renderMatrix(); });
  $("#prev-month").onclick = () => { CAL_DATE = new Date(CAL_DATE.getFullYear(), CAL_DATE.getMonth() - 1, 1); renderCalendar(); };
  $("#next-month").onclick = () => { CAL_DATE = new Date(CAL_DATE.getFullYear(), CAL_DATE.getMonth() + 1, 1); renderCalendar(); };
  $("#today-month").onclick = () => { CAL_DATE = new Date(); renderCalendar(); };
  $("#hero-primary").onclick = () => { const id = $("#hero-primary").dataset.id; if (id) detail(id); };
  $("#close").onclick = closeDrawer;
  $("#drawer-backdrop").onclick = closeDrawer;
  $("#mobile-menu").onclick = () => $("#sidebar").classList.toggle("open");
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeDrawer(); $("#sidebar").classList.remove("open"); }
  });

  const initial = ["resumen", "calendario", "matriz"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "resumen";
  go(initial);
}

init().catch((err) => {
  $("#hero-title").textContent = "No fue posible cargar los datos";
  $("#hero-copy").textContent = err.message;
  console.error(err);
});
