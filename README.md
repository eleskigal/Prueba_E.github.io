# DCD · Control de gestión de reportes

Visor web de seguimiento de compromisos, reportes, instrumentos, responsables y fechas de la **Dirección de Censos y Demografía (DCD)**.

**Sitio publicado:** https://eleskigal.github.io/Prueba_E.github.io/

> Este README es la guía operativa principal del proyecto. El procedimiento recomendado de actualización ya es **automático**: actualizar y guardar la matriz Excel local es suficiente para regenerar los datos y publicar el visor, siempre que la automatización esté instalada y activa.

---

## 1. Qué hace este proyecto

El proyecto transforma una matriz maestra de Excel en una aplicación web estática desplegada con GitHub Pages.

El flujo de producción actual es:

```text
Matriz maestra Excel (local)
        ↓
watcher local de Windows
        ↓
scripts/procesar_matriz.py
        ↓
validaciones de integridad y privacidad
        ↓
data/reportes.json + data/metadata.json
        ↓
git commit + git push
        ↓
GitHub Actions · Frontend QA
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
- automatización local Excel → GitHub;
- controles automáticos de QA mediante GitHub Actions.

---

## 2. Operación diaria — procedimiento recomendado

Una vez instalada la automatización, actualizar el visor requiere únicamente:

1. abrir `input/Matriz_Seguimiento_Reportes.xlsx`;
2. actualizar la información;
3. guardar Excel.

El monitor local detecta el guardado y ejecuta automáticamente:

```text
Excel guardado
   ↓
espera a que el archivo quede estable y desbloqueado
   ↓
git pull --ff-only origin main
   ↓
procesamiento Excel → JSON
   ↓
validaciones de integridad y privacidad
   ↓
checks JavaScript locales si Node.js está instalado
   ↓
¿cambió realmente la información publicable?
   ├─ NO → termina sin commit
   └─ SÍ
        ↓
      commit exclusivamente de data/reportes.json y data/metadata.json
        ↓
      git push origin main
        ↓
      GitHub Actions · Frontend QA
        ↓
      GitHub Pages actualiza el visor
```

La matriz Excel nunca se publica.

---

## 3. Instalar la automatización por primera vez

### Requisitos

En Windows deben estar instalados:

- Git;
- Python 3;
- una copia local del repositorio;
- autenticación de Git configurada para poder hacer `git push origin main` sin introducir credenciales manualmente.

Node.js es recomendable, aunque no obligatorio. Si está disponible, el watcher ejecuta localmente las pruebas JavaScript antes del push; si no, GitHub Actions las ejecutará después.

### Instalación única

Abrir PowerShell en la raíz del repositorio y ejecutar:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\automation\setup_windows.ps1
```

El instalador:

1. comprueba Git y Python;
2. exige que el repositorio esté en `main`;
3. crea `.venv` si no existe;
4. instala `requirements.txt`;
5. registra una tarea del Programador de tareas llamada `DCD Visor - Actualizacion automatica`;
6. configura la tarea para iniciar al iniciar sesión;
7. inicia inmediatamente el monitor.

Antes de instalar conviene verificar una vez:

```powershell
git pull origin main
git push origin main
```

Si Git solicita autenticación, completar el inicio de sesión y permitir que Git Credential Manager conserve las credenciales.

La documentación detallada de automatización está en:

```text
docs/AUTOMATION.md
```

---

## 4. Fuente de verdad

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

El procesamiento se detiene si faltan:

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

### Correspondencia principal Excel → visor

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

El campo **Usuario Reportado** tampoco se publica en `data/reportes.json`.

Las URLs de SharePoint/OneDrive pueden conservarse como evidencia, pero la URL no altera los permisos del documento. El acceso continúa gobernado por Microsoft 365 o por el sistema de origen.

---

## 5. Estructura del repositorio

```text
Prueba_E.github.io/
│
├── index.html                       # entrada única del visor
│
├── css/
│   ├── app.css                      # sistema visual general
│   ├── summary.css                  # composición narrativa del Resumen
│   ├── glass.css                    # superficies glass / spatial UI
│   ├── layout-fix.css               # robustez de layout y overflow
│   └── motion.css                   # animaciones y transiciones
│
├── js/
│   ├── app.js                       # lógica principal
│   ├── quarter-filter.js            # segmentador trimestral
│   ├── sidebar.js                   # menú fijable/ocultable
│   ├── export.js                    # XLSX, PDF editorial y CSV
│   └── source-overrides.js          # capa TRANSITORIA, ver sección 13
│
├── data/
│   ├── reportes.json                # datos consumidos por el frontend
│   └── metadata.json                # trazabilidad de generación
│
├── scripts/
│   ├── procesar_matriz.py           # Excel → JSON
│   └── watch_and_publish.py         # automatización Excel → GitHub
│
├── automation/
│   ├── setup_windows.ps1            # instalación inicial
│   ├── start_watcher.ps1            # monitor manual
│   └── publish_once.ps1             # publicación manual única
│
├── docs/
│   └── AUTOMATION.md                # guía detallada de automatización
│
├── tests/
│   └── sidebar-layout-check.js      # prueba de regresión del sidebar
│
├── input/                           # carpeta local; Excel no se publica
├── logs/                            # logs locales; no se publica
├── requirements.txt
├── .gitignore
└── .github/workflows/qa.yml         # Frontend QA
```

---

## 6. Qué protege la automatización

El publicador automático está diseñado para **fallar de forma segura**.

Cancela la publicación si:

- la rama actual no es `main`;
- no existe el remoto `origin`;
- hay cambios locales en archivos distintos de los artefactos de datos autorizados;
- `git pull --ff-only` detecta divergencias;
- falla el pipeline Excel → JSON;
- el JSON está vacío;
- existen IDs nulos o duplicados;
- faltan campos públicos esperados;
- aparece `Usuario Reportado` en el JSON público;
- `metadata.json` no coincide con el número de registros;
- falla un check JavaScript local cuando Node.js está disponible;
- falla el commit o el push.

Si ocurre cualquiera de estos eventos, **la versión pública anterior permanece intacta**.

La automatización nunca usa `force push` y únicamente prepara para commit:

```text
data/reportes.json
data/metadata.json
```

---

## 7. Evitar commits innecesarios

Guardar Excel no implica necesariamente un commit.

El pipeline actualiza la fecha `generated_at` en `metadata.json`, pero el watcher verifica primero si `data/reportes.json` cambió realmente.

Si la información publicable es idéntica:

```text
reportes.json sin cambios
        ↓
metadata.json se restaura
        ↓
no commit
        ↓
no push
```

Esto evita contaminar el historial de Git con guardados sin cambios sustantivos.

---

## 8. Logs y diagnóstico

Todos los eventos del monitor se registran localmente en:

```text
logs/automation.log
```

`logs/` está excluido de Git.

Ejemplo de operación exitosa:

```text
Cambio detectado en la matriz.
PUBLICACIÓN OK · 41 registros · GitHub Pages se actualizará desde main.
```

Ejemplo de cancelación:

```text
PUBLICACIÓN CANCELADA · la versión pública anterior permanece intacta.
```

Si algo no funciona, el primer paso siempre debe ser revisar `logs/automation.log`.

---

## 9. Ejecutar manualmente

### Publicar una vez

```powershell
.\automation\publish_once.ps1
```

Esto ejecuta una actualización completa y termina.

### Ejecutar el monitor manualmente

```powershell
.\automation\start_watcher.ps1
```

Detener con `Ctrl+C`.

---

## 10. Administrar la tarea de Windows

### Consultar estado

```powershell
Get-ScheduledTask -TaskName 'DCD Visor - Actualizacion automatica'
```

### Iniciar

```powershell
Start-ScheduledTask -TaskName 'DCD Visor - Actualizacion automatica'
```

### Detener

```powershell
Stop-ScheduledTask -TaskName 'DCD Visor - Actualizacion automatica'
```

### Eliminar

```powershell
Unregister-ScheduledTask -TaskName 'DCD Visor - Actualizacion automatica' -Confirm:$false
```

---

## 11. Procedimiento manual de contingencia

El flujo automático es el procedimiento normal. Este bloque debe usarse solo para diagnóstico, recuperación o cuando la automatización esté deshabilitada.

### 11.1 Sincronizar

```bash
git pull origin main
```

### 11.2 Crear entorno virtual, si no existe

#### Windows

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

#### macOS / Linux

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

### 11.3 Regenerar datos

```bash
python scripts/procesar_matriz.py
```

Resultado esperado:

```text
OK · XX registros exportados a .../data/reportes.json
```

### 11.4 Validar JSON

#### Windows

```powershell
python -m json.tool data/reportes.json > NUL
```

#### macOS / Linux

```bash
python -m json.tool data/reportes.json > /dev/null
```

### 11.5 Probar localmente

No abrir `index.html` directamente con `file://`, porque el visor usa `fetch()`.

```bash
python -m http.server 8000
```

Abrir:

```text
http://localhost:8000/
```

Revisar Resumen, Calendario, Matriz, filtro trimestral, drawer, evidencia, exportaciones, menú fijado/oculto, textos largos y comportamiento responsive.

### 11.6 Publicar manualmente

```bash
git status
git add data/reportes.json data/metadata.json
git commit -m "Update report tracking data"
git push origin main
```

---

## 12. Controles de calidad

GitHub ejecuta automáticamente:

```text
Frontend QA
```

ubicado en `.github/workflows/qa.yml`.

Se ejecuta en cada Pull Request hacia `main` y en cada `push` a `main`.

Actualmente valida:

- sintaxis de los JavaScript principales;
- sintaxis de los scripts Python de procesamiento y automatización;
- prueba de regresión del sidebar;
- validez de `data/reportes.json`;
- existencia de IDs críticos del DOM;
- carga de CSS y JS de producción;
- existencia de las tres exportaciones;
- presencia de los archivos críticos de automatización;
- ausencia de assets históricos como `v2.html`, `v5.html` y CSS de prototipo.

Pruebas locales útiles:

```bash
node --check js/app.js
node --check js/export.js
node --check js/quarter-filter.js
node --check js/sidebar.js
node tests/sidebar-layout-check.js
python -m py_compile scripts/procesar_matriz.py scripts/watch_and_publish.py
python -m json.tool data/reportes.json > NUL
```

**No fusionar cambios de código si `Frontend QA` no termina en verde.**

---

## 13. Importante: `source-overrides.js` es transitorio

Actualmente existe `js/source-overrides.js`.

Se creó para corregir temporalmente determinados registros mientras el JSON histórico provenía de una versión anterior del pipeline.

El pipeline actual `scripts/procesar_matriz.py` ya genera directamente:

- `instrumento`;
- `accion`;
- `descripcion_accion`;
- `evidencia_url`;
- fechas;
- observaciones.

Por tanto, `source-overrides.js` debe considerarse **deuda técnica temporal**.

### Riesgo

Los overrides se aplican mediante `fila_fuente`. Si se insertan, eliminan o reorganizan filas en Excel, un override histórico podría terminar aplicándose a otro registro o sobrescribir un valor nuevo.

### Cómo retirarlo correctamente

1. detener temporalmente la automatización;
2. colocar la matriz maestra más reciente en `input/Matriz_Seguimiento_Reportes.xlsx`;
3. ejecutar `python scripts/procesar_matriz.py`;
4. comparar los registros incluidos hoy en `source-overrides.js` contra `reportes.json`;
5. verificar instrumento, acción, descripción, fechas, observaciones y evidencia;
6. si todo coincide con Excel, eliminar la referencia a `source-overrides.js` de `index.html`;
7. eliminar `js/source-overrides.js`;
8. ejecutar QA;
9. publicar mediante PR;
10. volver a activar la automatización.

No eliminar esta capa sin la comparación previa.

---

## 14. Exportaciones

El botón **Exportar** ofrece tres formatos.

### XLSX

Genera una matriz operativa con la información publicable disponible en el visor e incluye metadatos.

No es una copia binaria exacta del Excel privado porque no publica campos deliberadamente excluidos, como `Usuario Reportado`.

### PDF

Genera una salida editorial del Resumen, preparada para lectura ejecutiva e impresión/guardado como PDF.

### CSV

Genera una base plana UTF-8 para reutilización en Excel, Python, R, Power BI y otros procesos analíticos.

---

## 15. Mantenimiento del frontend

El diseño actual sigue una combinación de:

- spatial UI;
- minimalismo;
- glass contenido;
- jerarquía editorial;
- IBM Plex Serif + IBM Plex Sans.

### CSS

- `css/app.css`: layout, navegación, tablas, calendario, drawer y componentes generales.
- `css/summary.css`: storytelling y composición del Resumen.
- `css/glass.css`: profundidad y superficies spatial/glass.
- `css/layout-fix.css`: overflow, wrapping y responsive.
- `css/motion.css`: cadencia de movimiento, `transform`, `opacity` y `prefers-reduced-motion`.

### JavaScript

- `js/app.js`: lógica central.
- `js/quarter-filter.js`: segmentación trimestral.
- `js/sidebar.js`: menú fijado/oculto y persistencia en `localStorage`.
- `js/export.js`: exportaciones XLSX, PDF y CSV.

---

## 16. Cambios de código mientras la automatización está activa

La automatización está diseñada para publicar **datos**, no para convivir con una sesión de desarrollo.

Si se van a modificar HTML, CSS, JavaScript o Python:

1. detener temporalmente la tarea programada;
2. trabajar en una rama distinta de `main`;
3. hacer Pull Request;
4. esperar `Frontend QA = success`;
5. fusionar;
6. volver localmente a `main`;
7. ejecutar `git pull origin main`;
8. reiniciar la tarea automática.

---

## 17. Recuperación ante fallos

### El monitor no publica

Revisar `logs/automation.log` y luego ejecutar:

```powershell
.\automation\publish_once.ps1
```

### Hay cambios locales inesperados

```bash
git status
```

Resolver, confirmar o descartar esos cambios antes de publicar.

### `git pull --ff-only` falla

La copia local y GitHub han divergido. No usar `--force`. Detener la automatización y reconciliar Git manualmente.

### El push funciona pero el sitio no cambia

Revisar GitHub Actions, la publicación de GitHub Pages y la caché del navegador.

---

## 18. Reglas que no se deben romper

1. **Excel es la fuente de verdad.**
2. No corregir datos manualmente en HTML.
3. No publicar la matriz Excel.
4. No publicar `Usuario Reportado` sin decisión explícita de gobernanza.
5. Mantener `index.html` como única entrada de producción.
6. No recrear `v2.html`, `v5.html` ni páginas versionadas.
7. Mantener Resumen, Calendario y Matriz.
8. Mantener el segmentador trimestral.
9. Mantener instrumento, acción y evidencia en el modelo.
10. Mantener eventos textuales en el calendario.
11. Probar textos largos antes de modificar grids.
12. Mantener `prefers-reduced-motion`.
13. No fusionar cambios de código con QA fallido.
14. No usar `force push` en la automatización.
15. No permitir que el watcher publique archivos distintos de los dos JSON autorizados.
16. Para desarrollo, detener temporalmente la automatización y usar una rama distinta de `main`.
17. No añadir dependencias grandes cuando Vanilla JS resuelve la necesidad.

---

## 19. Checklist de puesta en marcha

- [ ] repositorio clonado localmente;
- [ ] rama actual `main`;
- [ ] `git pull origin main` funciona;
- [ ] `git push origin main` funciona sin pedir credenciales interactivas;
- [ ] matriz ubicada en `input/Matriz_Seguimiento_Reportes.xlsx`;
- [ ] `automation/setup_windows.ps1` ejecutado;
- [ ] tarea `DCD Visor - Actualizacion automatica` creada;
- [ ] tarea en estado `Ready` o `Running`;
- [ ] guardar Excel genera entrada en `logs/automation.log`;
- [ ] un cambio real produce commit y push;
- [ ] un guardado sin cambios no produce commit;
- [ ] GitHub Actions termina en verde;
- [ ] GitHub Pages refleja la nueva información.

---

## 20. Referencias internas

Guía detallada de automatización:

```text
docs/AUTOMATION.md
```

Pipeline de datos:

```text
scripts/procesar_matriz.py
```

Watcher y publicador:

```text
scripts/watch_and_publish.py
```

Sitio de producción:

```text
https://eleskigal.github.io/Prueba_E.github.io/
```
