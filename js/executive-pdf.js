(() => {
  const pdfButton = document.querySelector('[data-export="pdf"]');
  if (!pdfButton) return;

  const escHtml = (v) => String(v ?? "").replace(/[&<>'"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const longDateLocal = () => new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date());

  const groupOpen = (rows, keyFn) => {
    const map = new Map();
    rows.forEach((r) => {
      const key = keyFn(r) || "Sin identificar";
      map.set(key, (map.get(key) || 0) + 1);
    });
    return [...map.entries()].map(([label, value]) => ({ label, value })).sort((a,b) => b.value-a.value);
  };

  function buildExecutiveModel() {
    const all = enriched();
    const open = all.filter((r) => r.estado.key !== "cerrado");
    const closed = all.filter((r) => r.estado.key === "cerrado");
    const overdue = open.filter((r) => r.estado.key === "vencido");
    const critical = open.filter((r) => r.estado.key === "critico");
    const next7 = open.filter((r) => r.dias !== null && r.dias >= 0 && r.dias <= 7);
    const noDate = open.filter((r) => r.dias === null);
    const upcoming = open.filter((r) => r.dias !== null && r.dias >= 0 && r.dias <= 30).sort((a,b) => a.dias-b.dias);
    const priorities = open.filter((r) => ["vencido","critico","seguimiento","sinfecha"].includes(r.estado.key))
      .sort((a,b) => a.estado.rank-b.estado.rank || (a.dias ?? 9999)-(b.dias ?? 9999));
    const rate = all.length ? Math.round(closed.length / all.length * 100) : 0;
    const lead = priorities[0] || upcoming[0] || open[0] || all[0] || null;
    const instrumentLoad = groupOpen(open, (r) => instrumentOf(r)).slice(0,5);
    const ownerLoad = groupOpen(open, (r) => r.responsable || "Sin responsable").slice(0,5);
    const statuses = [
      ["Entregados","cerrado"],["En plazo","plazo"],["Seguimiento","seguimiento"],
      ["Críticos","critico"],["Vencidos","vencido"],["Sin fecha","sinfecha"]
    ].map(([label,key]) => ({ label, key, value: all.filter((r) => r.estado.key === key).length }));
    return { all, open, closed, overdue, critical, next7, noDate, upcoming, priorities, rate, lead, instrumentLoad, ownerLoad, statuses };
  }

  function executiveMessage(m) {
    if (!m.all.length) return "No hay registros disponibles para construir una lectura ejecutiva.";
    if (m.overdue.length) return `La cartera requiere intervención inmediata: ${m.overdue.length} compromiso${m.overdue.length===1?"":"s"} vencido${m.overdue.length===1?"":"s"}, ${m.next7.length} con vencimiento en los próximos 7 días y un cumplimiento acumulado de ${m.rate}%.`;
    if (m.critical.length || m.next7.length) return `No hay vencimientos acumulados, pero la ventana inmediata concentra ${m.next7.length} compromiso${m.next7.length===1?"":"s"} en los próximos 7 días. El cumplimiento se ubica en ${m.rate}%.`;
    if (m.noDate.length) return `La cartera no presenta vencimientos inmediatos, aunque ${m.noDate.length} compromiso${m.noDate.length===1?"":"s"} abierto${m.noDate.length===1?"":"s"} aún no tiene${m.noDate.length===1?"":"n"} fecha límite definida.`;
    return `La cartera se encuentra estable: ${m.rate}% de los reportes está entregado y no se identifican alertas críticas en la ventana inmediata.`;
  }

  function managementFocus(m) {
    const items = [];
    if (m.overdue.length) items.push(`Cerrar o reprogramar los ${m.overdue.length} compromisos vencidos, empezando por la prioridad principal.`);
    if (m.next7.length) items.push(`Confirmar responsables y evidencia para los ${m.next7.length} hitos que vencen en los próximos 7 días.`);
    if (m.noDate.length) items.push(`Definir fecha límite para ${m.noDate.length} compromisos abiertos que todavía no cuentan con horizonte temporal.`);
    if (!items.length) items.push("Mantener seguimiento preventivo sobre los próximos hitos y conservar evidencia de cierre actualizada.");
    return items.slice(0,3);
  }

  function openExecutivePdf() {
    const m = buildExecutiveModel();
    const w = window.open("", "_blank");
    if (!w) { alert("El navegador bloqueó la ventana de impresión. Habilita ventanas emergentes para generar el PDF."); return; }
    try { w.opener = null; } catch (_) {}

    const lead = m.lead;
    const leadTitle = lead ? `${lead.estado.label}: ${instrumentAction(lead)}` : "Sin alertas prioritarias";
    const leadCopy = lead ? `${titleOf(lead)} · ${lead.responsable || "Sin responsable"}${lead.fecha_limite ? ` · ${dueText(lead)}` : " · sin fecha límite"}` : "No hay registros disponibles.";
    const priorityRows = m.priorities.slice(0,4).map((r,i) => `<div class="priority-row"><span class="num">${String(i+1).padStart(2,"0")}</span><div><small>${escHtml(instrumentAction(r))}</small><strong>${escHtml(titleOf(r))}</strong><p>${escHtml(r.responsable || "Sin responsable")} · ${escHtml(dueText(r))}</p></div><b class="state ${r.estado.key}">${escHtml(r.estado.label)}</b></div>`).join("") || '<p class="muted">No hay prioridades abiertas.</p>';
    const milestoneRows = m.upcoming.slice(0,5).map((r) => `<div class="milestone"><time>${escHtml(fmtDate(r.fecha_limite,{day:"2-digit",month:"short"}))}</time><div><strong>${escHtml(instrumentAction(r))}</strong><p>${escHtml(titleOf(r))}</p></div><span>${escHtml(dueText(r))}</span></div>`).join("") || '<p class="muted">Sin vencimientos en los próximos 30 días.</p>';
    const focus = managementFocus(m).map((x,i) => `<li><span>${i+1}</span><p>${escHtml(x)}</p></li>`).join("");
    const maxInstrument = Math.max(1, ...m.instrumentLoad.map((x) => x.value));
    const maxOwner = Math.max(1, ...m.ownerLoad.map((x) => x.value));
    const instruments = m.instrumentLoad.map((x) => `<div class="bar-row"><div><span>${escHtml(x.label)}</span><strong>${x.value}</strong></div><i><b style="width:${x.value/maxInstrument*100}%"></b></i></div>`).join("") || '<p class="muted">Sin carga abierta.</p>';
    const owners = m.ownerLoad.map((x) => `<div class="bar-row owner"><div><span>${escHtml(x.label)}</span><strong>${x.value}</strong></div><i><b style="width:${x.value/maxOwner*100}%"></b></i></div>`).join("") || '<p class="muted">Sin carga abierta.</p>';
    const maxStatus = Math.max(1, ...m.statuses.map((x) => x.value));
    const statuses = m.statuses.map((x) => `<div class="status-row"><div><span>${escHtml(x.label)}</span><strong>${x.value}</strong></div><i><b class="${x.key}" style="width:${x.value/maxStatus*100}%"></b></i></div>`).join("");

    const css = `
      @page{size:A4;margin:12mm 13mm 13mm}
      *{box-sizing:border-box}body{margin:0;color:#14212b;font-family:"IBM Plex Sans",Arial,sans-serif;font-size:9pt;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      h1,h2,h3,.serif{font-family:"IBM Plex Serif",Georgia,serif}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #cfd8de;padding-bottom:5mm;margin-bottom:6mm}.brand{font-weight:700;color:#123b5a;letter-spacing:.08em}.brand small{display:block;color:#72808a;font-size:6.8pt;font-weight:500;letter-spacing:.1em;margin-top:1.5mm}.cut{text-align:right;color:#72808a;font-size:7pt;line-height:1.45}
      .eyebrow{font-size:6.5pt;text-transform:uppercase;letter-spacing:.16em;color:#356c90;font-weight:700}.title{font-size:25pt;line-height:1.03;font-weight:500;letter-spacing:-.035em;margin:2mm 0 2mm}.dek{font-size:10pt;line-height:1.5;color:#60717d;max-width:155mm;margin:0 0 6mm}
      .message{padding:6mm 7mm;border:1px solid #d6e0e6;border-radius:4mm;background:linear-gradient(135deg,#f8fbfc,#f1f6f8);margin-bottom:5mm}.message small,.decision small{display:block;font-size:6.5pt;text-transform:uppercase;letter-spacing:.13em;color:#356c90;font-weight:700}.message p{font-family:"IBM Plex Serif",Georgia,serif;font-size:15pt;line-height:1.35;margin:2mm 0 0;color:#173148}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:2.5mm;margin-bottom:5mm}.kpi{border-top:2px solid #173f5f;padding:3mm 2mm 2mm}.kpi span{display:block;font-size:6.5pt;text-transform:uppercase;letter-spacing:.08em;color:#71808a}.kpi strong{display:block;font-family:"IBM Plex Serif",Georgia,serif;font-size:18pt;font-weight:500;margin-top:1.3mm}.kpi small{display:block;color:#7b8790;font-size:6.8pt;margin-top:.8mm}
      .decision{display:grid;grid-template-columns:1.55fr .45fr;gap:6mm;padding:6mm;border:1px solid #d7dfe4;border-radius:4mm;margin-bottom:6mm;break-inside:avoid}.decision h2{font-size:17pt;line-height:1.12;margin:2mm 0 2mm;font-weight:500}.decision p{margin:0;color:#61717b;line-height:1.5}.decision-side{border-left:1px solid #d9e0e4;padding-left:5mm}.decision-side span{display:block;font-size:6.5pt;color:#78858d;text-transform:uppercase;letter-spacing:.09em}.decision-side strong{display:block;font-family:"IBM Plex Serif",Georgia,serif;font-size:18pt;font-weight:500;margin:2mm 0}.decision-side em{font-style:normal;color:#687780;font-size:7pt;line-height:1.45}
      .section{margin-top:5mm}.section-title{display:flex;gap:3mm;align-items:baseline;border-bottom:1px solid #d7dfe4;padding-bottom:2mm;margin-bottom:1mm}.section-title b{font-family:"IBM Plex Serif",Georgia,serif;font-size:17pt;color:#b6c2c9;font-weight:500}.section-title h2{font-size:14pt;margin:0;font-weight:500}.section-title p{margin-left:auto;color:#7a8790;font-size:6.5pt}
      .priority-row{display:grid;grid-template-columns:8mm minmax(0,1fr) auto;gap:3mm;align-items:center;padding:2.8mm 0;border-bottom:1px solid #edf0f2;break-inside:avoid}.num{font-family:"IBM Plex Serif",Georgia,serif;color:#9aa9b2}.priority-row small{display:block;color:#356c90;text-transform:uppercase;font-size:6.2pt;letter-spacing:.05em}.priority-row strong{display:block;font-size:8.4pt;margin-top:.6mm}.priority-row p,.milestone p{margin:.7mm 0 0;color:#6c7982;font-size:7pt}.state{font-size:6.2pt;border-radius:99px;padding:1.1mm 2mm;background:#eef2f4;color:#54636d}.state.vencido,.state.critico{background:#f4e4e4;color:#944242}.state.seguimiento{background:#f7efd9;color:#916819}.state.cerrado{background:#e8f1eb;color:#356c53}
      .focus{margin-top:5mm;padding:5mm 6mm;background:#163b5c;color:#fff;border-radius:4mm}.focus h3{font-size:13pt;font-weight:500;margin:0 0 3mm}.focus ol{list-style:none;padding:0;margin:0;display:grid;gap:2.5mm}.focus li{display:grid;grid-template-columns:6mm 1fr;gap:2mm;align-items:start}.focus li span{width:5mm;height:5mm;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.14);font-size:6pt}.focus li p{margin:0;line-height:1.45;font-size:7.8pt;color:#eef4f7}
      .page2{page-break-before:always}.page2-intro{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:5mm}.page2-intro h2{font-size:21pt;font-weight:500;margin:0}.page2-intro p{margin:0;color:#71808a;max-width:75mm;text-align:right;line-height:1.45}
      .two{display:grid;grid-template-columns:1.05fr .95fr;gap:6mm}.milestone{display:grid;grid-template-columns:18mm 1fr auto;gap:3mm;padding:2.8mm 0;border-bottom:1px solid #edf0f2;break-inside:avoid}.milestone time{font-family:"IBM Plex Serif",Georgia,serif;font-size:11pt;color:#173f5f}.milestone strong{font-size:8pt}.milestone span{font-size:6.5pt;color:#6e7b84}
      .bars{display:grid;gap:2.4mm}.bar-row>div,.status-row>div{display:flex;justify-content:space-between;gap:4mm}.bar-row span,.status-row span{font-size:7pt;color:#53636e}.bar-row strong,.status-row strong{font-size:7pt}.bar-row i,.status-row i{display:block;height:1.2mm;background:#edf0f2;border-radius:99px;overflow:hidden;margin-top:1mm}.bar-row i b{display:block;height:100%;background:#315f7e}.bar-row.owner i b{background:#6e8799}.status-row{margin-bottom:2mm}.status-row i b{display:block;height:100%;background:#6b8496}.status-row i b.cerrado{background:#4d7f66}.status-row i b.vencido,.status-row i b.critico{background:#a35a5a}.status-row i b.seguimiento{background:#b88b38}
      .panel{border:1px solid #dbe2e6;border-radius:3mm;padding:4mm 5mm;break-inside:avoid}.panel h3{font-size:11pt;font-weight:500;margin:0 0 3mm}.portfolio-note{margin-top:5mm;padding-top:3mm;border-top:1px solid #d7dfe4;color:#697780;line-height:1.5}.footer{margin-top:7mm;padding-top:2.5mm;border-top:1px solid #d7dfe4;color:#87939a;font-size:6.3pt}.muted{color:#7b8790}
    `;

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Resumen ejecutivo DCD</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@400;500;600&display=swap" rel="stylesheet"><style>${css}</style></head><body>
      <header><div class="brand">DCD<small>DIRECCIÓN DE CENSOS Y DEMOGRAFÍA</small></div><div class="cut">Resumen ejecutivo<br>${escHtml(longDateLocal())}</div></header>
      <span class="eyebrow">Lectura para decisión</span><h1 class="title">Control de gestión de reportes</h1><p class="dek">Una lectura ejecutiva de las señales que requieren intervención, la presión del calendario y la concentración de la carga operativa.</p>
      <section class="message"><small>En una frase</small><p>${escHtml(executiveMessage(m))}</p></section>
      <section class="kpis"><div class="kpi"><span>Vencidos</span><strong>${m.overdue.length}</strong><small>acción inmediata</small></div><div class="kpi"><span>Próx. 7 días</span><strong>${m.next7.length}</strong><small>ventana crítica</small></div><div class="kpi"><span>Cumplimiento</span><strong>${m.rate}%</strong><small>${m.closed.length} de ${m.all.length} entregados</small></div><div class="kpi"><span>Sin fecha</span><strong>${m.noDate.length}</strong><small>requieren definición</small></div></section>
      <section class="decision"><div><small>Decisión de hoy</small><h2>${escHtml(leadTitle)}</h2><p>${escHtml(leadCopy)}</p></div><div class="decision-side"><span>Responsable</span><strong>${escHtml(lead?.responsable || "—")}</strong><em>${lead?.fecha_limite ? `Fecha límite: ${escHtml(fmtDate(lead.fecha_limite))}` : "Sin fecha límite definida"}</em></div></section>
      <section class="section"><div class="section-title"><b>01</b><h2>Qué requiere gestión inmediata</h2><p>Ordenado por severidad y fecha</p></div>${priorityRows}</section>
      <section class="focus"><h3>Foco de gestión</h3><ol>${focus}</ol></section>

      <section class="page2"><header><div class="brand">DCD<small>DIRECCIÓN DE CENSOS Y DEMOGRAFÍA</small></div><div class="cut">Continuación<br>${escHtml(longDateLocal())}</div></header><div class="page2-intro"><h2>Qué viene después</h2><p>Horizonte próximo, concentración de carga y lectura de cierre del portafolio.</p></div>
      <div class="two"><section><div class="section-title"><b>02</b><h2>Próximos hitos</h2></div>${milestoneRows}</section><section class="panel"><h3>Estado del portafolio</h3><div class="bars">${statuses}</div></section></div>
      <div class="two" style="margin-top:6mm"><section class="panel"><h3>Dónde se concentra la carga · instrumentos</h3><div class="bars">${instruments}</div></section><section class="panel"><h3>Quién concentra la carga · responsables</h3><div class="bars">${owners}</div></section></div>
      <p class="portfolio-note">La lectura debe utilizarse como herramienta de priorización gerencial. El detalle operativo, la evidencia y las observaciones permanecen disponibles en el visor y en la matriz exportable.</p>
      <div class="footer">Fuente: Matriz maestra de seguimiento · DCD. Documento generado automáticamente desde el visor de control de gestión.</div></section>
      <script>document.fonts.ready.then(()=>setTimeout(()=>window.print(),250));<\/script></body></html>`;

    w.document.write(html);
    w.document.close();
  }

  pdfButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    document.querySelector('#export-menu')?.classList.remove('open');
    document.querySelector('#export-toggle')?.setAttribute('aria-expanded','false');
    openExecutivePdf();
  }, true);
})();