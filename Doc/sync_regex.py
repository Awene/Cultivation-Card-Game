#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
正则文件同步脚本

将 tavern_helper_template-main/src/面板美化/*.html 的内容前后用 ``` 包裹,
输出到 Cultivation-Card-Game/正则/*(测试).txt 供酒馆正则使用。

新增美化文件时,只需向 TARGETS 增加一项 (源, 目标) 即可。
"""

from pathlib import Path

# 本脚本位置:    项目根/世界书/Cultivation-Card-Game/Doc/sync_regex.py
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent.parent  # → 世界书/

SRC_DIR = PROJECT_ROOT / "tavern_helper_template-main" / "src" / "面板美化"
OUT_DIR = SCRIPT_DIR.parent / "正则"

# (源 html, 输出 txt)
TARGETS = [
    (SRC_DIR / "正文美化.html",   OUT_DIR / "正文美化(测试).txt"),
    (SRC_DIR / "思维链美化.html", OUT_DIR / "思维链美化(测试).txt"),
]

FENCE = "```"


def sync_one(source: Path, target: Path) -> bool:
    if not source.exists():
        print(f"[跳过] 源文件不存在: {source}")
        return False

    # 读 HTML 内容(UTF-8;失败时回退 GBK / latin-1)
    raw_bytes = source.read_bytes()
    for enc in ("utf-8", "gbk", "latin-1"):
        try:
            content = raw_bytes.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        print(f"[错误] 无法解码源文件: {source}")
        return False

    # 规范化换行(避免 CRLF/LF 混杂)
    content = content.replace("\r\n", "\n").replace("\r", "\n")
    if not content.endswith("\n"):
        content += "\n"

    wrapped = f"{FENCE}\n{content}{FENCE}\n"

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(wrapped, encoding="utf-8", newline="\n")

    src_size = len(content) / 1024
    out_size = len(wrapped) / 1024
    print(f"[OK] {source.name} -> {target.name}  ({src_size:.2f} KB -> {out_size:.2f} KB)")
    return True


def main() -> int:
    fail = 0
    for source, target in TARGETS:
        if not sync_one(source, target):
            fail += 1
    if fail:
        print(f"[警告] {fail} 个目标同步失败")
        return 1
    print("[完成] 全部同步完成")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
