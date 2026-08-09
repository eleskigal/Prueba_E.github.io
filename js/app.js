const $ = (s) => document.querySelector(s);
let REPORTES = [];

const diasHasta = (fecha) => {
  if (!fecha) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const fin = new Date(fecha + 'T00:00:00');
  return Math.ceil((fin - hoy) / 86400000);
};

function estadoDerivado(r){
  const fuente = (r.estado_fuente || '').toLowerCase();
  if (fuente === 'entregado') return {key:'cerrado', label:'Entregado'};
  if (fuente === 'atrasado') return {key:'vencido', label:'Atrasado'};

  const d = diasHasta(r.fecha_limite);
  if (d === null) {
    if (fuente === 'en proceso') return {key:'seguimiento', label:'En proceso'};
    if (fuente === 'pendiente') return {key:'sinfecha', label:'Pendiente · sin fecha'};
    return {key:'sinfecha', label:r.estado_fuente || 'Sin estado'};
  }
  if (d < 0) return {key:'vencido', label:'Vencido'};
  if (d === 0) return {key:'critico', label:'Vence hoy'};
  if (d <= 3) return {key:'critico', label:'Crítico'};
  if (d <= 7) return {key:'seguimiento', label:'Seguimiento'};
  return {key:'plazo', label: fuente === 'en proceso' ? 'En proceso' : 'En plazo'};
}

function fmtFecha(v){
  if(!v) return '—';
  return new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v+'T00:00:00'));
}

function safe(v){ return v ?? '—'; }

function render(){
  const q = ($('#buscar').value || '').toLowerCase();
  const filtro = $('#estado').value;
  const rows = REPORTES.map(r => ({...r, estado:estadoDerivado(r)}))
    .filter(r => !q || [r.tema,r.tipo_actividad,r.responsable,r.plataforma,r.nombre_reporte].join(' ').toLowerCase().includes(q))
    .filter(r => !filtro || r.estado.key === filtro);

  const all = REPORTES.map(r=>({...r,estado:estadoDerivado(r)}));
  $('#k-total').textContent = all.length;
  $('#k-cerrados').textContent = all.filter(r=>r.estado.key==='cerrado').length;
  $('#k-criticos').textContent = all.filter(r=>['critico','vencido'].includes(r.estado.key)).length;
  $('#k-responsables').textContent = new Set(all.map(r=>r.responsable).filter(Boolean)).size;

  $('#tbody').innerHTML = rows.map(r=>{
    const d = diasHasta(r.fecha_limite);
    let plazo = 'Sin fecha';
    if (r.estado.key === 'cerrado') plazo = 'Cerrado';
    else if (d !== null) plazo = d < 0 ? `${Math.abs(d)} d vencido` : `${d} d`;
    const title = r.tema || r.tipo_actividad || 'Registro sin tema';
    const secondary = [r.tipo_actividad, r.plataforma, r.nombre_reporte].filter(Boolean).join(' · ');
    return `<tr>
      <td><strong>${title}</strong><small>${secondary || '—'}</small></td>
      <td>${safe(r.responsable)}</td>
      <td>${fmtFecha(r.fecha_limite)}</td>
      <td><span class="badge ${r.estado.key}">${r.estado.label}</span></td>
      <td>${plazo}</td>
      <td><button class="linkbtn" onclick="detalle('${r.id}')">Ver</button></td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="empty">No hay reportes con estos filtros.</td></tr>`;
}

window.detalle = (id) => {
  const r = REPORTES.find(x=>x.id===id); if(!r) return;
  const e = estadoDerivado(r);
  const title = r.tema || r.tipo_actividad || 'Registro';
  $('#drawer-body').innerHTML = `
    <div class="drawer-eyebrow">Fila fuente ${r.fila_fuente} · ${r.id}</div><h2>${title}</h2>
    <span class="badge ${e.key}">${e.label}</span>
    <dl>
      <dt>Actividad</dt><dd>${safe(r.tipo_actividad)}</dd>
      <dt>Tipo de reporte</dt><dd>${safe(r.tipo_reporte)}</dd>
      <dt>Nombre</dt><dd>${safe(r.nombre_reporte)}</dd>
      <dt>Plataforma</dt><dd>${safe(r.plataforma)}</dd>
      <dt>Responsable</dt><dd>${safe(r.responsable)}</dd>
      <dt>Periodicidad</dt><dd>${safe(r.periodicidad || r.periodicidad_reporte)}</dd>
      <dt>Dependencia</dt><dd>${safe(r.dependencia_solicitante)}</dd>
      <dt>Fecha interna</dt><dd>${fmtFecha(r.fecha_reporte_interno)}</dd>
      <dt>Fecha límite</dt><dd>${fmtFecha(r.fecha_limite)}</dd>
      <dt>Entrega interna</dt><dd>${fmtFecha(r.fecha_entrega_interna)}</dd>
      <dt>Entrega solicitante</dt><dd>${fmtFecha(r.fecha_entrega_solicitante)}</dd>
      <dt>Estado matriz</dt><dd>${safe(r.estado_fuente)}</dd>
      <dt>Evidencia</dt><dd>${r.evidencia_disponible ? 'Registrada en la matriz' : 'No registrada'}</dd>
      <dt>Observaciones</dt><dd>${safe(r.observaciones)}</dd>
    </dl>`;
  $('#drawer').classList.add('open');
};

async function init(){
  const res = await fetch('./data/reportes.json', {cache:'no-store'});
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  REPORTES = await res.json();
  $('#buscar').addEventListener('input',render); $('#estado').addEventListener('change',render);
  $('#close').addEventListener('click',()=>$('#drawer').classList.remove('open'));
  render();
}
init().catch(err=>{ $('#tbody').innerHTML=`<tr><td colspan="6">Error cargando datos: ${err.message}</td></tr>`; });
