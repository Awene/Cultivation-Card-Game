import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../tavern_helper_template-main/package.json', import.meta.url));
const YAML = require('yaml');
// Derive only test-environment settings; all content paths remain shared with the full source card.
const source = YAML.parse(fs.readFileSync('本格修仙.yaml', 'utf8'));
const test = structuredClone(source);
test.世界书名称 = '本格修仙-完整测试世界书';
const regexes = test.扩展字段.正则;
for (const name of ['自定义开局', '状态栏', '正文美化']) {
  const normal = regexes.find(x => x.正则名称 === name);
  const local = regexes.find(x => x.正则名称 === `${name}（测试）`);
  if (!normal || !local) throw Error(`Missing renderer: ${name}`);
  normal.启用 = false;
  local.启用 = true;
  if (name === '正文美化') {
    local.查找表达式 = '/<(now_plot|gametxt)>([\\s\\S]*?)<\\/\\1>/gi';
    local.最大深度 = null;
  }
}
// Preserve the agreed daily-test exclusion without removing the entry or its content.
const daily = test.条目.find(x => x.名称 === '[事件]五毒教-日常');
if (!daily) throw Error('Missing daily entry');
daily.启用 = false;
if (test.条目.length !== source.条目.length) throw Error('Incomplete worldbook');
fs.writeFileSync('本格修仙-测试.yaml', YAML.stringify(test));
console.log(`Full test configuration prepared: ${test.条目.length} entries; shared source content.`);
