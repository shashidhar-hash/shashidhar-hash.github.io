import os
from datetime import datetime
from typing import List

import pandas as pd
from flask import Flask, jsonify, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.environ.get("CNC_DATA_PATH", os.path.join(BASE_DIR, "cnc_log_20251126.csv"))

CONDITIONS = [
  {
    "label": "Temp_C above 40 °C",
    "column": "Temp_C",
    "check": lambda value: value > 40,
  },
  {
    "label": "Vib_Mag_g above 1.2 g",
    "column": "Vib_Mag_g",
    "check": lambda value: value > 1.2,
  },
  {
    "label": "Sound_dBr louder than −15 dBr",
    "column": "Sound_dBr",
    "check": lambda value: value > -15,
  },
]

app = Flask(__name__, static_folder=".", static_url_path="")


def load_data_frame() -> pd.DataFrame:
  if not os.path.exists(DATA_PATH):
    raise FileNotFoundError(
      f"Data file not found at '{DATA_PATH}'. Update CNC_DATA_PATH or place your sheet in the project root."
    )

  _, ext = os.path.splitext(DATA_PATH.lower())
  if ext in {".xlsx", ".xls"}:
    df = pd.read_excel(DATA_PATH)
  elif ext == ".csv":
    df = pd.read_csv(DATA_PATH)
  else:
    raise ValueError("Unsupported file type. Use .xlsx, .xls, or .csv.")

  if df.empty:
    raise ValueError("Data file is empty.")

  return df


def is_number(value) -> bool:
  if isinstance(value, (int, float)):
    return not pd.isna(value)
  return False


def evaluate_conditions(df: pd.DataFrame) -> List[str]:
  alerts = []
  for idx, row in df.iterrows():
    for condition in CONDITIONS:
      column = condition["column"]
      value = row.get(column)
      if is_number(value) and condition["check"](value):
        timestamp = row.get("Time") or row.get("time") or f"Row {idx + 1}"
        alerts.append(
          f"{condition['label']} at {timestamp}: observed {value}"
        )
  return alerts


@app.get("/")
def root():
  return send_from_directory(app.static_folder, "index.html")


def source_timestamp() -> str:
  return datetime.fromtimestamp(os.path.getmtime(DATA_PATH)).isoformat()


@app.get("/api/readings")
def readings():
  df = load_data_frame()
  return jsonify(
    {
      "rows": df.to_dict(orient="records"),
      "updatedAt": datetime.now().isoformat(),
      "sourceUpdatedAt": source_timestamp(),
      "rowCount": len(df.index),
    }
  )


@app.get("/api/alerts")
def alerts():
  df = load_data_frame()
  alerts = evaluate_conditions(df)
  return jsonify(
    {
      "alerts": alerts,
      "count": len(alerts),
      "updatedAt": datetime.now().isoformat(),
      "sourceUpdatedAt": source_timestamp(),
    }
  )


if __name__ == "__main__":
  app.run(debug=True)

