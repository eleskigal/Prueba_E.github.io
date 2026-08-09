# DCD · Control de gestión de reportes

Visor web de seguimiento de compromisos, reportes, instrumentos, responsables y fechas de la **Dirección de Censos y Demografía (DCD)**.

**Sitio publicado:** https://eleskigal.github.io/Prueba_E.github.io/

> Este README es la guía operativa del proyecto. Antes de actualizar datos, modificar el frontend o publicar cambios, revisar las secciones **Actualizar la información**, **Controles de calidad** y **Reglas que no se deben romper**.

---

## 1. Qué hace este proyecto

El visor transforma una matriz maestra de Excel en una aplicación web estática desplegada con GitHub Pages.

El flujo general es:

```text
Matriz maestra Excel (local)
        ↓
scripts/procesar_matriz.py
        ↓
data/reportes.json + data/metadata.json
        ↓
HTML + CSS + JavaScript
        ↓
GitHub Pages
        ↓
Visor público
```

La aplicación contiene tres vistas principales:

1. **Resumen**: lectura estratégica de prioridades, riesgo, próximos hitos, instrumentos, responsables y estado del portafolio.
2. **Calendario**: agenda mensual de vencimientos y compromisos, con acceso al detalle de cada registro.
3. **Matriz**: consulta operativa completa, con búsqueda y filtros por trimestre, estado, responsable e instrumento.

También incluye:

- panel lateral de detalle;
- enlaces de evidencia;
- exportación XLSX, PDF y CSV;
- menú lateral fijable/ocultable;
- diseño responsive;
- soporte para `prefers-reduced-motion`;
- controles automáticos de QA mediante GitHub Actions.

---

## 2. Fuente de verdad

La **única fuente maestra de información es el archivo Excel local**.

Nombre esperado:

```text
input/Matriz_Seguimiento_Reportes.xlsx
```

Hoja utilizada:

```text
Matriz de Seguimiento_detalle
```

El pipeline lee la hoja usando la segunda fila como encabezado (`header=1`).

### Campos obligatorios

El procesamiento se detiene si faltan estas columnas:

```text
Tipo de Reporte/Actividad
Tema
Plataforma
Responsable de información
Periodicidad
Fecha Límite - Dep solicitante
Fecha de Reporte Interno
Fecha de Entrega Solicitante
Estado del Reporte
Enlaces
```

### Correspondencia principal entre Excel y visor

| Excel | Visor / JSON |
|---|---|
| Tipo de Reporte/Actividad | `instrumento` |
| Nombre del Reporte | `accion` |
| Descripción | `descripcion_accion` |
| Tema | `tema` |
| Plataforma | `plataforma` |
| Responsable de información | `responsable` |
| Fecha Límite - Dep solicitante | `fecha_limite` |
| Fecha de Entrega Solicitante | `fecha_entrega_solicitante` |
| Estado del Reporte | `estado_fuente` |
| Enlaces | `evidencia_url` |
| Observaciones | `observaciones` |

### Privacidad

La matriz original **no se publica en GitHub**. `.gitignore` excluye:

```text
input/*.xlsx
input/*.xls
~$*.xlsx
```

El campo **Usuario Reportado** tampoco se publica en el JSON del visor.

Las URLs de SharePoint/OneDrive sí pueden conservarse como evidencia, pero **la URL no modifica los permisos del documento**. El acceso continúa gobernado por Microsoft 365 o por el sistema de origen.

---

## 3. Estructura del repositorio

```text
Prueba_E.github.io/
│
├── index.html                  # entrada única del visor
│
├── css/
│   ├── app.css                 # sistema visual general
│   ├── summary.css             # composición narrativa del Resumen
│   ├── glass.css               # superficies glass / spatial UI
│   ├── layout-fix.css          # robustez de layout y overflow
│   └── motion.css              # animaciones y transiciones
│
├── js/
│   ├── app.js                  # lógica principal del visor
│   ├── quarter-filter.js       # segmentador trimestral
│   ├── sidebar.js              # menú fijable/ocultable
│   ├── export.js               # XLSX, PDF editorial y CSV
│   └── source-overrides.js     # capa TRANSITORIA, ver sección 10
│
├── data/
│   ├── reportes.json           # datos consumidos por el frontend
│   └── metadata.json           # trazabilidad de la generación
│
├── scripts/
│   └── procesar_matriz.py      # Excel → JSON
│
├── tests/
│   └── sidebar-layout-check.js # prueba de regresión del sidebar
│
├── input/                      # carpeta local; el Excel no se publica
├── requirements.txt
├── .gitignore
└── .github/workflows/qa.yml    # Frontend QA
```

---

# 4. Actualizar la información — procedimiento normal

Esta es la operación que debe realizarse cuando cambie la matriz.

## Paso 1. Actualizar la matriz maestra

Editar normalmente:

```text
input/Matriz_Seguimiento_Reportes.xlsx
```

No cambiar el nombre de la hoja ni eliminar columnas obligatorias.

Antes de cerrar Excel revisar especialmente:

- instrumento;
- acción;
- descripción;
- responsable;
- fechas;
- estado;
- enlace de evidencia;
- observaciones.

Evitar usar `-` como dato real. El pipeline interpreta `-` y celdas vacías como valores nulos.

---

## Paso 2. Actualizar el repositorio local

Desde una terminal en el repositorio:

```bash
git pull origin main
```

Si es la primera vez que se ejecuta el proyecto en el equipo, crear un entorno virtual:

### Windows

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Dependencias Python actuales:

```text
pandas >= 2.2, < 3
openpyxl >= 3.1, < 4
```

---

## Paso 3. Regenerar los datos

Ejecutar:

```bash
python scripts/procesar_matriz.py
```

Resultado esperado:

```text
OK · XX registros exportados a .../data/reportes.json
```

El script genera/actualiza:

```text
data/reportes.json
data/metadata.json
```

`metadata.json` registra, entre otros:

- fecha y hora de generación;
- nombre del archivo fuente;
- hoja fuente;
- cantidad de registros;
- política de privacidad;
- correspondencia semántica de instrumento, acción y descripción.

---

## Paso 4. Revisar el resultado antes de publicar

Comprobar como mínimo:

1. que el número de registros sea razonable frente a la matriz;
2. que los instrumentos estén correctamente identificados;
3. que las acciones CONPES/PND u otros identificadores correspondan con la matriz;
4. que las fechas no hayan cambiado de forma inesperada;
5. que los enlaces de evidencia estén presentes cuando corresponda;
6. que no se haya publicado `Usuario Reportado`;
7. que no aparezcan datos sensibles adicionales.

Validación rápida del JSON:

```bash
python -m json.tool data/reportes.json > NUL
```

En macOS/Linux:

```bash
python -m json.tool data/reportes.json > /dev/null
```

---

## Paso 5. Probar el visor localmente

No abrir `index.html` directamente con `file://`, porque el visor carga JSON mediante `fetch()`.

Levantar un servidor local:

```bash
python -m http.server 8000
```

Abrir:

```text
http://localhost:8000/
```

Revisar las tres vistas:

### Resumen

- prioridades;
- cumplimiento;
- instrumentos;
- responsables;
- próximos hitos;
- drill-down al hacer clic;
- exportaciones.

### Calendario

- mes correcto;
- eventos dentro del día;
- agenda lateral;
- apertura del detalle.

### Matriz

- búsqueda;
- filtro trimestral T1–T4;
- filtro por estado;
- responsable;
- instrumento;
- restablecer filtros;
- drawer de detalle;
- evidencia.

También probar:

- ocultar/fijar el menú;
- ancho completo con menú oculto;
- escritorio y móvil;
- textos largos sin overflow.

---

# 5. Controles de calidad

GitHub ejecuta automáticamente el workflow:

```text
Frontend QA
```

ubicado en:

```text
.github/workflows/qa.yml
```

Se ejecuta en:

- cada Pull Request hacia `main`;
- cada `push` a `main`.

Actualmente valida:

- sintaxis de `app.js`;
- sintaxis de `export.js`;
- sintaxis de `quarter-filter.js`;
- sintaxis de `sidebar.js`;
- prueba de regresión del sidebar;
- validez sintáctica de `data/reportes.json`;
- existencia de IDs críticos del DOM;
- carga de todos los CSS y JS principales;
- existencia de las tres exportaciones;
- ausencia de assets antiguos como `v2.html`, `v5.html` y CSS de prototipo.

### Pruebas locales útiles

```bash
node --check js/app.js
node --check js/export.js
node --check js/quarter-filter.js
node --check js/sidebar.js
node tests/sidebar-layout-check.js
python -m json.tool data/reportes.json > NUL
```

**No fusionar un PR si `Frontend QA` no termina en verde.**

---

# 6. Publicar una actualización

Para un cambio normal de datos:

```bash
git status
git add data/reportes.json data/metadata.json
git commit -m "Update report tracking data"
git push origin main
```

Para cambios de frontend o lógica es preferible trabajar mediante rama + Pull Request:

```bash
git checkout -b nombre-del-cambio
# realizar cambios
git add .
git commit -m "Describe change"
git push -u origin nombre-del-cambio
```

Crear PR hacia `main`, esperar `Frontend QA = success`, revisar el diff y fusionar.

GitHub Pages sirve el contenido de producción desde `main`.

URL pública:

```text
https://eleskigal.github.io/Prueba_E.github.io/
```

Después de un merge/push puede existir un pequeño retraso antes de que GitHub Pages refleje el cambio.

---

# 7. Exportaciones

El botón **Exportar** ofrece tres formatos.

## XLSX

Genera una matriz operativa con los datos publicables disponibles en el visor.

Incluye una hoja de metadatos.

No debe interpretarse como una copia binaria exacta del Excel privado, porque deliberadamente no publica campos excluidos por privacidad, como `Usuario Reportado`.

## PDF

Genera una salida editorial del Resumen, preparada para impresión/guardado como PDF.

No es una captura del dashboard; utiliza una composición independiente para lectura ejecutiva.

## CSV

Genera una base plana en UTF-8 para reutilización en:

- Excel;
- Python;
- R;
- Power BI;
- otros procesos analíticos.

---

# 8. Mantenimiento del frontend

## Antes de modificar diseño

El diseño actual sigue una combinación de:

- **spatial UI**;
- minimalismo;
- superficies glass contenidas;
- jerarquía editorial;
- IBM Plex Serif + IBM Plex Sans.

Evitar volver a una interfaz basada en tarjetas genéricas o incorporar frameworks sin necesidad.

## Responsabilidad de cada CSS

### `css/app.css`

Base del producto: layout, navegación, tablas, calendario, drawer y componentes generales.

### `css/summary.css`

Storytelling y composición específica de la hoja Resumen.

### `css/glass.css`

Profundidad, transparencia y superficies spatial/glass.

### `css/layout-fix.css`

Correcciones de overflow, wrapping y comportamiento responsive. No eliminar sin verificar tarjetas con textos largos.

### `css/motion.css`

Cadencia de animaciones. Prioriza `transform` y `opacity` para minimizar lag.

## JavaScript

### `js/app.js`

Es la lógica central. Modificar con cuidado.

### `js/quarter-filter.js`

Extiende la Matriz con segmentación trimestral.

### `js/sidebar.js`

Controla menú fijado, oculto, overlay y preferencia guardada en `localStorage`.

### `js/export.js`

Controla exportaciones XLSX, PDF y CSV.

---

# 9. Reglas que no se deben romper

1. **Excel es la fuente de verdad.** No corregir datos manualmente en HTML.
2. No publicar el archivo Excel en GitHub.
3. No publicar `Usuario Reportado` sin una decisión explícita de gobernanza de datos.
4. Mantener `index.html` como única entrada de producción.
5. No volver a crear `v2.html`, `v5.html` u otras páginas versionadas.
6. Conservar los IDs utilizados por `app.js` y por el QA.
7. Mantener las tres vistas: Resumen, Calendario y Matriz.
8. Mantener el segmentador trimestral.
9. Mantener evidencia, instrumento y acción en el modelo de datos.
10. Mantener la funcionalidad textual del calendario.
11. Probar textos largos antes de modificar grids o tamaños de tarjeta.
12. Mantener `prefers-reduced-motion`.
13. No fusionar cambios con QA fallido.
14. No agregar dependencias grandes si Vanilla JS resuelve la necesidad.

---

# 10. Importante: `source-overrides.js` es transitorio

Actualmente existe:

```text
js/source-overrides.js
```

Este archivo fue creado para sincronizar temporalmente determinados registros con la matriz original cuando el JSON histórico todavía había sido generado por una versión anterior del pipeline.

El pipeline actual (`scripts/procesar_matriz.py`) **ya genera directamente**:

- `instrumento`;
- `accion`;
- `descripcion_accion`;
- `evidencia_url`;
- fechas;
- observaciones.

Por tanto, `source-overrides.js` debe considerarse **deuda técnica temporal**.

### Riesgo

Los overrides se aplican usando `fila_fuente`. Si en el futuro se insertan, eliminan o reorganizan filas en Excel, un override antiguo podría terminar aplicándose al registro equivocado o sobrescribir un valor actualizado.

### Cómo retirarlo correctamente

No borrarlo sin validar primero.

Procedimiento recomendado:

1. colocar la matriz maestra más reciente en `input/Matriz_Seguimiento_Reportes.xlsx`;
2. ejecutar `python scripts/procesar_matriz.py`;
3. comparar los registros que hoy aparecen en `source-overrides.js` contra el nuevo `reportes.json`;
4. verificar instrumentos, acciones, descripciones, fechas, observaciones y evidencias;
5. si todo coincide con Excel, eliminar la referencia a `source-overrides.js` de `index.html`;
6. eliminar `js/source-overrides.js`;
7. probar las tres vistas;
8. ejecutar todo el QA;
9. publicar mediante PR.

Después de esa migración, toda actualización debe depender exclusivamente de:

```text
Excel → procesar_matriz.py → reportes.json
```

---

# 11. Solución de problemas

## `FileNotFoundError` al ejecutar el pipeline

Revisar que exista exactamente:

```text
input/Matriz_Seguimiento_Reportes.xlsx
```

## Error de columnas obligatorias

El Excel cambió de estructura o se renombró una columna. Comparar con la sección **Campos obligatorios**.

No modificar el script para aceptar nombres diferentes sin validar primero si la matriz cambió de estándar.

## El visor queda en “Cargando…”

Posibles causas:

- `reportes.json` inválido;
- se abrió con `file://`;
- error JavaScript;
- ruta incorrecta a `data/reportes.json`.

Revisar consola del navegador y ejecutar:

```bash
python -m json.tool data/reportes.json
```

## GitHub Pages no refleja el cambio

1. verificar que el commit esté en `main`;
2. verificar GitHub Actions;
3. hacer recarga fuerte del navegador;
4. esperar la actualización de Pages si el merge fue reciente.

## El menú oculto hace desaparecer el contenido

Existe una prueba de regresión específica:

```bash
node tests/sidebar-layout-check.js
```

No modificar las reglas `sidebar-collapsed` sin actualizar y ejecutar esta prueba.

## Una tarjeta desborda contenido

Revisar primero `css/layout-fix.css`. No resolver reduciendo excesivamente la tipografía; preferir:

- `min-width: 0`;
- wrapping;
- grids flexibles;
- límites de ancho adecuados.

## Las animaciones se sienten lentas

Revisar `css/motion.css` y `js/sidebar.js`.

Evitar animar:

- `width` de bloques grandes;
- `height` complejos;
- `box-shadow` pesado;
- `backdrop-filter` durante movimientos continuos.

Preferir:

- `transform`;
- `opacity`;
- transiciones cortas;
- `requestAnimationFrame` cuando se sincronizan cambios de clase.

---

# 12. Checklist de mantenimiento

## Cada actualización de datos

- [ ] Matriz actualizada y guardada.
- [ ] Nombre del archivo correcto.
- [ ] Hoja `Matriz de Seguimiento_detalle` intacta.
- [ ] `git pull origin main` ejecutado.
- [ ] Pipeline ejecutado sin errores.
- [ ] Cantidad de registros revisada.
- [ ] Instrumentos y acciones revisados.
- [ ] Fechas revisadas.
- [ ] Evidencias revisadas.
- [ ] Privacidad revisada.
- [ ] Resumen probado.
- [ ] Calendario probado.
- [ ] Matriz y trimestre probados.
- [ ] Exportaciones probadas.
- [ ] Sidebar probado.
- [ ] QA en verde.
- [ ] Sitio publicado revisado.

## Cada cambio de frontend

- [ ] No se modificaron datos accidentalmente.
- [ ] Desktop revisado.
- [ ] Mobile revisado.
- [ ] Textos largos revisados.
- [ ] Drawer revisado.
- [ ] Calendario revisado.
- [ ] Matriz revisada.
- [ ] Exportaciones revisadas.
- [ ] `prefers-reduced-motion` conservado.
- [ ] QA en verde antes del merge.

---

# 13. Estado recomendado del proyecto

Arquitectura objetivo final:

```text
Matriz Excel local / OneDrive
          ↓
Pipeline Python validado
          ↓
reportes.json + metadata.json
          ↓
Frontend estático
          ↓
GitHub Actions QA
          ↓
main
          ↓
GitHub Pages
```

Siguiente mejora técnica recomendada, si se retoma el proyecto:

1. eliminar `source-overrides.js` después de regenerar y validar la matriz más reciente;
2. automatizar el flujo local `guardar Excel → ejecutar QA → generar JSON → commit/push`;
3. conservar el frontend actual sin introducir infraestructura innecesaria.

---

## Referencia rápida

**Actualizar datos**

```bash
git pull origin main
python scripts/procesar_matriz.py
python -m http.server 8000
```

**Validar**

```bash
node --check js/app.js
node --check js/export.js
node --check js/quarter-filter.js
node --check js/sidebar.js
node tests/sidebar-layout-check.js
python -m json.tool data/reportes.json
```

**Publicar datos validados**

```bash
git add data/reportes.json data/metadata.json
git commit -m "Update report tracking data"
git push origin main
```

**Sitio**

```text
https://eleskigal.github.io/Prueba_E.github.io/
```
