#!/usr/bin/env node
// Local preview only: macros → EJS → message partition. Placeholders are not live data.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { runInNewContext } from 'node:vm';
import { processCultivationMessages } from './脚本/消息分区.js';
import { HEADER_NOISE_MACRO, buildHeaderNoise } from './脚本/头部噪声.js';

const root = dirname(fileURLToPath(import.meta.url));
const require = createRequire(new URL('../../../tavern_helper_template-main/package.json', import.meta.url));
const YAML = require('yaml');
const templateRuntime = {};
runInNewContext(readFileSync(new URL('../../../../../SillyTavern-1.16.0/data/default-user/extensions/ST-Prompt-Template/src/3rdparty/ejs.js', import.meta.url), 'utf8'), templateRuntime);
export const profiles = ['Gemini', 'Claude', 'Glm', 'DeepSeek'];

function readEntry(item) {
  if (item.内容 !== undefined) return item.内容;
  if (!item.文件) return '';
  const base = resolve(root, item.文件.replaceAll('\\', '/'));
  const path = ['', '.txt', '.yaml', '.js'].map(ext => base + ext).find(existsSync);
  if (!path) throw new Error(`Missing preset entry: ${item.文件}`);
  return readFileSync(path, 'utf8');
}

// Use the installed legacy variable-macro definitions. ST evaluates these before
// {{user}} and comments, not innermost-first. Browser persistence is stubbed.
const variableSource = readFileSync(new URL('../../../../../SillyTavern-1.16.0/public/scripts/variables.js', import.meta.url), 'utf8');
const variableFunction = variableSource.match(/export function getVariableMacros\(\) \{[\s\S]*?^\}/m)?.[0];
if (!variableFunction) throw new Error('Cannot locate installed ST variable macros');
const variableRuntime = { vars: {} };
runInNewContext(`
  function setLocalVariable(name, value) { vars[name] = value; }
  function getLocalVariable(name) { return vars[name] ?? ''; }
  ${variableFunction.replace('export ', '')}
  var variableMacros = getVariableMacros();
`, variableRuntime);

const macroSource = readFileSync(new URL('../../../../../SillyTavern-1.16.0/public/scripts/macros.js', import.meta.url), 'utf8');
const randomFunction = macroSource.match(/function getRandomReplaceMacro\(\) \{[\s\S]*?^\}/m)?.[0];
if (!randomFunction) throw new Error('Cannot locate installed ST random macro');
const randomRuntime = { seedrandom: () => Math.random };
runInNewContext(`${randomFunction}\nvar randomMacro = getRandomReplaceMacro();`, randomRuntime);

// Supported subset: legacy user → variables → trim → user → comment → random.
// Exported so regressions can reproduce the malformed input before verifying the fix.
export function expandPresetMacros(text, vars, user) {
  variableRuntime.vars = vars;
  text = text.replace(/<USER>/gi, () => user);
  for (const macro of variableRuntime.variableMacros) text = text.replace(macro.regex, macro.replace);
  text = text.replace(/(?:\r?\n)*{{trim}}(?:\r?\n)*/gi, '');
  text = text.replace(/{{user}}/gi, () => user);
  text = text.replace(/\{\{\/\/([\s\S]*?)\}\}/gm, '');
  return text.replace(randomRuntime.randomMacro.regex, randomRuntime.randomMacro.replace);
}

// Use the installed template extension's actual EJS engine, without browser side effects.
function ejs(text, vars) {
  return templateRuntime.ejs.render(text, { getvar: key => vars[key] ?? '' });
}

export function renderPreset({ profile, mode, route = '[]', hidden = '[]', toggles = {}, user = '测试玩家', summary, options, headerNoise } = {}) {
  const config = YAML.parse(readFileSync(resolve(root, 'index.yaml'), 'utf8'));
  if (profile && !profiles.includes(profile)) throw new Error(`Unknown model profile: ${profile}`);
  if (mode && !['main', 'extra'].includes(mode)) throw new Error(`Unknown variable mode: ${mode}`);
  const vars = { 路由激活规则: route, 路由隐藏规则: hidden };
  const noiseSettings = headerNoise ?? config.扩展字段.酒馆助手.脚本库.find(script => script.名称 === '【本格修仙】头部噪声')?.数据;
  // 预览固定同一种子便于比较；酒馆脚本在每次真实生成时更新 random 模式种子。
  const headerNoiseText = buildHeaderNoise(noiseSettings);
  const entries = [];
  for (const item of config.提示词) {
    let enabled = item.启用 !== false;
    const model = item.名称?.match(/^🔌 (.+)头部$/)?.[1];
    if (model && profile) enabled = model === profile;
    if (mode && /^🧭变量(?:主|额外)API/.test(item.名称)) enabled = item.名称.includes(mode === 'main' ? '主API' : '额外API');
    if (Object.hasOwn(toggles, item.名称)) enabled = toggles[item.名称];
    if (summary !== undefined && item.名称 === '📋 回复摘要') enabled = summary;
    if (options !== undefined && item.名称 === '🎯 行动选项') enabled = options;
    if (!enabled) continue;
    const marker = item.id && !item.文件 && item.内容 === undefined;
    entries.push({ name: item.名称 ?? item.id,
      role: { 系统: 'system', 用户: 'user', AI: 'assistant' }[item.角色] ?? 'system',
      depth: item.插入位置?.类型 === '聊天中' ? item.插入位置.深度 : undefined,
      marker: marker ? item.id : undefined,
      content: expandPresetMacros(readEntry(item), vars, user).replaceAll(HEADER_NOISE_MACRO, headerNoiseText),
    });
  }
  // ST expands macros during assembly; its template extension evaluates EJS later.
  for (const item of entries) item.content = ejs(item.content, vars);
  return { config, vars, entries };
}

export function assemblePreview(entries) {
  const messages = [], depth = entries.filter(e => e.depth !== undefined);
  for (const item of entries) {
    if (item.depth !== undefined) continue;
    if (item.marker === '聊天记录') {
      messages.push({ role: 'system', content: '〔深度9999：大总结占位〕' });
      for (const injection of [...depth].sort((a, b) => b.depth - a.depth)) {
        messages.push({ role: injection.role, content: injection.content });
        messages.push({ role: 'system', content: injection.depth === 900 ? '〔参考规则占位〕' : '〔当前状态与激活规则占位〕' });
      }
      messages.push({ role: 'assistant', content: '〔上一轮叙事占位〕' }, { role: 'user', content: '〔本轮玩家输入占位〕' });
    } else {
      messages.push({ role: item.role, content: item.marker ? `〔${item.marker}占位〕` : item.content });
    }
  }
  return processCultivationMessages(messages);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2), value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
  const alias = value('--profile');
  const profile = alias ? profiles.find(p => p.toLowerCase() === alias.toLowerCase()) : undefined;
  if (alias && !profile) throw new Error('--profile: gemini | claude | glm | deepseek');
  const result = renderPreset({ profile, mode: value('--mode'), hidden: value('--nsfw') === 'off' ? JSON.stringify(['[mvu_plot][NSFW]基础指导']) : '[]', user: value('--user'), route: args.includes('--advance') ? '["[时间推进规则]"]' : '[]' });
  const messages = assemblePreview(result.entries);
  const lines = ['# 预设效果预览', '', `模型：${result.vars.ai模型}；变量：${result.vars.变量模式}；模式：${args.includes('--advance') ? '世界推进' : '普通回合'}。`, '', '这是本地模板与分区检查。世界书、状态与历史使用明确占位，不代表酒馆真实请求。', ''];
  for (const [index, message] of messages.entries()) {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content, null, 2);
    const fence = '`'.repeat(Math.max(3, ...[...content.matchAll(/`+/g)].map(m => m[0].length + 1)));
    lines.push(`## ${index + 1}. ${message.role}`, '', fence + 'text', content, fence, '');
  }
  const output = resolve(root, value('--out') ?? '预设效果预览.md');
  writeFileSync(output, lines.join('\n').replace(/[ \t]+$/gm, ''));
  console.log(`Preview: ${messages.length} messages → ${output}`);
}
