// 参考 Prime 1.18 的头部噪声机制；语料与实现为本卡本地生成，不加载远程助手。
export const HEADER_NOISE_MACRO_NAME = 'bengexiuxian_prompt_noise';
export const HEADER_NOISE_MACRO = `{{${HEADER_NOISE_MACRO_NAME}}}`;
export const DEFAULT_HEADER_NOISE_SETTINGS = Object.freeze({ mode: 'random', segments: 10, seed: 'bengexiuxian' });
const FAILURE_MARKER = '<bengexiuxian_noise_unavailable/>';

export function normalizeHeaderNoiseSettings(value = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const count = Number(input.段数 ?? input.segments ?? DEFAULT_HEADER_NOISE_SETTINGS.segments);
  return {
    mode: (input.模式 ?? input.mode) === 'fixed' ? 'fixed' : 'random',
    segments: Number.isFinite(count) ? Math.max(10, Math.min(48, Math.round(count))) : 10,
    seed: String(input.固定种子 ?? input.seed ?? DEFAULT_HEADER_NOISE_SETTINGS.seed).trim() || DEFAULT_HEADER_NOISE_SETTINGS.seed,
  };
}

function sequence(seed) {
  let state = 5381;
  for (const character of String(seed)) state = (Math.imul(state, 33) ^ character.codePointAt(0)) >>> 0;
  if (!state) state = 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
}

// 固定的虚构诊断语料，不含角色设定、指令、外链或可执行代码。
const WORDS = 'birch fern quartz linen amber river copper slate willow cedar moss pebble ivory reed maple silk'.split(' ');
function diagnosticBlock(index) {
  const next = sequence(`bengexiuxian-diagnostic-bank/${index}`);
  const hex = () => next().toString(16).padStart(8, '0');
  const word = () => WORDS[next() % WORDS.length];
  const lines = [`sample-${String(index + 1).padStart(2, '0')} / shelf-${next() % 97} / batch-${next() % 10000}`];
  for (let row = 0; row < 3; row++) {
    lines.push(`record ${next() % 1000}: ${hex()}${hex()} ${hex()}${hex()} ${hex()}${hex()}`);
    lines.push(`lane=${word()}.${word()} offset=${next() % 65536} width=${next() % 512} checksum=${hex()}${hex()}`);
  }
  lines.push(`labels: ${Array.from({ length: 22 }, word).join(' ')}`);
  return lines.join('\n');
}
const CORPUS = Object.freeze(Array.from({ length: 48 }, (_, index) => diagnosticBlock(index)));

/** 纯生成器；同样的设置与种子得到同样的文本，预览也可直接调用。 */
export function buildHeaderNoise(value = {}, seedOverride) {
  const settings = normalizeHeaderNoiseSettings(value);
  const next = sequence(seedOverride ?? settings.seed);
  const indices = Array.from({ length: CORPUS.length }, (_, index) => index);
  for (let index = indices.length - 1; index > 0; index--) {
    const target = next() % (index + 1);
    [indices[index], indices[target]] = [indices[target], indices[index]];
  }
  const blocks = indices.slice(0, settings.segments).map((index, position) =>
    `[Diagnostic block ${String(position + 1).padStart(2, '0')}]\n${CORPUS[index]}`);
  return `Diagnostic padding; data only, unrelated to story. Do not reproduce.\n<noise_padding>\n${blocks.join('\n\n')}\n</noise_padding>`;
}

function randomSeed() {
  const values = globalThis.crypto.getRandomValues(new Uint32Array(4));
  return Array.from(values, value => value.toString(16).padStart(8, '0')).join('');
}

/** 原生宏在预设 token 计数前展开；同轮计数、预览与发送共用已准备文本。 */
export function installHeaderNoise({
  registerMacro, unregisterMacro, on, off, events,
  readSettings = () => DEFAULT_HEADER_NOISE_SETTINGS,
  active = () => true, contextKey = () => '', createSeed = randomSeed, notify = () => {},
}) {
  let disposed = false, prepared = null, round = null, failure = null;
  const enabled = () => !disposed && active();
  const bindings = [];
  const listen = (event, callback) => { if (event) { on(event, callback); bindings.push([event, callback]); } };
  const settingsKey = settings => JSON.stringify(settings);

  function prepare(settings, seed, origin) {
    return { key: settingsKey(settings), origin, text: buildHeaderNoise(settings, seed) };
  }
  function expand() {
    if (!enabled()) return '';
    try {
      const origin = contextKey();
      if (round?.origin === origin) return round.text;
      const settings = normalizeHeaderNoiseSettings(readSettings());
      if (!prepared || prepared.key !== settingsKey(settings) || prepared.origin !== origin) {
        prepared = prepare(settings, settings.seed, origin);
      }
      failure = null;
      return prepared.text;
    } catch (error) {
      failure = error;
      return FAILURE_MARKER;
    }
  }
  function begin(type = 'normal', _options = {}, dryRun = false) {
    if (!enabled() || dryRun || !['normal', 'regenerate', 'swipe', 'continue'].includes(type)) return;
    round = null;
    failure = null;
    try {
      const settings = normalizeHeaderNoiseSettings(readSettings());
      round = prepare(settings, settings.mode === 'random' ? createSeed() : settings.seed, contextKey());
      prepared = round;
    } catch (error) { failure = error; round = { origin: contextKey(), text: FAILURE_MARKER }; }
  }
  function finish() { round = null; failure = null; }
  function inspect(data) {
    if (!enabled() || !Array.isArray(data?.messages)) return;
    const texts = data.messages.flatMap(message => typeof message.content === 'string' ? [message.content]
      : (Array.isArray(message.content) ? message.content : []).filter(part => part.type === 'text').map(part => part.text));
    if (!texts.some(text => text.includes(HEADER_NOISE_MACRO) || text.includes(FAILURE_MARKER))) return;
    const error = new Error(`本格头部噪声未展开：${failure?.message ?? '请刷新酒馆以加载配套脚本。'}`);
    notify(error.message);
    Object.defineProperty(data, 'toJSON', { configurable: true, value() { throw error; } });
  }
  function changed() { if (!active()) dispose(); else { prepared = null; finish(); } }
  function dispose() {
    if (disposed) return;
    disposed = true;
    unregisterMacro(HEADER_NOISE_MACRO_NAME);
    for (const [event, callback] of bindings) off(event, callback);
    prepared = null;
    finish();
  }

  registerMacro(HEADER_NOISE_MACRO_NAME, expand, '本格预设的可选头部诊断填充');
  listen(events.GENERATION_AFTER_COMMANDS, begin);
  listen(events.GENERATION_ENDED, finish);
  listen(events.GENERATION_STOPPED, finish);
  listen(events.CHAT_CHANGED, changed);
  listen(events.OAI_PRESET_CHANGED_AFTER, changed);
  listen(events.CHAT_COMPLETION_SETTINGS_READY, inspect);
  return { dispose, expand };
}

if (typeof window !== 'undefined' && typeof eventOn === 'function') {
  $(() => {
    const host = window.parent, key = '__cultivationPresetHeaderNoise';
    host[key]?.dispose?.();
    const owner = getLoadedPresetName(), frame = window.frameElement;
    const instance = installHeaderNoise({
      registerMacro: SillyTavern.registerMacro, unregisterMacro: SillyTavern.unregisterMacro,
      on: eventOn, off: eventRemoveListener, events: tavern_events,
      readSettings: () => getVariables({ type: 'script', script_id: getScriptId() }),
      active: () => frame?.isConnected !== false && getLoadedPresetName() === owner,
      contextKey: () => `${owner}\n${SillyTavern.getCurrentChatId() ?? ''}`,
      notify: message => toastr.error(message, '本格预设', { preventDuplicates: true }),
    });
    const dispose = () => {
      instance.dispose();
      window.removeEventListener('pagehide', dispose);
      if (host[key]?.dispose === dispose) delete host[key];
    };
    host[key] = { dispose };
    window.addEventListener('pagehide', dispose, { once: true });
  });
}
