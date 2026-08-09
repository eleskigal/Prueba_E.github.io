from pathlib import Path
import json
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "input" / "Matriz_Seguimiento_Reportes.xlsx"
OUTPUT = ROOT / "data" / "reportes.json"

REQUIRED = ["Tipo de reporte", "Tema", "Plataforma"]

def main():
    if not INPUT.exists():
        raise FileNotFoundError(f"No se encontró la matriz: {INPUT}")
    df = pd.read_excel(INPUT)
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(f"Faltan columnas obligatorias: {missing}")
    # Este adaptador se ajustará a los nombres exactos de la matriz validada.
    df = df.where(pd.notna(df), None)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(df.to_dict("records"), ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(f"OK · {len(df)} registros exportados a {OUTPUT}")

if __name__ == "__main__":
    main()
