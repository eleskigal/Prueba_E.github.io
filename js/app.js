const $ = (s) => document.querySelector(s);
let REPORTES = [];

const diasHasta = (fecha) => {
  if (!fecha) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const fin = new Date(fecha + 'T00:00:00');
  return Math.ceil((fin - hoy) / 86400000);
};

function estadoDerivado(r){
  if (r.fecha_entrega) return {key:'cerrado', label:'Entregado'};
  const d = diasHasta(r.fecha_limite);
  if (d < 0) return {key:'vencido', label:'Vencido'};
  if (d === 0) return {key:'critico', label:'Vence hoy'};
  if (d <= 3) return {key:'critico', label:'Crítico'};
  if (d <= 7) return {key:'seguimiento', label:'Seguimiento'};
  return {key:'plazo', label:'En plazo'};
}

function fmtFecha(v){
  if(!v) return '—';
  return new Intl.DateTimeFormat('es-CO',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(v+'T00:00:00'));
}

function render(){
  const q = ($('#buscar').value || '').toLowerCase();
  const filtro = $('#estado').value;
  const rows = REPORTES.map(r => ({...r, estado:estadoDerivado(r)}))
    .filter(r => !q || [r.tema,r.tipo,r.responsable,r.plataforma].join(' ').toLowerCase().includes(q))
    .filter(r => !filtro || r.estado.key === filtro);

  const all = REPORTES.map(r=>({...r,estado:estadoDerivado(r)}));
  $('#k-total').textContent = all.length;
  $('#k-cerrados').textContent = all.filter(r=>r.estado.key==='cerrado').length;
  $('#k-criticos').textContent = all.filter(r=>['critico','vencido'].includes(r.estado.key)).length;
  $('#k-responsables').textContent = new Set(all.map(r=>r.responsable)).size;

  $('#tbody').innerHTML = rows.map(r=>{
    const d = diasHasta(r.fecha_limite);
    const plazo = r.fecha_entrega ? 'Cerrado' : (d < 0 ? `${Math.abs(d)} d vencido` : `${d} d`);
    return `<tr>
      <td><strong>${r.tema}</strong><small>${r.tipo} · ${r.plataforma}</small></td>
      <td>${r.responsable}</td>
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
  $('#drawer-body').innerHTML = `
    <div class="drawer-eyebrow">${r.id}</div><h2>${r.tema}</h2>
    <span class="badge ${e.key}">${e.label}</span>
    <dl>
      <dt>Tipo</dt><dd>${r.tipo}</dd><dt>Plataforma</dt><dd>${r.plataforma}</dd>
      <dt>Responsable</dt><dd>${r.responsable}</dd><dt>Periodicidad</dt><dd>${r.periodicidad}</dd>
      <dt>Fecha interna</dt><dd>${fmtFecha(r.fecha_interna)}</dd><dt>Fecha límite</dt><dd>${fmtFecha(r.fecha_limite)}</dd>
      <dt>Fecha de entrega</dt><dd>${fmtFecha(r.fecha_entrega)}</dd><dt>Observaciones</dt><dd>${r.observaciones || '—'}</dd>
    </dl>`;
  $('#drawer').classList.add('open');
};

async function init(){
  const res = await fetch('./data/reportes.json', {cache:'no-store'});
  REPORTES = await res.json();
  $('#buscar').addEventListener('input',render); $('#estado').addEventListener('change',render);
  $('#close').addEventListener('click',()=>$('#drawer').classList.remove('open'));
  render();
}
init().catch(err=>{ $('#tbody').innerHTML=`<tr><td colspan="6">Error cargando datos: ${err.message}</td></tr>`; });
