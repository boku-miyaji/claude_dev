#!/usr/bin/env python3
"""
セキュリティスキャンスクリプト
GitHub Actions の SHA ピン留め状況、CI 権限、依存関係設定を自動チェックする。
週次で GitHub Actions から実行される。
"""

import os
import re
import json
import glob
from datetime import datetime, timezone, timedelta
from pathlib import Path

JST = timezone(timedelta(hours=9))
NOW = datetime.now(JST)
REPORT_DATE = NOW.strftime("%Y-%m-%d")

# スキャン対象ディレクトリ（ワークスペースルートからの相対パス）
WORKSPACE = os.environ.get("GITHUB_WORKSPACE", os.getcwd())
SCAN_DIRS = [
    ".",  # claude_dev 本体
    "project-rikyu-sales-proposals-poc",
    "circuit_diagram",
    "project-scotch-care",
]

# ────────────────────────────────────────
# チェッカー関数
# ────────────────────────────────────────

def check_actions_sha_pinning(workflow_path: str) -> list[dict]:
    """GitHub Actions のタグ指定を検出する。"""
    findings = []
    try:
        with open(workflow_path) as f:
            for i, line in enumerate(f, 1):
                match = re.search(r'uses:\s+([^@\s]+)@([^\s#]+)', line)
                if match:
                    action, ref = match.group(1), match.group(2)
                    # SHA は 40文字の hex
                    if not re.match(r'^[0-9a-f]{40}$', ref):
                        # 自社アクション（aces-inc/）はスキップ可能だが一応報告
                        findings.append({
                            "file": workflow_path,
                            "line": i,
                            "severity": "high",
                            "rule": "actions-sha-pinning",
                            "message": f"{action}@{ref} — タグ指定。SHA ピン留めが必要",
                        })
    except Exception as e:
        findings.append({
            "file": workflow_path, "line": 0, "severity": "error",
            "rule": "file-read", "message": str(e),
        })
    return findings


def check_permissions(workflow_path: str) -> list[dict]:
    """permissions: の宣言漏れを検出する。"""
    findings = []
    try:
        with open(workflow_path) as f:
            content = f.read()
        if "permissions:" not in content:
            findings.append({
                "file": workflow_path, "line": 0, "severity": "medium",
                "rule": "missing-permissions",
                "message": "permissions: が未宣言。最小権限の原則に違反の可能性",
            })
    except Exception:
        pass
    return findings


def check_ci_install_commands(workflow_path: str) -> list[dict]:
    """CI での危険なインストールコマンドを検出する。"""
    findings = []
    dangerous_patterns = [
        (r'\bnpm install\b(?!.*--ignore-scripts)', "npm install を検出。npm ci --ignore-scripts を使用してください"),
        (r'\bpoetry update\b', "poetry update を検出。CI では poetry install を使用してください"),
        (r'\bpoetry lock\b', "poetry lock を検出。CI では lockfile を再生成しないでください"),
        (r'\bpip install\b(?!.*-r\b)(?!.*requirements)', "pip install を検出（requirements指定なし）。lockfile ベースのインストールを推奨"),
    ]
    try:
        with open(workflow_path) as f:
            for i, line in enumerate(f, 1):
                for pattern, message in dangerous_patterns:
                    if re.search(pattern, line):
                        findings.append({
                            "file": workflow_path, "line": i,
                            "severity": "high",
                            "rule": "unsafe-ci-install",
                            "message": message,
                        })
    except Exception:
        pass
    return findings


def check_npmrc(project_dir: str) -> list[dict]:
    """.npmrc の ignore-scripts 設定を確認する。"""
    findings = []
    # package.json が存在するかチェック（JSプロジェクトかどうか）
    # output/ や node_modules/ 配下は除外
    # サブプロジェクトの package.json は除外（個別にスキャンされる）
    exclude_patterns = ["/output/", "/node_modules/", "/.pnpm-store/"]
    for sub in SCAN_DIRS:
        if sub != "." and sub != os.path.basename(project_dir):
            exclude_patterns.append(f"/{sub}/")
    js_files = [
        p for p in glob.glob(os.path.join(project_dir, "**/package.json"), recursive=True)
        if not any(ex in p for ex in exclude_patterns)
    ]
    has_js = bool(js_files)
    if not has_js:
        return findings

    npmrc_path = os.path.join(project_dir, ".npmrc")
    if not os.path.exists(npmrc_path):
        findings.append({
            "file": project_dir, "line": 0, "severity": "medium",
            "rule": "missing-npmrc",
            "message": "JS プロジェクトだが .npmrc が存在しない。ignore-scripts=true の設定が必要",
        })
    else:
        with open(npmrc_path) as f:
            content = f.read()
        if "ignore-scripts" not in content:
            findings.append({
                "file": npmrc_path, "line": 0, "severity": "medium",
                "rule": "npmrc-no-ignore-scripts",
                "message": ".npmrc に ignore-scripts=true が未設定",
            })
    return findings


def check_dependabot(project_dir: str) -> list[dict]:
    """dependabot.yml の存在を確認する。"""
    findings = []
    workflows_dir = os.path.join(project_dir, ".github", "workflows")
    if not os.path.isdir(workflows_dir):
        return findings  # ワークフローがなければ不要

    dependabot_path = os.path.join(project_dir, ".github", "dependabot.yml")
    if not os.path.exists(dependabot_path):
        findings.append({
            "file": project_dir, "line": 0, "severity": "low",
            "rule": "missing-dependabot",
            "message": "GitHub Actions ワークフローがあるが dependabot.yml が未設定",
        })
    return findings


def check_pull_request_target(workflow_path: str) -> list[dict]:
    """pull_request_target の使用を検出する。"""
    findings = []
    try:
        with open(workflow_path) as f:
            for i, line in enumerate(f, 1):
                if "pull_request_target" in line:
                    findings.append({
                        "file": workflow_path, "line": i, "severity": "high",
                        "rule": "pull-request-target",
                        "message": "pull_request_target を検出。セキュリティリスクが高い",
                    })
    except Exception:
        pass
    return findings


# ────────────────────────────────────────
# メインスキャン
# ────────────────────────────────────────

def scan_project(project_dir: str, exclude_subdirs: list[str] | None = None) -> list[dict]:
    """1つのプロジェクトをスキャンする。"""
    all_findings = []
    exclude_subdirs = exclude_subdirs or []

    # ワークフローファイルをスキャン
    workflows = glob.glob(os.path.join(project_dir, ".github", "workflows", "*.yml"))
    workflows += glob.glob(os.path.join(project_dir, ".github", "workflows", "*.yaml"))
    for wf in workflows:
        all_findings.extend(check_actions_sha_pinning(wf))
        all_findings.extend(check_permissions(wf))
        all_findings.extend(check_ci_install_commands(wf))
        all_findings.extend(check_pull_request_target(wf))

    # プロジェクトレベルのチェック（サブプロジェクトを除外）
    all_findings.extend(check_npmrc(project_dir))
    all_findings.extend(check_dependabot(project_dir))

    # サブディレクトリ除外: ルートスキャン時にサブプロジェクトの findings を含めない
    if exclude_subdirs:
        all_findings = [
            f for f in all_findings
            if not any(os.path.join(project_dir, sub) in f["file"] for sub in exclude_subdirs)
        ]

    return all_findings


def severity_order(s: str) -> int:
    return {"error": 0, "high": 1, "medium": 2, "low": 3}.get(s, 9)


def generate_report(results: dict[str, list[dict]]) -> str:
    """Markdown レポートを生成する。"""
    lines = [
        f"# 週次セキュリティスキャン — {REPORT_DATE}",
        "",
        f"実行時刻: {NOW.strftime('%Y-%m-%d %H:%M JST')}",
        "",
    ]

    total_findings = sum(len(f) for f in results.values())
    high_count = sum(1 for fs in results.values() for f in fs if f["severity"] == "high")
    medium_count = sum(1 for fs in results.values() for f in fs if f["severity"] == "medium")

    lines.append(f"## サマリー: {total_findings} 件（🔴 High: {high_count} / 🟡 Medium: {medium_count}）")
    lines.append("")

    for project, findings in results.items():
        project_name = os.path.basename(project) or "claude_dev"
        if not findings:
            lines.append(f"### ✅ {project_name} — 問題なし")
            lines.append("")
            continue

        findings.sort(key=lambda x: severity_order(x["severity"]))
        lines.append(f"### {project_name} — {len(findings)} 件")
        lines.append("")
        lines.append("| 深刻度 | ルール | ファイル | 行 | 内容 |")
        lines.append("|--------|--------|---------|---:|------|")
        for f in findings:
            sev_icon = {"high": "🔴", "medium": "🟡", "low": "🔵", "error": "⚫"}.get(f["severity"], "")
            rel_file = os.path.relpath(f["file"], WORKSPACE)
            lines.append(f"| {sev_icon} {f['severity']} | {f['rule']} | {rel_file} | {f['line']} | {f['message']} |")
        lines.append("")

    return "\n".join(lines)


def main():
    results = {}
    # ルートディレクトリはサブプロジェクトを除外してスキャン
    sub_dirs = [d for d in SCAN_DIRS if d != "."]
    for scan_dir in SCAN_DIRS:
        full_path = os.path.join(WORKSPACE, scan_dir)
        if os.path.isdir(full_path):
            exclude = sub_dirs if scan_dir == "." else []
            results[full_path] = scan_project(full_path, exclude_subdirs=exclude)
        else:
            results[full_path] = []

    report = generate_report(results)

    # レポート出力先
    audit_dir = os.path.join(WORKSPACE, ".company", "departments", "security", "audits")
    os.makedirs(audit_dir, exist_ok=True)

    # 最新スキャン結果（鮮度チェック用の固定ファイル名）
    latest_path = os.path.join(audit_dir, "scan-latest.md")
    with open(latest_path, "w") as f:
        f.write(report)

    # 日付入りアーカイブ
    archive_path = os.path.join(audit_dir, f"scan-{REPORT_DATE}.md")
    with open(archive_path, "w") as f:
        f.write(report)

    print(report)

    # サマリーを JSON でも出力（CI の後続ステップ用）
    total = sum(len(f) for f in results.values())
    high = sum(1 for fs in results.values() for f in fs if f["severity"] == "high")
    summary = {"date": REPORT_DATE, "total": total, "high": high}
    print(f"\n::notice::Security scan complete: {total} findings ({high} high)")

    # high が 1件以上なら exit code 1（CI で warning として利用可能）
    if high > 0:
        print(f"::warning::Found {high} high-severity findings")


if __name__ == "__main__":
    main()
