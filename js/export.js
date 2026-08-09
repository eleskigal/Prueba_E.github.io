(() => {
  const COLUMNS = [
    ["Tipo de Reporte/Actividad", (r) => instrumentOf(r)], ["Tema", (r) => r.tema],
    ["Plataforma", (r) => r.plataforma], ["Responsable de información", (r) => r.responsable],
    ["Periodicidad", (r) => r.periodicidad], ["Tipo de Reporte", (r) => r.tipo_reporte],
    ["Nombre del Reporte / Acción", (r) => actionOf(r)], ["Descripción", (r) => actionDescriptionOf(r)],
    ["Periodicidad del Reporte", (r) => r.periodicidad_reporte], ["Dependencia solicitante", (r) => r.dependencia_solicitante],
    ["Fecha límite", (r) => r.fecha_limite], ["Fecha envío solicitud", (r) => r.fecha_envio_solicitud],
    ["Fecha reporte interno", (r) => r.fecha_reporte_interno], ["Fecha entrega interna", (r) => r.fecha_entrega_interna],
    ["Fecha entrega solicitante", (r) => r.fecha_entrega_solicitante], ["Estado", (r) => r.estado_fuente],
    ["Enlaces", (r) => evidenceHref(r)], ["Observaciones", (r) => r.observaciones]
  ];
  const rows = () => REPORTES.map((r) => Object.fromEntries(COLUMNS.map(([k, fn]) => [k, fn(r) ?? ""])));
  const dayStamp = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
  const longDate = () => new Intl.DateTimeFormat("es-CO", { dateStyle: "long" }).format(new Date());

  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function exportCsv() {
    const data = rows(), headers = COLUMNS.map(([k]) => k), q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const text = [headers.map(q).join(","), ...data.map((r) => headers.map((h) => q(r[h])).join(","))].join("\r\n");
    download(new Blob(["\ufeff", text], { type: "text/csv;charset=utf-8" }), `Matriz_Seguimiento_Reportes_${dayStamp()}.csv`);
  }

  function exportXlsx() {
    if (!window.XLSX) { alert("No fue posible cargar el módulo de Excel. Recarga la página e intenta nuevamente."); return; }
    const data = rows(), headers = COLUMNS.map(([k]) => k);
    const ws = XLSX.utils.json_to_sheet(data, { header: headers });
    ws["!cols"] = [24,32,18,25,16,18,24,62,20,24,16,18,18,18,20,16,45,55].map((wch) => ({ wch }));
    data.forEach((r, i) => {
      const u = r.Enlaces, cell = ws[XLSX.utils.encode_cell({ r: i + 1, c: 16 })];
      if (u && cell) cell.l = { Target: u, Tooltip: "Abrir evidencia" };
    });
    const meta = XLSX.utils.aoa_to_sheet([
      ["Matriz de seguimiento · DCD"], ["Fecha de exportación", longDate()], ["Registros", data.length],
      ["Fuente", "Matriz maestra de seguimiento"],
      ["Nota", "La exportación conserva la estructura operativa disponible en el visor. El campo Usuario Reportado permanece fuera de la publicación pública."]
    ]);
    meta["!cols"] = [{ wch: 24 }, { wch: 86 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Matriz de Seguimiento");
    XLSX.utils.book_append_sheet(wb, meta, "Metadatos");
    XLSX.writeFile(wb, `Matriz_Seguimiento_Reportes_${dayStamp()}.xlsx`, { compression: true });
  }

  function model() {
    const all = enriched(), open = all.filter((r) => r.estado.key !== "cerrado"), closed = all.filter((r) => r.estado.key === "cerrado");
    const overdue = all.filter((r) => r.estado.key === "vencido"), next7 = open.filter((r) => r.dias !== null && r.dias >= 0 && r.dias <= 7), noDate = open.filter((r) => r.dias === null);
    const rate = all.length ? Math.round(closed.length / all.length * 100) : 0;
    const priorities = open.filter((r) => ["vencido","critico","seguimiento","sinfecha"].includes(r.estado.key)).sort((a,b) => a.estado.rank-b.estado.rank || (a.dias??9999)-(b.dias??9999)).slice(0,6);
    const upcoming = open.filter((r) => r.dias !== null && r.dias >= 0 && r.dias <= 30).sort((a,b) => a.dias-b.dias).slice(0,6);
    const lead = priorities[0] || upcoming[0] || open[0] || all[0];
    const statuses = [["Entregados","cerrado"],["En plazo","plazo"],["Seguimiento","seguimiento"],["Críticos","critico"],["Vencidos","vencido"],["Sin fecha","sinfecha"]].map(([label,key]) => ({ label,key,value:all.filter((r) => r.estado.key === key).length }));
    return { all, closed, overdue, next7, noDate, rate, priorities, upcoming, lead, statuses };
  }

  function exportPdf() {
    const m = model();
    const w = window.open("", "_blank");
    if (!w) { alert("El navegador bloqueó la ventana de impresión. Habilita ventanas emergentes para generar el PDF."); return; }
    try { w.opener = null; } catch (_) {}
    const leadTitle = m.lead ? `${m.lead.estado.label}: ${instrumentAction(m.lead)}` : "Sin alertas prioritarias";
    const leadCopy = m.lead ? `${titleOf(m.lead)} · ${m.lead.responsable || "Sin responsable"}${m.lead.fecha_limite ? ` · vence ${fmtDate(m.lead.fecha_limite)}` : " · sin fecha límite"}` : "No hay registros disponibles.";
    const kpis = [["Vencidos",m.overdue.length,"Gestión inmediata"],["Próximos 7 días",m.next7.length,"Ventana crítica"],["Cumplimiento",`${m.rate}%`,`${m.closed.length} de ${m.all.length} entregados`],["Sin fecha",m.noDate.length,"Requieren definición"]];
    const priorities = m.priorities.length ? m.priorities.map((r,i) => `<div class="row"><span class="idx">${String(i+1).padStart(2,"0")}</span><div><small>${esc(instrumentAction(r))}</small><strong>${esc(titleOf(r))}</strong><p>${esc(r.responsable || "Sin responsable")} · ${esc(dueText(r))}</p></div><b class="tag ${r.estado.key}">${esc(r.estado.label)}</b></div>`).join("") : '<p class="empty">No hay prioridades abiertas.</p>';
    const upcoming = m.upcoming.length ? m.upcoming.map((r) => `<div class="milestone"><time>${esc(fmtDate(r.fecha_limite,{day:"2-digit",month:"short"}))}</time><div><strong>${esc(instrumentAction(r))}</strong><p>${esc(titleOf(r))}</p></div><span>${esc(dueText(r))}</span></div>`).join("") : '<p class="empty">Sin vencimientos en los próximos 30 días.</p>';
    const mx = Math.max(...m.statuses.map((s) => s.value),1), status = m.statuses.map((s) => `<div class="status"><div><span>${esc(s.label)}</span><strong>${s.value}</strong></div><i><b style="width:${s.value/mx*100}%"></b></i></div>`).join("");
    const css = `@page{size:A4;margin:13mm 14mm 14mm}*{box-sizing:border-box}body{margin:0;color:#14212b;font-family:"IBM Plex Sans",Arial,sans-serif;font-size:9.5pt;background:#fff}header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #cad2d8;padding-bottom:7mm;margin-bottom:7mm}.brand{font-weight:700;color:#123b5a;letter-spacing:.08em}.brand small{display:block;color:#697985;font-weight:500;font-size:7pt;letter-spacing:.1em;margin-top:2mm}.cut{text-align:right;color:#697985;font-size:7.5pt}h1,h2,.lead h3,.kpi strong{font-family:"IBM Plex Serif",Georgia,serif}h1{font-size:25pt;font-weight:500;letter-spacing:-.035em;margin:0 0 2mm}.intro{color:#697985;margin:0 0 6mm}.lead{position:relative;overflow:hidden;padding:8mm;border:1px solid #dbe2e6;border-radius:5mm;background:linear-gradient(135deg,#f8fbfd,#f2f7f9);margin-bottom:6mm;break-inside:avoid}.lead:after{content:"";position:absolute;width:48mm;height:48mm;border-radius:50%;right:-22mm;top:-24mm;background:radial-gradient(circle,rgba(51,111,150,.14),transparent 70%)}.lead small{font-size:7pt;text-transform:uppercase;letter-spacing:.14em;color:#2d678f;font-weight:600}.lead h3{font-size:18pt;line-height:1.08;margin:3mm 0 2mm;font-weight:500}.lead p{margin:0;color:#61717c;line-height:1.5}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;margin-bottom:8mm}.kpi{padding:4mm;border:1px solid #dbe2e6;border-radius:3mm;background:#fff;break-inside:avoid}.kpi span{font-size:7pt;color:#697985;text-transform:uppercase;letter-spacing:.07em}.kpi strong{display:block;font-size:19pt;font-weight:500;margin:2mm 0 1mm}.kpi small{color:#7a8790}.section{margin-top:7mm}.section-head{display:flex;align-items:baseline;gap:3mm;border-bottom:1px solid #dbe2e6;padding-bottom:2mm;margin-bottom:2mm}.section-head b{font-family:"IBM Plex Serif";font-size:16pt;color:#b8c5cd;font-weight:500}.section-head h2{font-size:15pt;font-weight:500;margin:0}.row{display:grid;grid-template-columns:8mm 1fr auto;gap:3mm;align-items:center;padding:3mm 0;border-bottom:1px solid #edf0f2;break-inside:avoid}.idx{font-family:"IBM Plex Serif";color:#9ba9b2}.row small{display:block;text-transform:uppercase;color:#2d678f;font-size:6.7pt;letter-spacing:.05em}.row strong{display:block;margin-top:1mm}.row p,.milestone p{margin:1mm 0 0;color:#697985}.tag{font-size:6.5pt;padding:1.2mm 2mm;border-radius:99px;background:#edf1f3;color:#52616b}.tag.vencido,.tag.critico{background:#f4e5e5;color:#944242}.tag.seguimiento{background:#f7efd9;color:#916819}.tag.cerrado{background:#e8f1eb;color:#356c53}.two{display:grid;grid-template-columns:1.08fr .92fr;gap:6mm;align-items:start}.milestone{display:grid;grid-template-columns:18mm 1fr auto;gap:3mm;padding:3mm 0;border-bottom:1px solid #edf0f2;break-inside:avoid}.milestone time{font-family:"IBM Plex Serif";font-size:11pt;color:#123b5a}.milestone span{color:#697985;font-size:7.5pt}.status{padding:2.5mm 0}.status>div{display:flex;justify-content:space-between}.status span{color:#5d6c76}.status i{display:block;height:1.2mm;background:#edf0f2;margin-top:1.3mm;border-radius:99px;overflow:hidden}.status i b{display:block;height:100%;background:#315f7e}.footer{margin-top:9mm;padding-top:3mm;border-top:1px solid #dbe2e6;color:#84919a;font-size:6.8pt}.empty{color:#7a8790}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`;
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Resumen ejecutivo DCD</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:wght@400;500;600&display=swap" rel="stylesheet"><style>${css}</style></head><body><header><div class="brand">DCD<small>DIRECCIÓN DE CENSOS Y DEMOGRAFÍA</small></div><div class="cut">Resumen ejecutivo<br>${esc(longDate())}</div></header><h1>Control de gestión de reportes</h1><p class="intro">Señales prioritarias, compromisos próximos y lectura del portafolio.</p><section class="lead"><small>Señal principal</small><h3>${esc(leadTitle)}</h3><p>${esc(leadCopy)}</p></section><section class="kpis">${kpis.map((k) => `<div class="kpi"><span>${esc(k[0])}</span><strong>${esc(k[1])}</strong><small>${esc(k[2])}</small></div>`).join("")}</section><section class="section"><div class="section-head"><b>01</b><h2>Prioridades operativas</h2></div>${priorities}</section><div class="two"><section class="section"><div class="section-head"><b>02</b><h2>Próximos hitos</h2></div>${upcoming}</section><section class="section"><div class="section-head"><b>03</b><h2>Estado del portafolio</h2></div>${status}</section></div><div class="footer">Fuente: Matriz maestra de seguimiento · DCD. Documento generado desde el visor de control de gestión.</div><script>document.fonts.ready.then(()=>setTimeout(()=>window.print(),300));<\/script></body></html>`);
    w.document.close();
  }

  function closeMenu() { const m=document.querySelector("#export-menu"), t=document.querySelector("#export-toggle"); if(!m||!t)return; m.classList.remove("open"); t.setAttribute("aria-expanded","false"); }
  function init() {
    const t=document.querySelector("#export-toggle"), m=document.querySelector("#export-menu"); if(!t||!m)return;
    t.addEventListener("click",(e)=>{e.stopPropagation();const on=m.classList.toggle("open");t.setAttribute("aria-expanded",String(on));});
    m.addEventListener("click",(e)=>e.stopPropagation());
    document.querySelector('[data-export="xlsx"]')?.addEventListener("click",()=>{closeMenu();exportXlsx();});
    document.querySelector('[data-export="pdf"]')?.addEventListener("click",()=>{closeMenu();exportPdf();});
    document.querySelector('[data-export="csv"]')?.addEventListener("click",()=>{closeMenu();exportCsv();});
    document.addEventListener("click",closeMenu); document.addEventListener("keydown",(e)=>{if(e.key==="Escape")closeMenu();});
  }
  init();
})();