"""UTF-8 文本 token 计数；--render 对自包含 EJS 试稿做固定种子采样。

依赖：python -m pip install tiktoken；渲染另需 Node.js。
默认比较正式角色生成规则与伪代码试稿；可传入任意文本路径。
"""
import argparse
import json
from pathlib import Path
import statistics
import subprocess
import sys

import tiktoken


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    base = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("files", nargs="*", type=Path)
    parser.add_argument("--encoding", default="cl100k_base")
    parser.add_argument("--render", action="store_true", help="只用于受信任、自包含的 EJS；不是酒馆环境模拟器")
    parser.add_argument("--samples", type=int, default=20)
    args = parser.parse_args()
    if args.samples < 1:
        parser.error("--samples 必须大于 0")
    files = args.files or [base.parent / "世界书/[角色生成规则].txt", base / "[角色生成规则]-伪代码试稿.txt"]
    encoding = tiktoken.get_encoding(args.encoding)
    count = lambda text: len(encoding.encode(text, disallowed_special=()))
    rows = []
    for path in files:
        source = path.read_text(encoding="utf-8-sig")
        row = {"file": str(path), "source_tokens": count(source)}
        if args.render:
            result = subprocess.run(
                ["node", str(base / "render_prompt_sample.mjs"), str(path), str(args.samples)],
                check=True, capture_output=True, encoding="utf-8",
            )
            values = [count(text) for text in json.loads(result.stdout)]
            row.update(rendered_mean=statistics.mean(values), rendered_min=min(values), rendered_max=max(values))
        rows.append(row)
    output = {"encoding": args.encoding, "samples": args.samples if args.render else 0, "files": rows}
    metric = "rendered_mean" if args.render else "source_tokens"
    if len(rows) == 2 and rows[0][metric]:
        saved = rows[0][metric] - rows[1][metric]
        output["comparison"] = {"metric": metric, "saved_tokens": round(saved, 2), "saved_percent": round(saved / rows[0][metric] * 100, 2)}
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
