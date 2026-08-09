from pathlib import Path
from datetime import datetime
import hashlib
import json
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "input" / "Matriz_Seguimiento_Reportes.xlsx"
OUTPUT = ROOT / "data" / "reportes.json"
META = ROOT / "data" / "metadata.json"
SHEET = "Matriz de Seguimiento_detalle"

REQUIRED = [
    "Tipo de Reporte/Actividad", "Tema", "Plataforma",
    "Responsable de información", "Periodicidad",
    "Fecha Límite - Dep solicitante", "Fecha de Reporte Interno",
    "Fecha de Entrega Solicitante", "Estado del Reporte"
]

PUBLIC_COLUMNS = {
    "Tipo de Reporte/Actividad": "tipo_actividad",
    "Tema": "tema",
    "Plataforma": "plataforma",
    "Responsable de información": "responsable",
    "Periodicidad": "periodicidad",
    "Tipo de Reporte": "tipo_reporte",
    "Nombre del Reporte": "nombre_reporte",
    "Descripción": "descripcion",
    "Periodicidad del Reporte": "periodicidad_reporte",
    "Dependencia Solicitante": "dependencia_solicitante",
    "Fecha Límite - Dep solicitante": "fecha_limite",
    "Fecha de Envío solicitud": "fecha_envio_solicitud",
    "Fecha de Reporte Interno": "fecha_reporte_interno",
    "Fecha de Entrega Interna": "fecha_entrega_interna",
    "Fecha de Entrega Solicitante": "fecha_entrega_solicitante",
    "Estado del Reporte": "estado_fuente",
    "Enlaces": "evidencia_url",
    "Observaciones": "observaciones",
}

DATE_COLUMNS = {
    "Fecha Límite - Dep solicitante", "Fecha de Envío solicitud",
    "Fecha de Reporte Interno", "Fecha de Entrega Interna",
    "Fecha de Entrega Solicitante"
}


def clean(value):
    if pd.isna(value) or value == "-":
        return None
    if isinstance(value, str):
        value = value.replace("_x000D_", " ").strip()
        return value or None
    return value


def iso_date(value):
    value = clean(value)
    if value is None:
        return None
    parsed = pd.to_datetime(value, errors="coerce", dayfirst=True)
    if pd.isna(parsed):
        return str(value)
    return parsed.date().isoformat()


def stable_id(row, excel_row):
    parts = [
        clean(row.get("Tipo de Reporte/Actividad")), clean(row.get("Tema")),
        clean(row.get("Plataforma")), clean(row.get("Responsable de información")),
        clean(row.get("Nombre del Reporte")), excel_row,
    ]
    raw = "|".join(str(x or "") for x in parts)
    return "RPT-" + hashlib.sha1(raw.encode("utf-8")).hexdigest()[:10].upper()


def is_operational(row):
    fields = [
        "Tema", "Plataforma", "Responsable de información", "Periodicidad",
        "Fecha Límite - Dep solicitante", "Fecha de Reporte Interno",
        "Fecha de Entrega Solicitante", "Estado del Reporte", "Observaciones"
    ]
    return any(clean(row.get(c)) is not None for c in fields)


def validate(df):
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(f"Faltan columnas obligatorias: {missing}")
    if df.empty:
        raise ValueError("La hoja de detalle no contiene registros.")


def build_records(df):
    records = []
    for idx, row in df.iterrows():
        excel_row = int(idx) + 3
        if not is_operational(row):
            continue
        record = {"id": stable_id(row, excel_row), "fila_fuente": excel_row}
        for source, target in PUBLIC_COLUMNS.items():
            value = row.get(source)
            record[target] = iso_date(value) if source in DATE_COLUMNS else clean(value)

        record["nombre_reporte"] = None if record["nombre_reporte"] is None else str(record["nombre_reporte"])
        record["estado_fuente"] = record["estado_fuente"] or "Sin estado"

        # Campos semánticos explícitos para la interfaz.
        record["instrumento"] = record["tipo_actividad"]
        record["accion"] = record["nombre_reporte"]
        record["accion_descripcion"] = record["descripcion"]

        # Los enlaces de evidencia se conservan. El control de acceso continúa
        # en SharePoint/OneDrive u otro sistema de origen; el visor no evade permisos.
        record["evidencia_disponible"] = record["evidencia_url"] is not None
        records.append(record)
    return records


def main():
    if not INPUT.exists():
        raise FileNotFoundError(
            f"No se encontró {INPUT}. Copie la matriz maestra en la carpeta input/ con ese nombre."
        )

    df = pd.read_excel(INPUT, sheet_name=SHEET, header=1, engine="openpyxl")
    validate(df)
    records = build_records(df)
    if not records:
        raise ValueError("Ninguna fila operativa superó las reglas de selección.")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(records, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    metadata = {
        "generated_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "source_file": INPUT.name,
        "source_sheet": SHEET,
        "records": len(records),
        "privacy": "Usuario Reportado no se publica. Los enlaces de evidencia se conservan y mantienen el control de acceso del sistema de origen.",
    }
    META.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK · {len(records)} registros exportados a {OUTPUT}")


if __name__ == "__main__":
    main()
