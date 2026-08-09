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
    "Fecha de Entrega Solicitante", "Estado del Reporte", "Enlaces"
]

SOURCE_TO_OUTPUT = {
    "Tipo de Reporte/Actividad": "instrumento",
    "Tema": "tema",
    "Plataforma": "plataforma",
    "Responsable de información": "responsable",
    "Periodicidad": "periodicidad",
    "Tipo de Reporte": "tipo_reporte",
    "Nombre del Reporte": "accion",
    "Descripción": "descripcion_accion",
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
        for source, target in SOURCE_TO_OUTPUT.items():
            value = row.get(source)
            record[target] = iso_date(value) if source in DATE_COLUMNS else clean(value)

        if record["accion"] is not None:
            record["accion"] = str(record["accion"])
        record["estado_fuente"] = record["estado_fuente"] or "Sin estado"
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
        "privacy": "Usuario Reportado no se publica. Las URLs de evidencia se conservan, pero el acceso continúa gobernado por SharePoint/OneDrive u otro sistema de origen.",
        "semantic_fields": {
            "instrumento": "Tipo de Reporte/Actividad",
            "accion": "Nombre del Reporte",
            "descripcion_accion": "Descripción"
        }
    }
    META.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK · {len(records)} registros exportados a {OUTPUT}")


if __name__ == "__main__":
    main()
