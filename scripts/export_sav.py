#!/usr/bin/env python3
"""
TeenMind Research — SPSS .sav Export Script
Reads JSON data from stdin, writes a real .sav file to stdout.

Usage:
    echo '{"respondents":[...]}' | python3 scripts/export_sav.py > output.sav

NOTE (perbaikan): versi lama script ini memakai loop range() hardcode
(mos 1-8, bl 1-8, dst.) yang tidak sinkron dengan jumlah item instrumen
sebenarnya (MOS-SSS 10 item, GBS+Climate School 12 item tercampur), dan
daftar field Screen Time yang sama sekali tidak cocok dengan kuesioner
asli. Sekarang skrip ini membangun kolom secara DINAMIS dari key yang
benar-benar dikirim oleh Node (lihat src/app/api/admin/export-sav/route.ts),
alih-alih menduga ulang jumlah item — jadi penambahan/pengubahan item
instrumen di masa depan tidak lagi butuh perbaikan manual berpasangan di
Node maupun di sini.
"""
import sys
import json
import warnings
warnings.filterwarnings("ignore")

# Kolom yang tidak ikut jadi kolom dinamis (ditangani terpisah di atas).
_HANDLED_TOP_LEVEL = {"code", "school", "status", "highRisk", "consentGiven", "demographic", "scores"}


def main():
    try:
        import pandas as pd
        import pyreadstat
    except ImportError as e:
        sys.stderr.write(f"Missing package: {e}\n")
        sys.exit(1)

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

    # Build DataFrame. Column set = union of all dynamic keys across all
    # respondents (a field missing for one respondent still gets a column,
    # filled with None), in first-seen order for stable column ordering.
    rows = []
    dynamic_keys = []
    seen = set()
    for r in respondents:
        for k in r.keys():
            if k in _HANDLED_TOP_LEVEL:
                continue
            if k not in seen:
                seen.add(k)
                dynamic_keys.append(k)

    for r in respondents:
        demo = r.get("demographic", {})
        scores = r.get("scores", {})
        row = {
            "code": r.get("code", ""),
            "school": r.get("school", ""),
            "status": r.get("status", ""),
            "highRisk": 1 if r.get("highRisk") else 0,
            "consentGiven": 1 if r.get("consentGiven") else 0,
            "initial": demo.get("initial", ""),
            "age": _to_num(demo.get("age")),
            "gender": demo.get("gender", ""),
            "classGrade": demo.get("classGrade", ""),
            "residence": demo.get("residence", ""),
            "parentIncome": demo.get("parentIncome", ""),
            "fatherEdu": demo.get("fatherEducation", ""),
            "motherEdu": demo.get("motherEducation", ""),
            "familyComp": demo.get("familyComposition", ""),
            "chronicIll": demo.get("chronicIllness", ""),
            "mentalHist": demo.get("mentalHistory", ""),
            "cesdr_total": _to_num(scores.get("cesdr")),
            "psqi_total": _to_num(scores.get("psqi")),
            "mos_total": _to_num(scores.get("mos")),
            "gbs_total": _to_num(scores.get("gbs")),
            "climate_total": _to_num(scores.get("climate")),
            "relig_total": _to_num(scores.get("religiosity")),
            "screentime_total": _to_num(scores.get("screentime")),
        }
        # Dynamic per-item columns (cesdr_*, psqi_*, st_*, mos_*, gbs_*, climate_*, rel_*)
        for k in dynamic_keys:
            v = r.get(k, "")
            # Time-of-day fields (psqi_bedtime/psqi_waketime) and text/categoricals stay as-is;
            # everything else attempts numeric coercion.
            if k in ("psqi_bedtime", "psqi_waketime"):
                row[k] = v if v is not None else ""
            else:
                row[k] = _to_num(v) if _to_num(v) is not None else (v if v not in (None, "") else None)
        rows.append(row)

    df = pd.DataFrame(rows)

    # Define variable labels for SPSS. Any column not listed here falls back
    # to its own key as the label (still functional in SPSS, just less
    # descriptive) rather than silently failing.
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
        "mos_total": "MOS-SSS Total Skor (10-50)",
        "gbs_total": "GBS/Bullying Total Skor (0-12)",
        "climate_total": "Climate School Total Skor (8-32, reverse-scored)",
        "relig_total": "Religiusitas Total Skor (8-32)",
        "screentime_total": "Screen Time Total (deskriptif, 0-17, bukan skala baku)",
    }
    for i in range(1, 21):
        labels[f"cesdr_{i}"] = f"CESD-R Item {i} (0-3)"
    for i in range(1, 11):
        labels[f"mos_{i}"] = f"MOS-SSS Item {i} (1-5)"
    for i in range(1, 5):
        labels[f"gbs_{i}"] = f"GBS Item {i} (0-3)"
    for i in range(1, 9):
        labels[f"climate_{i}"] = f"Climate School Item {i} (=item {i+4} kuesioner asli, 1-4, raw belum reverse-scored)"
        labels[f"rel_{i}"] = f"Religiusitas Item {i} (1-4)"
    labels["st_weekdayScreen"] = "Screen time hari sekolah (0-4)"
    labels["st_weekendScreen"] = "Screen time akhir pekan (0-4)"
    labels["st_socialCompare"] = "Perbandingan sosial di medsos (0-4)"
    labels["st_cyberbullying"] = "Cyberbullying (0-2)"
    labels["st_sleepDelay"] = "Gadget menunda tidur (0-3)"
    labels["st_platforms"] = "Platform medsos (gabungan, pisah titik-koma)"
    labels["psqi_bedtime"] = "Jam mulai tidur"
    labels["psqi_waketime"] = "Jam bangun"
    labels["psqi_c1_subjectiveQuality"] = "PSQI C1 Kualitas Subjektif (0-3)"
    labels["psqi_c2_sleepLatency"] = "PSQI C2 Latensi Tidur (0-3)"
    labels["psqi_c3_sleepDuration"] = "PSQI C3 Durasi Tidur (0-3)"
    labels["psqi_c4_sleepEfficiency"] = "PSQI C4 Efisiensi Tidur (0-3)"
    labels["psqi_c5_sleepDisturbance"] = "PSQI C5 Gangguan Tidur (0-3)"
    labels["psqi_c6_sleepMedication"] = "PSQI C6 Obat Tidur (0-3)"
    labels["psqi_c7_daytimeDysfunction"] = "PSQI C7 Disfungsi Siang Hari (0-3)"

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
