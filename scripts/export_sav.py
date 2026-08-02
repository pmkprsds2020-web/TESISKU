#!/usr/bin/env python3
"""
TeenMind Research — SPSS .sav Export Script
Reads JSON data from stdin, writes a real .sav file to stdout.

Usage:
    echo '{"respondents":[...]}' | python3 scripts/export_sav.py > output.sav
"""
import sys
import json
import io
import warnings
warnings.filterwarnings("ignore")

def main():
    try:
        import pandas as pd
        import pyreadstat
    except ImportError as e:
        sys.stderr.write(f"Missing package: {e}\n")
        sys.exit(1)

    # Read JSON from stdin
    raw = sys.stdin.read()
    if not raw.strip():
        sys.stderr.write("No input data\n")
        sys.exit(1)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        sys.stderr.write(f"JSON parse error: {e}\n")
        sys.exit(1)

    respondents = data.get("respondents", [])
    if not respondents:
        sys.stderr.write("No respondents\n")
        sys.exit(1)

    # Build DataFrame
    rows = []
    for r in respondents:
        row = {}
        demo = r.get("demographic", {})
        scores = r.get("scores", {})
        # Basic
        row["code"] = r.get("code", "")
        row["school"] = r.get("school", "")
        row["status"] = r.get("status", "")
        row["highRisk"] = 1 if r.get("highRisk") else 0
        row["consentGiven"] = 1 if r.get("consentGiven") else 0
        # Demographics
        row["initial"] = demo.get("initial", "")
        row["age"] = _to_num(demo.get("age"))
        row["gender"] = demo.get("gender", "")
        row["classGrade"] = demo.get("classGrade", "")
        row["residence"] = demo.get("residence", "")
        row["parentIncome"] = demo.get("parentIncome", "")
        row["fatherEdu"] = demo.get("fatherEducation", "")
        row["motherEdu"] = demo.get("motherEducation", "")
        row["familyComp"] = demo.get("familyComposition", "")
        row["chronicIll"] = demo.get("chronicIllness", "")
        row["mentalHist"] = demo.get("mentalHistory", "")
        # CESD-R items
        for i in range(1, 21):
            row[f"cesdr_{i}"] = _to_num(r.get(f"cesdr_{i}"))
        row["cesdr_total"] = _to_num(scores.get("cesdr"))
        # PSQI
        row["psqi_bedtime"] = r.get("psqi_bedtime", "")
        row["psqi_waketime"] = r.get("psqi_waketime", "")
        row["psqi_latency"] = _to_num(r.get("psqi_sleepLatency"))
        row["psqi_actualSleep"] = _to_num(r.get("psqi_actualSleep"))
        row["psqi_quality"] = _to_num(r.get("psqi_sleepQuality"))
        row["psqi_total"] = _to_num(scores.get("psqi"))
        # Screen time
        for k in ["hp", "laptop", "tablet", "tiktok", "instagram", "youtube", "whatsapp", "beforeSleep", "feelAfter"]:
            row[f"st_{k}"] = _to_num(r.get(f"st_{k}"))
        # MOS
        for i in range(1, 9):
            row[f"mos_{i}"] = _to_num(r.get(f"mos_{i}"))
        row["mos_total"] = _to_num(scores.get("mos"))
        # Bullying
        for i in range(1, 9):
            row[f"bl_{i}"] = _to_num(r.get(f"bl_{i}"))
        row["bullying_total"] = _to_num(scores.get("bullying"))
        # Religiosity
        for i in range(1, 9):
            row[f"rel_{i}"] = _to_num(r.get(f"rel_{i}"))
        row["relig_total"] = _to_num(scores.get("religiosity"))
        rows.append(row)

    df = pd.DataFrame(rows)

    # Define variable labels for SPSS
    labels = {
        "code": "Kode Penelitian",
        "school": "Sekolah",
        "status": "Status Pengisian",
        "highRisk": "High Risk (1=Ya, 0=Tidak)",
        "consentGiven": "Bersetuju (1=Ya, 0=Tidak)",
        "initial": "Inisial Nama",
        "age": "Usia (tahun)",
        "gender": "Jenis Kelamin",
        "classGrade": "Kelas",
        "residence": "Tempat Tinggal",
        "parentIncome": "Pendapatan Orang Tua",
        "fatherEdu": "Pendidikan Ayah",
        "motherEdu": "Pendidikan Ibu",
        "familyComp": "Komposisi Keluarga",
        "chronicIll": "Riwayat Penyakit Kronis",
        "mentalHist": "Riwayat Gangguan Mental",
        "cesdr_total": "CESD-R Total Skor (0-60)",
        "psqi_total": "PSQI Total Skor (0-21)",
        "mos_total": "MOS-SSS Total Skor (8-40)",
        "bullying_total": "Bullying Total Skor (0-24)",
        "relig_total": "Religiusitas Total Skor (8-40)",
    }
    for i in range(1, 21):
        labels[f"cesdr_{i}"] = f"CESD-R Item {i} (0-3)"
    for i in range(1, 9):
        labels[f"mos_{i}"] = f"MOS-SSS Item {i} (1-5)"
        labels[f"bl_{i}"] = f"Bullying Item {i} (0-3)"
        labels[f"rel_{i}"] = f"Religiusitas Item {i} (1-5)"

    # Write .sav to a temp file, then read and output to stdout
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".sav", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        pyreadstat.write_sav(df, tmp_path, column_labels=[labels.get(c, c) for c in df.columns])
        with open(tmp_path, "rb") as f:
            sys.stdout.buffer.write(f.read())
    finally:
        import os
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _to_num(v):
    """Convert to number, return None if not possible."""
    if v is None or v == "":
        return None
    try:
        return int(v)
    except (ValueError, TypeError):
        try:
            return float(v)
        except (ValueError, TypeError):
            return None


if __name__ == "__main__":
    main()
