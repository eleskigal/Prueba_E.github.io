# Automatización local · Excel → GitHub Pages

Esta guía documenta el flujo automático de actualización del visor DCD en Windows.

## Qué hace

Cuando se guarda:

```text
input/Matriz_Seguimiento_Reportes.xlsx
```

el monitor local ejecuta automáticamente:

```text
Excel guardado
   ↓
espera a que el archivo quede estable y desbloqueado
   ↓
git pull --ff-only origin main
   ↓
scripts/procesar_matriz.py
   ↓
validaciones de integridad y privacidad
   ↓
checks JavaScript locales si Node.js está disponible
   ↓
¿cambió reportes.json?
   ├─ NO → no crea commit
   └─ SÍ
        ↓
      git add exclusivamente data/reportes.json + data/metadata.json
        ↓
      git commit
        ↓
      git push origin main
        ↓
      GitHub Actions · Frontend QA
        ↓
      GitHub Pages actualiza el visor
```

La matriz Excel nunca se agrega a Git porque está excluida por `.gitignore`.

## Requisitos previos

En el equipo deben existir:

- Git;
- Python 3;
- una copia local del repositorio;
- autenticación de Git configurada para poder ejecutar `git push origin main` sin introducir credenciales manualmente en cada actualización.

Node.js es recomendable, pero no obligatorio para el watcher. Si está instalado, el proceso ejecuta localmente los checks de sintaxis JavaScript y la prueba del sidebar antes de publicar. Si no está instalado, GitHub Actions realizará esos controles después del push.

## Instalación única

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
5. crea una tarea del Programador de tareas llamada `DCD Visor - Actualizacion automatica`;
6. configura esa tarea para iniciar al iniciar sesión;
7. inicia el monitor inmediatamente.

## Operación normal

Después de la instalación no es necesario ejecutar comandos para actualizar datos.

El flujo normal es:

1. abrir `input/Matriz_Seguimiento_Reportes.xlsx`;
2. modificar la información;
3. guardar Excel;
4. cerrar o continuar trabajando normalmente.

El monitor detecta el cambio. No publica mientras el archivo siga cambiando o permanezca bloqueado por Excel.

## Qué protege el publicador

El publicador cancela la operación si:

- no está en la rama `main`;
- no existe el remoto `origin`;
- existen cambios locales en archivos distintos de `data/reportes.json` y `data/metadata.json`;
- `git pull --ff-only` detecta divergencias;
- faltan archivos generados;
- el JSON está vacío;
- hay IDs duplicados o nulos;
- faltan campos públicos esperados;
- aparece `Usuario Reportado` en el JSON público;
- `metadata.json` no coincide con el número de registros;
- falla el pipeline;
- falla un check JavaScript local cuando Node.js está disponible;
- falla el commit o el push.

Si ocurre un error, **no se publica una versión parcial**. La versión anterior de GitHub Pages permanece intacta.

## Evitar commits innecesarios

Guardar Excel no implica necesariamente un nuevo commit.

El pipeline actualiza `generated_at` en `metadata.json`, pero el publicador comprueba primero si `data/reportes.json` cambió realmente. Si los datos publicables son idénticos, restaura `metadata.json` y termina sin commit ni push.

## Log

Todos los eventos se registran en:

```text
logs/automation.log
```

La carpeta `logs/` está excluida de Git.

Ejemplos:

```text
Cambio detectado en la matriz.
PUBLICACIÓN OK · 41 registros · GitHub Pages se actualizará desde main.
```

O, ante un problema:

```text
PUBLICACIÓN CANCELADA · la versión pública anterior permanece intacta.
```

## Ejecutar manualmente una publicación

Para procesar y publicar una vez:

```powershell
.\automation\publish_once.ps1
```

Es útil para diagnóstico o cuando el monitor no está activo.

## Ejecutar el monitor manualmente

```powershell
.\automation\start_watcher.ps1
```

Detenerlo con `Ctrl+C`.

## Administrar la tarea de Windows

Estado:

```powershell
Get-ScheduledTask -TaskName 'DCD Visor - Actualizacion automatica'
```

Iniciar:

```powershell
Start-ScheduledTask -TaskName 'DCD Visor - Actualizacion automatica'
```

Detener:

```powershell
Stop-ScheduledTask -TaskName 'DCD Visor - Actualizacion automatica'
```

Eliminar:

```powershell
Unregister-ScheduledTask -TaskName 'DCD Visor - Actualizacion automatica' -Confirm:$false
```

## Git y autenticación

Antes de activar la automatización conviene comprobar una vez:

```powershell
git pull origin main
git push origin main
```

Si Git solicita autenticación, completar el inicio de sesión y guardar las credenciales mediante Git Credential Manager. El watcher no debe depender de introducir usuario o contraseña de manera interactiva.

## Conflictos o cambios de código en curso

La automatización está diseñada para actualizar **datos**, no para gestionar simultáneamente cambios de desarrollo.

Si vas a modificar HTML, CSS, JavaScript o Python:

1. detener temporalmente la tarea programada;
2. trabajar en una rama distinta de `main`;
3. hacer PR y QA normalmente;
4. volver a `main` y ejecutar `git pull origin main`;
5. reiniciar la tarea.

Esto evita que el watcher intente publicar durante una sesión de desarrollo.

## Recuperación ante fallos

### El monitor no publica

Revisar:

```text
logs/automation.log
```

Luego ejecutar:

```powershell
.\automation\publish_once.ps1
```

El error quedará visible en consola.

### Hay cambios locales inesperados

Ejecutar:

```powershell
git status
```

Resolver, confirmar o descartar esos cambios antes de volver a publicar. El watcher no los incluirá automáticamente.

### `git pull --ff-only` falla

Significa que la copia local y GitHub han divergido. No usar `--force`. Detener la automatización y reconciliar Git manualmente.

### El push funciona, pero el sitio todavía muestra datos anteriores

Revisar GitHub Actions y esperar la actualización de GitHub Pages. También puede ser necesario hacer una recarga completa del navegador.

## Seguridad y privacidad

La automatización mantiene las reglas existentes:

- el Excel privado no se publica;
- `Usuario Reportado` no debe aparecer en `reportes.json`;
- los enlaces de evidencia pueden publicarse, pero sus permisos siguen gobernados por SharePoint/OneDrive;
- únicamente se preparan para commit `data/reportes.json` y `data/metadata.json`.

## Archivos de la automatización

```text
automation/
├── setup_windows.ps1    # instalación y tarea al iniciar sesión
├── start_watcher.ps1    # monitor manual
└── publish_once.ps1     # actualización manual única

scripts/
├── procesar_matriz.py
└── watch_and_publish.py
```

## Checklist de puesta en marcha

- [ ] repositorio clonado localmente;
- [ ] rama actual `main`;
- [ ] `git pull origin main` funciona;
- [ ] `git push origin main` funciona sin pedir credenciales interactivas;
- [ ] matriz ubicada en `input/Matriz_Seguimiento_Reportes.xlsx`;
- [ ] `automation/setup_windows.ps1` ejecutado;
- [ ] tarea programada en estado `Ready` o `Running`;
- [ ] guardar Excel produce una entrada en `logs/automation.log`;
- [ ] un cambio real produce commit y push;
- [ ] un guardado sin cambios no produce commit;
- [ ] GitHub Actions termina en verde;
- [ ] GitHub Pages refleja la nueva información.
