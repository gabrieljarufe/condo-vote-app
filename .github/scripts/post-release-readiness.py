#!/usr/bin/env python3
"""
Posta (ou atualiza) um comment "Release Readiness" no PR develop -> main.

Conteúdo:
  1. Release Summary — commits em $HEAD_REF que ainda não estão em $BASE_REF,
     agrupados por tipo (conventional commit).
  2. Migrations a aplicar em prod — arquivos V*.sql adicionados em $HEAD_REF
     vs $BASE_REF.

Env vars obrigatórias:
  GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, BASE_REF, HEAD_REF

Modo dry-run:
  Defina DRY_RUN=1 para imprimir o body sem postar.
"""
import json
import os
import re
import subprocess
import urllib.request

repo     = os.environ["GITHUB_REPOSITORY"]
pr       = os.environ["PR_NUMBER"]
base_ref = os.environ["BASE_REF"]
head_ref = os.environ["HEAD_REF"]
token    = os.environ.get("GH_TOKEN", "")
dry_run  = os.environ.get("DRY_RUN") == "1"
marker   = "<!-- release-readiness:summary -->"

MIGRATIONS_PATH = "backend/src/main/resources/db/migration"

# Ordem de exibição das seções (chave conv-commit -> rótulo)
SECTIONS = [
    ("feat",     "✨ Features"),
    ("fix",      "🐛 Fixes"),
    ("perf",     "⚡ Performance"),
    ("refactor", "♻️ Refactor"),
    ("test",     "🧪 Tests"),
    ("ci",       "🤖 CI/CD"),
    ("build",    "📦 Build"),
    ("chore",    "🧹 Chore"),
    ("docs",     "📝 Docs"),
    ("style",    "🎨 Style"),
    ("other",    "📌 Outros"),
]

CONV_RE = re.compile(
    r"^(?P<type>feat|fix|perf|refactor|test|ci|build|chore|docs|style)"
    r"(?:\((?P<scope>[^)]+)\))?!?:\s*"
    r"(?P<subject>.+?)"
    r"(?:\s+\(#(?P<pr>\d+)\))?$"
)


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


def sh(args):
    return subprocess.run(args, capture_output=True, text=True, check=False).stdout


def fetch_refs():
    subprocess.run(
        ["git", "fetch", "origin", base_ref, head_ref],
        capture_output=True, text=True, check=False,
    )


def collect_commits():
    out = sh([
        "git", "log",
        f"origin/{base_ref}..origin/{head_ref}",
        "--no-merges",
        "--pretty=format:%H%x09%s",
    ])
    commits = []
    for line in out.splitlines():
        if not line.strip():
            continue
        sha, _, subject = line.partition("\t")
        commits.append((sha, subject))
    return commits


def classify(subject):
    m = CONV_RE.match(subject)
    if not m:
        return "other", None, subject, None
    return (
        m.group("type"),
        m.group("scope"),
        m.group("subject"),
        m.group("pr"),
    )


def render_summary(commits):
    lines = ["### 📦 Release Summary", ""]
    if not commits:
        lines.append("_Nenhum commit a promover — `develop` está alinhado com `main`._")
        return lines

    buckets = {key: [] for key, _ in SECTIONS}
    for _, subject in commits:
        ctype, scope, clean_subject, pr_num = classify(subject)
        if ctype not in buckets:
            ctype = "other"
        buckets[ctype].append((clean_subject, scope, pr_num))

    lines.append(f"**{len(commits)} commits** prontos pra promoção desde a última atualização de `{base_ref}`.")
    lines.append("")

    for key, label in SECTIONS:
        items = buckets[key]
        if not items:
            continue
        lines.append(f"**{label}**")
        for subject, scope, pr_num in items:
            suffix_parts = []
            if pr_num:
                suffix_parts.append(f"#{pr_num}")
            if scope:
                suffix_parts.append(f"`{scope}`")
            suffix = f" ({' · '.join(suffix_parts)})" if suffix_parts else ""
            lines.append(f"- {subject}{suffix}")
        lines.append("")
    return lines


def collect_new_migrations():
    out = sh([
        "git", "diff",
        "--name-only", "--diff-filter=A",
        f"origin/{base_ref}..origin/{head_ref}",
        "--", f"{MIGRATIONS_PATH}/V*.sql",
    ])
    files = [line.strip() for line in out.splitlines() if line.strip()]

    def version_key(path):
        name = os.path.basename(path)
        m = re.match(r"V(\d+)__", name)
        return int(m.group(1)) if m else 0

    return sorted(files, key=version_key)


def render_migrations(files):
    lines = ["### 🗄️ Migrations a aplicar em prod", ""]
    if not files:
        lines.append("_Nenhuma migration nova — promoção sem mudança de schema._")
        return lines
    for path in files:
        name = os.path.basename(path)
        lines.append(f"- `{name}`")
    return lines


def post_or_update(body):
    if dry_run:
        print(body)
        return
    comments = api("GET", f"/repos/{repo}/issues/{pr}/comments?per_page=100")
    existing = next((c for c in comments if c["body"].startswith(marker)), None)
    if existing:
        api("PATCH", f"/repos/{repo}/issues/comments/{existing['id']}", {"body": body})
        print(f"Comment atualizado: {existing['id']}")
    else:
        result = api("POST", f"/repos/{repo}/issues/{pr}/comments", {"body": body})
        print(f"Comment criado: {result['id']}")


def main():
    fetch_refs()
    commits = collect_commits()
    migrations = collect_new_migrations()

    sections = [marker, "## 🚀 Release Readiness", ""]
    sections += render_summary(commits)
    sections += [""]
    sections += render_migrations(migrations)

    body = "\n".join(sections).rstrip() + "\n"
    post_or_update(body)


if __name__ == "__main__":
    main()
