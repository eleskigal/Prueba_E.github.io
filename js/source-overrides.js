// Sincronización transitoria con la matriz maestra original validada el 2026-08-09.
// El pipeline scripts/procesar_matriz.py ya genera estos campos directamente en futuras actualizaciones.
window.REPORT_SOURCE_OVERRIDES={
  "5":{"evidencia_url":"https://danegovco.sharepoint.com/sites/PlanesInstitucionales-MetasHisttricasporrea2018-2022/SitePages/Reporte-SINERGIA.aspx","evidencia_disponible":true},
  "6":{"evidencia_url":"https://danegovco.sharepoint.com/sites/PlanesInstitucionales-MetasHisttricasporrea2018-2022/SitePages/Reporte-SINERGIA.aspx","evidencia_disponible":true},
  "7":{"evidencia_url":"https://danegovco.sharepoint.com/sites/PlanesInstitucionales-MetasHisttricasporrea2018-2022/SitePages/Reporte-SINERGIA.aspx","evidencia_disponible":true},
  "8":{"evidencia_url":"https://danegovco.sharepoint.com/sites/PlanesInstitucionales-MetasHisttricasporrea2018-2022/SitePages/Reporte-SINERGIA.aspx","evidencia_disponible":true},
  "11":{"instrumento":"CONPES 3956","accion":"2.3","evidencia_url":"https://danegovco-my.sharepoint.com/:f:/g/personal/savasquezz_dane_gov_co/IgBX6RiVOgbZSJEArXJqzTz4ARCpzAF4WcKDuJFVSxzohgY?e=RT0pbd","evidencia_disponible":true},
  "12":{"instrumento":"CONPES 4080","accion":"6.22","evidencia_url":"https://danegovco-my.sharepoint.com/:f:/g/personal/savasquezz_dane_gov_co/IgBX6RiVOgbZSJEArXJqzTz4ARCpzAF4WcKDuJFVSxzohgY?e=RT0pbd","evidencia_disponible":true},
  "13":{"instrumento":"CONPES 4100","accion":"2.16","nombre_reporte":"2.16","descripcion":"Desarrollar procesos de intercambio de información continua para la producción estadística","accion_descripcion":"Desarrollar procesos de intercambio de información continua para la producción estadística","fecha_entrega_interna":"2026-05-12","observaciones":"Revisar con Astrid la información cargada - comentarios DNP","evidencia_url":"https://danegovco-my.sharepoint.com/:f:/g/personal/savasquezz_dane_gov_co/IgBX6RiVOgbZSJEArXJqzTz4ARCpzAF4WcKDuJFVSxzohgY?e=RT0pbd","evidencia_disponible":true},
  "14":{"instrumento":"CONPES 4100","accion":"2.17","nombre_reporte":"2.17","descripcion":"Implementar una estrategia que estandarice y fortalezca los conceptos y temáticas de los procesos de producción, recolección, procesamiento y calidad de la oferta estadística en temas migratorios","accion_descripcion":"Implementar una estrategia que estandarice y fortalezca los conceptos y temáticas de los procesos de producción, recolección, procesamiento y calidad de la oferta estadística en temas migratorios","fecha_entrega_interna":"2026-05-12","observaciones":"Revisar con Astrid la información cargada - comentarios DNP","evidencia_url":"https://danegovco-my.sharepoint.com/:f:/g/personal/savasquezz_dane_gov_co/IgBX6RiVOgbZSJEArXJqzTz4ARCpzAF4WcKDuJFVSxzohgY?e=RT0pbd","evidencia_disponible":true},
  "16":{"instrumento":"CONPES","accion":"2,16 - 2,17","nombre_reporte":"2,16 - 2,17","observaciones":"con el Grupo de Proyecciones"}
};

(()=>{
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init)=>{
    const response=await nativeFetch(input,init);
    const url=typeof input==='string'?input:(input&&input.url)||'';
    if(!url.includes('data/reportes.json')||!response.ok)return response;
    const rows=await response.clone().json();
    const patched=rows.map(r=>Object.assign({},r,window.REPORT_SOURCE_OVERRIDES[String(r.fila_fuente)]||{}));
    const headers=new Headers(response.headers);
    headers.set('content-type','application/json; charset=utf-8');
    return new Response(JSON.stringify(patched),{status:response.status,statusText:response.statusText,headers});
  };
})();
