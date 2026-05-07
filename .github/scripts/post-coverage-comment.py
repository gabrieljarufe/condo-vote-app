#!/usr/bin/env python3
"""
Posta (ou atualiza) um comment de cobertura JaCoCo no PR.
Sempre exibe arquivos alterados + cobertura, independente de passar ou não no threshold.

Env vars obrigatórias:
  GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, BASE_SHA
  JACOCO_XML, TITLE, MIN_OVERALL, MIN_CHANGED
"""
import xml.etree.ElementTree as ET
import subprocess
import os
import json
import urllib.request

title    = os.environ["TITLE"]
min_ov   = float(os.environ["MIN_OVERALL"])
min_ch   = float(os.environ["MIN_CHANGED"])
pr       = os.environ["PR_NUMBER"]
base_sha = os.environ["BASE_SHA"]
xml_path = os.environ["JACOCO_XML"]
repo     = os.environ["GITHUB_REPOSITORY"]
token    = os.environ["GH_TOKEN"]
marker   = f"<!-- jacoco-cov:{title} -->"


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
    if not os.path.exists(path):
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


def badge(value, threshold):
    return "✅" if value >= threshold else "❌"


overall, file_cov = parse_jacoco(xml_path)

if overall is None:
    body = (
        f"{marker}\n"
        f"### {title}\n\n"
        f"> ⚠️ Relatório não encontrado — o build pode ter falhado antes de gerar o XML."
    )
else:
    diff = subprocess.run(
        ["git", "diff", "--name-only", base_sha, "HEAD"],
        capture_output=True, text=True,
    )
    changed_java = [f for f in diff.stdout.strip().split("\n") if f.endswith(".java")]

    rows = []
    for java_file in changed_java:
        key = java_to_key(java_file)
        if key and key in file_cov:
            pct  = file_cov[key]
            name = key.split("/")[-1].replace(".java", "")
            rows.append((name, pct, badge(pct, min_ch)))
    rows.sort()

    lines = [
        marker,
        f"### {title}",
        "",
        f"**Overall:** `{overall:.1f}%` (mínimo: {min_ov:.0f}%) {badge(overall, min_ov)}",
        "",
    ]

    if rows:
        lines += [
            f"**Arquivos alterados** (mínimo: {min_ch:.0f}%)",
            "",
            "| Arquivo | Cobertura | |",
            "|---|---|---|",
        ] + [f"| `{name}` | `{pct:.1f}%` | {emoji} |" for name, pct, emoji in rows]
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
