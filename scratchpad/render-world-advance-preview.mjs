// Generate a read-only visual fixture from the real Vue component and body renderer.
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const require = createRequire(new URL('../../tavern_helper_template-main/package.json', import.meta.url));
const vue = require('vue');
const compiler = require('vue/compiler-sfc');
const ts = require('typescript');
const _ = require('lodash');
const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const time = { 年: 7200, 月: 4, 日: 7, 时辰: '午时' };
const entries = [
  { 标题: '临渊水乡 · 沿河丹市将开', 类别: '坊市集会', 难度: '炼气初期', 内容: '沿河坊市新添了几处丹药摊位，往来散修传言近日有炼丹师在此暂居。' },
  { 标题: '雨后青崖浮现灵矿踪迹，山民邀修士共同探查旧矿道深处的异响', 类别: '素材奇遇', 难度: '筑基初期', 内容: '据山民说，东土青崖雨后露出带灵纹的矿石。旧矿道有异响，前往者可先在村口询问向导。' },
];
const data = vue.reactive({ 时间: { ...time, 时辰: '未时' }, 传闻: { 上次世界推进时间点: time, 条目: Object.fromEntries(entries.map(({标题, ...entry}) => [标题, entry])) } });
const descriptor = compiler.parse(read('../../tavern_helper_template-main/src/修仙状态栏/pages/PageRumors.vue')).descriptor;
const script = compiler.compileScript(descriptor, { id: 'preview', inlineTemplate: true });
const compiled = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const ctx = { exports: {}, require: id => id === 'vue' ? vue : id.includes('composables') ? { activeTimelineEvents: vue.computed(() => entries) } : { useDataStore: () => ({ data }) } };
vm.runInNewContext(compiled, ctx);
const rumorHtml = await require('vue/server-renderer').renderToString(vue.createSSRApp(ctx.exports.default));
const body = read('../../tavern_helper_template-main/src/面板美化/正文美化.html');
function extractFunction(name) {
  const start = body.indexOf('function ' + name + '(');
  const ast = ts.createSourceFile('extract.js', body.slice(start), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  return ast.statements[0].getText(ast);
}
const names = ['parseTablePanel', '_isPersonHeader', '_parsePersonRow', '_groupPeople', '_classifyTimeSection', '_splitTimeRowFields', '_renderPersonRowsAsList', '_renderNewsList', 'renderTimeHtml'];
const renderer = { _ };
vm.createContext(renderer);
vm.runInContext(names.map(extractFunction).join('\n'), renderer);
const person = (name, event) => renderer.renderTimeHtml(renderer.parseTablePanel(`{人物推演}\n| ${name} (炼气中期 / 年龄24/寿命95) |\n| 区间: 7200年4月7日午时 至 未时 |\n| 事件链: ${event} |\n| 境界变化: 维持 |\n| 寿元变化: 维持 | 判定: 健在 |\n| 物品变动: 无 |`));
const panels = person('林清远', '照料药圃') + '<p>林清远推开药圃的小门，俯身拨开叶片检查根部。一个时辰里，他修整了两排支架，把未完成的记录留在案头。</p>' + person('顾听雨', '整理旧卷') + '<p>顾听雨将最后一卷书放回架上。窗外日影微移，她提笔给远方的故人写下一封尚未寄出的信。</p><p>镜头回到7200年4月7日未时的你。临渊水乡的茶仍温着，眼前的街道与离开视线前并无二致。</p>';
if ((panels.match(/time-person-vignette/g) || []).length !== 2) throw new Error('Expected two independent person panels');
const css = body.match(/<style[^>]*>([\s\S]*?)<\/style>/i)[1];
const statusCss = read('../../tavern_helper_template-main/src/修仙状态栏/styles.css');
const componentCss = descriptor.styles.map(s => s.content).join('\n');
const page = `<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>世界推进 · 桌面与手机预览</title><style>${css}\n${statusCss}\n${componentCss}\n:root{--xy-line-gold:#dfc899;--xy-ink:#3e382e;--xy-ink-mute:#867b68;--xy-gold-deep:#a98035;--xy-cinnabar:#a83835;--xy-paper-warm:#f6efdf;--xy-line:#dfd6c4;--xy-paper:#fcf8ef;--xy-font-body:'Noto Serif SC',serif;--rb-panel-bg:#fbf5e7;--rb-panel-accent:#ae8747;--rb-panel-text:#42372c}*{box-sizing:border-box}body{margin:0;background:#ede4cf;color:#42372c;padding:16px;font:16px/1.7 'Noto Serif SC',serif}main{max-width:1000px;margin:auto}h1{font-size:20px}h2{font-size:16px;margin:18px 0 8px}.preview-box{padding:16px;background:#fcf8ef;border:1px solid #dfc899;border-radius:14px}.preview-note{font-size:12px;color:#827662}.preview-box p{margin:14px 4px}.xy-page-rumors{display:block}</style><main><h1>世界推进</h1><p class="preview-note">源码渲染预览 · 示例数据 · 此页面不向酒馆发送消息</p><h2>传闻页</h2><div class="preview-box">${rumorHtml}</div><h2>逐人纪事</h2><div class="preview-box">${panels}</div></main></html>`;
const themeCss = read('../../tavern_helper_template-main/src/修仙状态栏/global.css');
fs.writeFileSync(new URL('./world-advance-preview.html', import.meta.url), page.replace('<html lang="zh">', '<html lang="zh" data-theme="light">').replace('<style>', '<style>' + themeCss));
console.log('Generated visual fixture from actual Vue and renderer; two person panels verified.');
