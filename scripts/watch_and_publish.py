from __future__ import annotations

import argparse
import json
import logging
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MATRIX = ROOT / "input" / "Matriz_Seguimiento_Reportes.xlsx"
REPORTS = ROOT / "data" / "reportes.json"
METADATA = ROOT / "data" / "metadata.json"
LOG_DIR = ROOT / "logs"
LOG_FILE = LOG_DIR / "automation.log"
PIPELINE = ROOT / "scripts" / "procesar_matriz.py"

POLL_SECONDS = 2.0
STABLE_CHECKS = 3
STABLE_INTERVAL = 1.0
GENERATED_FILES = {"data/reportes.json", "data/metadata.json"}
REQUIRED_PUBLIC_FIELDS = {
    "id", "instrumento", "tema", "plataforma", "responsable", "periodicidad",
    "accion", "descripcion_accion", "fecha_limite", "estado_fuente",
    "evidencia_url", "observaciones",
}


def configure_logging() -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    fmt = logging.Formatter("%(asctime)s · %(levelname)s · %(message)s")
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers.clear()

    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    root.addHandler(console)

    file_handler = logging.FileHandler(LOG_FILE, encoding="utf-8")
    file_handler.setFormatter(fmt)
    root.addHandler(file_handler)


def run(cmd: list[str], *, check: bool = True, capture: bool = True) -> subprocess.CompletedProcess[str]:
    logging.info("Ejecutando: %s", " ".join(cmd))
    return subprocess.run(
        cmd,
        cwd=ROOT,
        text=True,
        capture_output=capture,
        check=check,
        creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
    )


def git_lines(*args: str) -> list[str]:
    result = run(["git", *args])
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def status_path(line: str) -> str:
    path = line[3:].strip()
    if " -> " in path:
        path = path.split(" -> ", 1)[1]
    return path.replace("\\", "/")


def ensure_git_ready() -> None:
    if shutil.which("git") is None:
        raise RuntimeError("Git no está instalado o no está disponible en PATH.")

    branch = run(["git", "branch", "--show-current"]).stdout.strip()
    if branch != "main":
        raise RuntimeError(f"La automatización solo publica desde main. Rama actual: {branch or 'desconocida'}")

    remotes = git_lines("remote")
    if "origin" not in remotes:
        raise RuntimeError("El repositorio local no tiene un remoto llamado origin.")

    generated_dirty = []
    unexpected = []
    for line in git_lines("status", "--porcelain"):
        path = status_path(line)
        if path in GENERATED_FILES:
            generated_dirty.append(path)
        else:
            unexpected.append(line)

    if unexpected:
        raise RuntimeError(
            "Hay cambios locales no relacionados con los datos. La publicación se cancela para no incluirlos:\n"
            + "\n".join(unexpected)
        )

    if generated_dirty:
        logging.warning(
            "Se encontraron artefactos generados sin publicar de una ejecución anterior. "
            "Se restauran antes de sincronizar: %s",
            ", ".join(sorted(set(generated_dirty))),
        )
        run(["git", "restore", "--", *sorted(set(generated_dirty))])


def wait_until_stable(path: Path) -> None:
    logging.info("Esperando a que Excel termine de guardar %s", path.name)
    previous = None
    stable = 0
    while stable < STABLE_CHECKS:
        if not path.exists():
            stable = 0
            time.sleep(STABLE_INTERVAL)
            continue
        stat = path.stat()
        signature = (stat.st_size, stat.st_mtime_ns)
        if signature == previous:
            stable += 1
        else:
            stable = 0
            previous = signature
        time.sleep(STABLE_INTERVAL)

    for _ in range(10):
        try:
            with path.open("rb") as fh:
                fh.read(1)
            return
        except PermissionError:
            time.sleep(1)
    raise RuntimeError("La matriz continúa bloqueada por otra aplicación.")


def validate_generated_data() -> int:
    if not REPORTS.exists() or not METADATA.exists():
        raise RuntimeError("El pipeline no generó reportes.json y metadata.json.")

    rows = json.loads(REPORTS.read_text(encoding="utf-8"))
    meta = json.loads(METADATA.read_text(encoding="utf-8"))
    if not isinstance(rows, list) or not rows:
        raise RuntimeError("reportes.json no contiene una lista no vacía de registros.")

    ids = [row.get("id") for row in rows]
    if any(not value for value in ids) or len(ids) != len(set(ids)):
        raise RuntimeError("Los IDs del dataset son nulos o no son únicos.")

    all_keys = set().union(*(row.keys() for row in rows))
    missing_fields = sorted(REQUIRED_PUBLIC_FIELDS - all_keys)
    if missing_fields:
        raise RuntimeError(f"Faltan campos públicos esperados: {missing_fields}")

    forbidden = {"usuario_reportado", "Usuario Reportado"}
    if any(forbidden & set(row.keys()) for row in rows):
        raise RuntimeError("Se detectó Usuario Reportado en el JSON público.")

    if meta.get("records") != len(rows):
        raise RuntimeError("metadata.json no coincide con el número de registros de reportes.json.")

    return len(rows)


def optional_frontend_syntax_checks() -> None:
    node = shutil.which("node")
    if not node:
        logging.warning("Node.js no está disponible. Se omiten checks JS locales; GitHub Actions los ejecutará tras el push.")
        return
    for path in [
        "js/app.js", "js/export.js", "js/quarter-filter.js", "js/sidebar.js",
        "tests/sidebar-layout-check.js",
    ]:
        run([node, "--check", path])
    run([node, "tests/sidebar-layout-check.js"])


def restore_metadata_if_no_data_change() -> None:
    result = subprocess.run(
        ["git", "diff", "--quiet", "--", "data/reportes.json"],
        cwd=ROOT,
        check=False,
    )
    if result.returncode == 0:
        subprocess.run(["git", "restore", "--", "data/metadata.json"], cwd=ROOT, check=False)


def publish_once() -> bool:
    if not MATRIX.exists():
        raise FileNotFoundError(
            f"No se encontró {MATRIX}. Copie allí la matriz maestra antes de iniciar la automatización."
        )

    ensure_git_ready()
    wait_until_stable(MATRIX)

    run(["git", "pull", "--ff-only", "origin", "main"])
    run([sys.executable, str(PIPELINE)])
    records = validate_generated_data()
    optional_frontend_syntax_checks()

    restore_metadata_if_no_data_change()
    changed = git_lines("status", "--porcelain", "--", "data/reportes.json", "data/metadata.json")
    if not changed:
        logging.info("La matriz se guardó, pero no cambió ningún dato publicable. No se crea commit.")
        return False

    run(["git", "add", "data/reportes.json", "data/metadata.json"])

    staged = git_lines("diff", "--cached", "--name-only")
    unexpected = [p for p in staged if p not in GENERATED_FILES]
    if unexpected:
        run(["git", "reset", "HEAD", "--", *unexpected], check=False)
        raise RuntimeError(f"Se intentaron preparar archivos no autorizados: {unexpected}")

    stamp = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M")
    message = f"Update report data · {records} records · {stamp}"
    run(["git", "commit", "-m", message])
    run(["git", "push", "origin", "main"])
    logging.info("PUBLICACIÓN OK · %s registros · GitHub Pages se actualizará desde main.", records)
    return True


def file_signature(path: Path) -> tuple[int, int] | None:
    try:
        stat = path.stat()
        return stat.st_size, stat.st_mtime_ns
    except FileNotFoundError:
        return None


def watch() -> None:
    logging.info("Monitor activo · %s", MATRIX)
    logging.info("Guardar la matriz es suficiente; Ctrl+C detiene el monitor.")
    last = file_signature(MATRIX)
    while True:
        try:
            time.sleep(POLL_SECONDS)
            current = file_signature(MATRIX)
            if current is None:
                continue
            if last is None:
                last = current
                continue
            if current != last:
                detected = current
                logging.info("Cambio detectado en la matriz.")
                try:
                    publish_once()
                except Exception:
                    logging.exception("PUBLICACIÓN CANCELADA · la versión pública anterior permanece intacta.")
                finally:
                    after = file_signature(MATRIX)
                    # Si Excel volvió a guardarse durante el procesamiento, se conserva la firma previa
                    # para que el siguiente ciclo detecte y procese ese cambio adicional.
                    last = detected if after != detected else after
        except KeyboardInterrupt:
            logging.info("Monitor detenido por el usuario.")
            return


def main() -> None:
    parser = argparse.ArgumentParser(description="Automatiza Excel → JSON → QA → commit → push.")
    parser.add_argument("--once", action="store_true", help="Ejecuta una actualización y termina.")
    args = parser.parse_args()
    configure_logging()
    try:
        if args.once:
            publish_once()
        else:
            watch()
    except Exception:
        logging.exception("ERROR CRÍTICO")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
