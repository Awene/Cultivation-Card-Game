import assert from 'node:assert/strict';
import { renderPreset, assemblePreview, profiles } from '../预设/本格修仙/模拟预设效果.mjs';
import { compactPromptWhitespace } from '../预设/本格修仙/脚本/消息分区.js';

assert.equal(compactPromptWhitespace('a\n\n \n\n  b'), 'a\n\n  b');
const fenced = '```yaml\na: |\n  one\n\n\n  two\n```';
assert.equal(compactPromptWhitespace(fenced), fenced);
for (const profile of profiles) {
  for (const mode of ['main', 'extra']) {
    for (const enabled of [false, true]) {
      const { entries } = renderPreset({ profile, mode, summary: enabled, options: enabled });
      const contract = entries.find(e => e.name === '📚 输出协议').content;
      const schema = contract.match(/<output_schema>([\s\S]*?)<\/output_schema>/)[1];
      assert.equal(schema.includes('UpdateVariable'), mode === 'main');
      assert.equal(schema.includes('summary'), enabled);
      assert.equal(schema.includes('options'), enabled);
      assert.ok(contract.includes(mode === 'main' ? '本轮须更新变量' : '本轮不更新变量'));
      assert.ok(!/VARIABLE_MODE|仅由主API|summary\?|options\?/.test(contract));
      const prompt = assemblePreview(entries).map(m => m.content).join('\n');
      assert.ok(!/\n[ \t]*\n[ \t]*\n/.test(prompt));
      for (const tag of ['VOID_reference', 'VOID_runtime', 'world_summary']) {
        assert.ok(new RegExp(`^<${tag}>\\n[\\s\\S]*?\\n<\\/${tag}>$`, 'm').test(prompt), `${tag} boundaries get separate lines`);
      }
      assert.ok(!/简短检查表|brief English checklist/.test(prompt));
    }
  }
}
console.log('Prompt layout: 16 mode/model/footer combinations, block boundaries and fenced whitespace passed.');
