#!/usr/bin/env python3
"""
Posta (ou atualiza) um único comment de cobertura JaCoCo no PR,
combinando unit tests (UT) e integration tests (IT) em uma tabela só.

- Coluna UT aparece apenas se algum arquivo alterado tem cobertura de UT.
- Coluna IT aparece apenas se algum arquivo alterado tem cobertura de IT.
- Para classes de teste (XxxIT, XxxTest), busca a classe de produção
  correspondente no relatório JaCoCo.

Env vars obrigatórias:
  GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, BASE_SHA, HEAD_SHA
  JACOCO_UNIT_XML, JACOCO_IT_XML, MIN_OVERALL, MIN_CHANGED
"""
import xml.etree.ElementTree as ET
import subprocess
import os
import json
import urllib.request

min_ov       = float(os.environ["MIN_OVERALL"])
min_ch       = float(os.environ["MIN_CHANGED"])
pr           = os.environ["PR_NUMBER"]
base_sha     = os.environ["BASE_SHA"]
head_sha     = os.environ["HEAD_SHA"]
unit_xml     = os.environ["JACOCO_UNIT_XML"]
it_xml       = os.environ["JACOCO_IT_XML"]
repo         = os.environ["GITHUB_REPOSITORY"]
token        = os.environ["GH_TOKEN"]
marker       = "<!-- jacoco-cov:backend-coverage -->"


def api(method, path, data=None):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        data=json.dumps(data).encode() if data else None,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
        },
        method=method,
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def parse_jacoco(path):
    """Retorna (overall_pct | None, {jacoco_key: line_pct})."""
    if not path or not os.path.exists(path):
        return None, {}
    root = ET.parse(path).getroot()
    overall = None
    for c in root.findall("counter"):
        if c.get("type") == "LINE":
            cv, ms = int(c.get("covered", 0)), int(c.get("missed", 0))
            overall = cv / (cv + ms) * 100 if (cv + ms) else 0
    files = {}
    for pkg in root.findall("package"):
        for sf in pkg.findall("sourcefile"):
            key = f"{pkg.get('name')}/{sf.get('name')}"
            for c in sf.findall("counter"):
                if c.get("type") == "LINE":
                    cv, ms = int(c.get("covered", 0)), int(c.get("missed", 0))
                    files[key] = cv / (cv + ms) * 100 if (cv + ms) else 0
    return overall, files


def java_to_key(path):
    for m in ["/main/java/", "/test/java/"]:
        if m in path:
            return path.split(m, 1)[1]
    return None


def get_changed_java_files():
    merge_base = subprocess.run(
        ["git", "merge-base", base_sha, head_sha],
        capture_output=True, text=True,
    ).stdout.strip() or base_sha

    result = subprocess.run(
        ["git", "diff", "--name-status", merge_base, head_sha],
        capture_output=True, text=True,
    )
    files = []
    for line in result.stdout.strip().split("\n"):
        if not line:
            continue
        parts = line.split("\t", 1)
        if len(parts) == 2 and parts[1].endswith(".java"):
            files.append((parts[0][0], parts[1]))  # (A|M|D|R, path)
    return files


def badge(value, threshold):
    return "✅" if value >= threshold else "❌"


def resolve_coverage(name, key, file_cov):
    """
    Retorna (pct, display_str) para um arquivo no relatório.
    Para classes de teste, tenta encontrar a classe de produção correspondente.
    """
    if key and key in file_cov:
        pct = file_cov[key]
        return pct, f"`{pct:.1f}%`"

    # Tenta sufixos de teste comuns
    prod_name = name
    for suffix in ("IT", "Tests", "Test", "Spec"):
        if prod_name.endswith(suffix):
            prod_name = prod_name[: -len(suffix)]
            break

    if prod_name != name:
        prod_java = prod_name + ".java"
        for k, pct in file_cov.items():
            if k.endswith("/" + prod_java):
                return pct, f"`{pct:.1f}%` _(cobre `{prod_name}`)_"

    return None, "—"


overall_ut, file_cov_ut = parse_jacoco(unit_xml)
overall_it, file_cov_it = parse_jacoco(it_xml)

changed_java = get_changed_java_files()

# Monta linhas da tabela
Row = tuple  # (sort_key, label, ut_pct|None, ut_display, it_pct|None, it_display)
rows: list[Row] = []

for status, java_file in changed_java:
    key   = java_to_key(java_file)
    name  = (key or java_file).split("/")[-1].replace(".java", "")
    label = f"`{name}` _(novo)_" if status == "A" else f"`{name}`"

    ut_pct, ut_display = resolve_coverage(name, key, file_cov_ut)
    it_pct, it_display = resolve_coverage(name, key, file_cov_it)

    if ut_pct is None and it_pct is None:
        continue  # arquivo sem cobertura em nenhum dos dois → omite

    rows.append((name, label, ut_pct, ut_display, it_pct, it_display))

rows.sort()

# Decide quais colunas exibir
has_ut = any(r[2] is not None for r in rows)
has_it = any(r[4] is not None for r in rows)

# Monta body
overall_parts = []
if overall_ut is not None:
    overall_parts.append(f"UT `{overall_ut:.1f}%` {badge(overall_ut, min_ov)}")
if overall_it is not None:
    overall_parts.append(f"IT `{overall_it:.1f}%` {badge(overall_it, min_ov)}")

overall_line = "  ·  ".join(overall_parts) if overall_parts else "_sem dados_"

lines = [
    marker,
    "### Backend Coverage",
    "",
    f"**Overall** (mínimo: {min_ov:.0f}%)  —  {overall_line}",
    "",
]

if rows:
    header = ["Arquivo"]
    if has_ut:
        header.append("UT")
    if has_it:
        header.append("IT")
    header.append("")

    lines += [
        f"**Arquivos alterados** (mínimo: {min_ch:.0f}%)",
        "",
        "| " + " | ".join(header) + " |",
        "| " + " | ".join(["---"] * len(header)) + " |",
    ]

    for _, label, ut_pct, ut_display, it_pct, it_display in rows:
        coverages = [c for c in [ut_pct, it_pct] if c is not None]
        emoji = badge(min(coverages), min_ch)
        cols = [label]
        if has_ut:
            cols.append(ut_display)
        if has_it:
            cols.append(it_display)
        cols.append(emoji)
        lines.append("| " + " | ".join(cols) + " |")
else:
    lines.append("_Nenhum arquivo Java alterado com cobertura registrada._")

body = "\n".join(lines)

comments = api("GET", f"/repos/{repo}/issues/{pr}/comments?per_page=100")
existing = next((c for c in comments if c["body"].startswith(marker)), None)

if existing:
    api("PATCH", f"/repos/{repo}/issues/comments/{existing['id']}", {"body": body})
    print(f"Comment atualizado: {existing['id']}")
else:
    result = api("POST", f"/repos/{repo}/issues/{pr}/comments", {"body": body})
    print(f"Comment criado: {result['id']}")
