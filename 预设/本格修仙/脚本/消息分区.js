// 将深度注入放回对应资料区；历史文本的过滤由酒馆原生预设正则负责。
export const MESSAGE_MARKERS = Object.freeze({
  bodyStart: '<|本格_正文开始|>',
  historyStart: '<|本格_历史开始|>',
  depth900: '<|本格_深度900分界|>',
  depth2: '<|本格_深度2分界|>',
  historyEnd: '<|本格_历史结束|>',
  bodyEnd: '<|本格_正文结束|>',
});
export const MESSAGE_SLOTS = Object.freeze({
  memory: '<|本格_记忆区|>',
  reference: '<|本格_参考区|>',
  rules: '<|本格_运行规则区|>',
});
const markers = Object.values(MESSAGE_MARKERS);
const markerPattern = new RegExp(markers.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
const labels = ['正文开始', '历史开始', '深度 900', '深度 2', '历史结束', '正文结束'];

function contentParts(message) {
  if (typeof message.content === 'string') return [{ type: 'text', text: message.content }];
  return Array.isArray(message.content) ? message.content : [];
}
function plainText(part) {
  return part?.type === 'text' && typeof part.text === 'string' && Object.keys(part).every(key => key === 'type' || key === 'text');
}
function append(parts, part) {
  if (plainText(part) && plainText(parts.at(-1))) parts.at(-1).text += part.text;
  else parts.push(structuredClone(part));
}
function clean(parts) {
  const result = [];
  for (const part of parts) append(result, part);
  if (plainText(result[0])) result[0].text = result[0].text.trimStart();
  if (plainText(result.at(-1))) result.at(-1).text = result.at(-1).text.trimEnd();
  return result.filter(part => !plainText(part) || part.text !== '');
}
function join(groups) {
  const result = [];
  for (const group of groups) {
    const parts = clean(group);
    if (!parts.length) continue;
    if (result.length) append(result, { type: 'text', text: '\n\n' });
    for (const part of parts) append(result, part);
  }
  return clean(result);
}
function asContent(parts) {
  return parts.every(plainText) ? parts.map(part => part.text).join('') : parts;
}
// Collapse empty template branches after assembly; preserve fenced examples and indentation.
export function compactPromptWhitespace(text) {
  let fence = null, blank = false;
  const lines = [];
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      lines.push(line);
      if (match && match[1][0] === fence[0] && match[1].length >= fence.length && !match[2].trim()) fence = null;
      blank = false;
    } else if (match) {
      fence = match[1];
      lines.push(line);
      blank = false;
    } else if (!line.trim()) {
      if (!blank) lines.push('');
      blank = true;
    } else {
      lines.push(line);
      blank = false;
    }
  }
  return lines.join('\n');
}
function compactParts(parts) {
  return parts.map(part => part.type === 'text' ? { ...part, text: compactPromptWhitespace(part.text) } : part);
}
// A dry-run preview can partition before EJS runs. Clean its later output without
// requiring consumed transport markers or rebuilding roles a second time.
export function compactFinalizedMessages(messages) {
  if (!Array.isArray(messages)) return null;
  let found = false;
  const result = messages.map(message => {
    const parts = contentParts(message);
    const text = parts.filter(part => part.type === 'text').map(part => part.text).join('');
    if (!text.includes('<output_contract>') || !text.includes('<writing_guidance>') || !text.includes('<output_template>')) return structuredClone(message);
    const boundaries = [...text.matchAll(/^<\/?historical_record>[ \t]*$/gm)];
    if (boundaries.length !== 2 || boundaries[0][0].trim() !== '<historical_record>' || boundaries[1][0].trim() !== '</historical_record>') return structuredClone(message);
    found = true;
    let inHistory = false;
    const cleaned = parts.map(part => {
      if (part.type !== 'text') return structuredClone(part);
      const chunks = part.text.split(/(^<\/?historical_record>[ \t]*$)/gm);
      const output = chunks.map(chunk => {
        if (chunk.trim() === '<historical_record>') { inHistory = true; return chunk; }
        if (chunk.trim() === '</historical_record>') { inHistory = false; return chunk; }
        return inHistory ? chunk : compactPromptWhitespace(chunk);
      }).join('');
      return { ...structuredClone(part), text: output };
    });
    return { ...structuredClone(message), content: typeof message.content === 'string' ? cleaned[0].text : cleaned };
  });
  return found ? result : null;
}
function fragment(section, source, index, part) {
  let record = section.at(-1);
  if (record?.index !== index) section.push(record = { source, index, parts: [] });
  append(record.parts, part);
}
function replaceSlot(parts, slot, replacement) {
  let count = 0;
  const result = [];
  for (const part of parts) {
    if (part.type !== 'text' || !part.text.includes(slot)) { append(result, part); continue; }
    part.text.split(slot).forEach((text, index) => {
      if (index) {
        count++;
        for (const inserted of replacement) append(result, inserted);
      }
      append(result, { ...part, text });
    });
  }
  if (count !== 1) throw new Error(`本格消息分区：${slot} 应出现一次，请恢复对应结构条目。`);
  return result;
}
function outerMessages(records) {
  return records.flatMap(record => {
    const parts = clean(record.parts);
    return parts.length ? [{ ...structuredClone(record.source), content: asContent(compactParts(parts)) }] : [];
  });
}

/** 返回新消息数组；没有本格结构标记的辅助 API 请求返回 null，输入对象不变。 */
export function processCultivationMessages(messages) {
  if (!Array.isArray(messages)) return null;
  const structure = [...markers, ...Object.values(MESSAGE_SLOTS)];
  if (!messages.some(message => contentParts(message).some(part => part.type === 'text' && structure.some(marker => part.text.includes(marker))))) return null;

  // 头部、历史前正文、>900、3~900、0~2、历史后正文、尾部。
  const sections = Array.from({ length: 7 }, () => []);
  let position = 0;
  messages.forEach((message, index) => {
    for (const part of contentParts(message)) {
      if (part.type !== 'text') { fragment(sections[position], message, index, part); continue; }
      let offset = 0;
      for (const match of part.text.matchAll(markerPattern)) {
        if (match.index > offset) fragment(sections[position], message, index, { ...part, text: part.text.slice(offset, match.index) });
        if (markers[position] !== match[0]) throw new Error(`本格消息分区：边界重复或顺序错误，应先出现「${labels[position] ?? '处理结束'}」。`);
        position++;
        offset = match.index + match[0].length;
      }
      if (offset < part.text.length) fragment(sections[position], message, index, { ...part, text: part.text.slice(offset) });
    }
  });
  if (position !== markers.length) throw new Error(`本格消息分区：缺少「${labels[position]}」边界，请检查结构条目和上下文容量。`);

  const [head, before, high, middle, low, after, tail] = sections;
  const history = [], injections = [];
  for (const section of [high, middle, low]) {
    const system = [];
    for (const record of section) {
      if (record.source.role === 'system') { system.push(record.parts); continue; }
      if (!['user', 'assistant'].includes(record.source.role) || record.source.tool_calls) {
        throw new Error('本格消息分区：正文历史包含工具消息，无法按剧情记录组装。');
      }
      const parts = clean(record.parts);
      if (parts.length) history.push({ ...record, parts });
    }
    injections.push(join(system));
  }
  const latestUser = history.findLast(record => record.source.role === 'user');
  const historyParts = history.map(record => {
    const latest = record === latestUser;
    const prefix = latest ? 'Participant:<Participant_input>\n' : record.source.role === 'user' ? 'Participant: ' : 'Recorder: ';
    return [{ type: 'text', text: prefix }, ...record.parts, ...(latest ? [{ type: 'text', text: '\n</Participant_input>' }] : [])];
  });
  let beforeParts = join(before.map(record => record.parts));
  beforeParts = replaceSlot(beforeParts, MESSAGE_SLOTS.memory, injections[0]);
  beforeParts = replaceSlot(beforeParts, MESSAGE_SLOTS.reference, injections[1]);
  const afterParts = replaceSlot(join(after.map(record => record.parts)), MESSAGE_SLOTS.rules, injections[2]);
  return [...outerMessages(head), { role: 'user', content: asContent(join([compactParts(beforeParts), ...historyParts, compactParts(afterParts)])) }, ...outerMessages(tail)];
}

/** 在 EJS 展开后组装正文；结构错误通过请求序列化阻止发送。 */
export function installMessageProcessing({ on, last = on, off, events, active = () => true, notify = () => {} }) {
  let disposed = false;
  const enabled = () => !disposed && active();
  const onReady = data => {
    if (!enabled()) return;
    try {
      const result = processCultivationMessages(data?.messages) ?? compactFinalizedMessages(data?.messages);
      if (result) data.messages.splice(0, data.messages.length, ...result);
    } catch (error) {
      notify(error.message);
      // 酒馆事件会吞回调异常；此处在 fetch 的 JSON.stringify 前中止当前请求。
      Object.defineProperty(data, 'toJSON', { configurable: true, value() { throw error; } });
    }
  };
  const onPreview = (data, dryRun) => {
    if (!enabled() || dryRun !== true) return;
    try {
      const result = processCultivationMessages(data?.prompt) ?? compactFinalizedMessages(data?.prompt);
      if (result) data.prompt.splice(0, data.prompt.length, ...result);
    } catch (error) { notify(error.message); }
  };
  // 路由先处理 GENERATION_AFTER_COMMANDS；EJS 在 SETTINGS_READY 处理原消息角色。
  const onBefore = () => {
    if (!enabled()) return;
    last(events.GENERATE_AFTER_DATA, onPreview);
    last(events.CHAT_COMPLETION_SETTINGS_READY, onReady);
  };
  const onPreset = () => { if (!active()) dispose(); };
  function dispose() {
    if (disposed) return;
    disposed = true;
    off(events.GENERATE_AFTER_DATA, onPreview);
    off(events.CHAT_COMPLETION_SETTINGS_READY, onReady);
    off(events.GENERATION_AFTER_COMMANDS, onBefore);
    off(events.OAI_PRESET_CHANGED_AFTER, onPreset);
  }
  last(events.GENERATE_AFTER_DATA, onPreview);
  last(events.CHAT_COMPLETION_SETTINGS_READY, onReady);
  on(events.GENERATION_AFTER_COMMANDS, onBefore);
  on(events.OAI_PRESET_CHANGED_AFTER, onPreset);
  return { dispose };
}

if (typeof window !== 'undefined' && typeof eventOn === 'function') {
  $(() => {
    const host = window.parent, key = '__cultivationPresetMessageProcessor';
    host[key]?.dispose?.();
    const owner = getLoadedPresetName(), frame = window.frameElement;
    const instance = installMessageProcessing({
      on: eventOn, last: eventMakeLast, off: eventRemoveListener, events: tavern_events,
      active: () => frame?.isConnected !== false && getLoadedPresetName() === owner,
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
