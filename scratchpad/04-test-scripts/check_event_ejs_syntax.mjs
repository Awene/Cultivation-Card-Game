// 检查事件目录内所有 EJS 代码块的 JavaScript 语法。
// 用法: node scratchpad/check_event_ejs_syntax.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { extname, join } from 'node:path';

function collect(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? collect(path) : (extname(path) === '.txt' ? [path] : []);
  });
}

let failed = 0;
for (const file of collect('世界书/事件')) {
  const source = readFileSync(file, 'utf8');
  const tag = /<%([_=\-]?)([\s\S]*?)([_\-]?)%>/g;
  let match;
  let code = '';
  while ((match = tag.exec(source))) {
    if (match[1] !== '=' && match[1] !== '-') code += `${match[2]}\n`;
  }
  try {
    new Function(code);
    console.log(`✓ ${file}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${file}\n  ${error.message}`);
  }
}

process.exit(failed ? 1 : 0);
