#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROTOCOL = 'crr-sync-v1';
const PORT = 6622;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(SCRIPT_DIR, 'router_sync.config.json');
const DEFAULT_ORIGINS = ['http://localhost:8000', 'http://127.0.0.1:8000'];

function fail(message) {
  console.error(`错误：${message}`);
  process.exitCode = 1;
}

function printHelp() {
  console.log(`规则路由配置同步

用法：
  node router_sync.mjs list
  node router_sync.mjs pull <预设名称>
  node router_sync.mjs push <预设名称> [--force]

命令：
  list            列出 router_sync.config.json 中配置的预设
  pull            将当前 SillyTavern 中的插件配置拉取到本地 JSON
  push            将本地 JSON 合并写入 SillyTavern，保留 API Key
  push --force    文件中出现的世界书配置完整替换酒馆中的同名配置

执行 pull / push 时，请保持 SillyTavern 页面已打开且规则路由插件已启用。`);
}

async function loadSyncConfig() {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(CONFIG_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`无法读取 ${CONFIG_PATH}：${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('同步配置必须是 JSON 对象');
  if (!parsed.presets || typeof parsed.presets !== 'object' || Array.isArray(parsed.presets)) {
    throw new Error('同步配置缺少 presets 对象');
  }
  return {
    timeoutMs:
      typeof parsed.timeoutMs === 'number' && Number.isFinite(parsed.timeoutMs)
        ? Math.min(120_000, Math.max(5_000, Math.trunc(parsed.timeoutMs)))
        : 30_000,
    allowedOrigins: Array.isArray(parsed.allowedOrigins)
      ? parsed.allowedOrigins.filter((value) => typeof value === 'string')
      : DEFAULT_ORIGINS,
    presets: parsed.presets,
  };
}

function resolvePreset(config, name) {
  const configuredPath = config.presets[name];
  if (typeof configuredPath !== 'string' || !configuredPath.trim()) {
    const available = Object.keys(config.presets);
    throw new Error(`预设“${name}”不存在。可用预设：${available.length ? available.join('、') : '（无）'}`);
  }
  return isAbsolute(configuredPath) ? configuredPath : resolve(SCRIPT_DIR, configuredPath);
}

function validatePresetData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.__crr_export !== true) {
    throw new Error('本地文件不是有效的规则路由配置');
  }
  if (data.global?.api && Object.hasOwn(data.global.api, 'key')) {
    throw new Error('安全检查失败：同步文件中不得包含 API Key');
  }
  return data;
}

function parseMessage(raw) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    throw new Error('插件返回了无法解析的 JSON');
  }
}

async function runBridge({ command, mode, data, timeoutMs, allowedOrigins }) {
  let settled = false;
  let timeoutId = null;
  const requestId = randomUUID();
  const commandPayload = { protocol: PROTOCOL, requestId, command, mode, data };

  const isAllowedOrigin = (origin) => !origin || allowedOrigins.includes(origin);
  const setCorsHeaders = (request, response) => {
    const origin = request.headers.origin || '';
    if (origin && isAllowedOrigin(origin)) response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Cache-Control', 'no-store');
  };

  let resolveResult;
  let rejectResult;
  const resultPromise = new Promise((resolvePromise, rejectPromise) => {
    resolveResult = resolvePromise;
    rejectResult = rejectPromise;
  });
  const finish = (error, result) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeoutId);
    if (error) rejectResult(error);
    else resolveResult(result);
  };

  const server = createServer((request, response) => {
    const origin = request.headers.origin || '';
    if (!isAllowedOrigin(origin)) {
      response.writeHead(403);
      response.end();
      return;
    }
    setCorsHeaders(request, response);
    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (request.method === 'GET' && request.url === '/health') {
      response.end(JSON.stringify({ ok: true, protocol: PROTOCOL }));
      return;
    }
    if (request.method === 'GET' && request.url === '/command') {
      response.end(JSON.stringify(commandPayload));
      return;
    }
    if (request.method === 'POST' && request.url === '/result') {
      const chunks = [];
      let size = 0;
      request.on('data', (chunk) => {
        size += chunk.length;
        if (size > 16 * 1024 * 1024) request.destroy(new Error('同步响应超过 16MB 限制'));
        else chunks.push(chunk);
      });
      request.on('error', (error) => finish(error));
      request.on('end', () => {
        try {
          const message = parseMessage(Buffer.concat(chunks));
          if (message.protocol !== PROTOCOL || message.requestId !== requestId || message.type !== 'result') {
            throw new Error('插件返回的同步响应不匹配当前请求');
          }
          if (!message.ok) throw new Error(message.error || '插件拒绝了同步请求');
          response.end(JSON.stringify({ ok: true }));
          finish(null, message);
        } catch (error) {
          response.writeHead(400);
          response.end(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
          finish(error);
        }
      });
      return;
    }
    response.writeHead(404);
    response.end(JSON.stringify({ ok: false, error: 'Not Found' }));
  });

  timeoutId = setTimeout(
    () => finish(new Error(`等待 SillyTavern 连接超时（${Math.round(timeoutMs / 1000)} 秒）`)),
    timeoutMs,
  );

  try {
    await new Promise((resolveListen, rejectListen) => {
      const onError = (error) => {
        server.off('listening', onListening);
        rejectListen(error);
      };
      const onListening = () => {
        server.off('error', onError);
        resolveListen();
      };
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(PORT, '127.0.0.1');
    });
  } catch (error) {
    settled = true;
    clearTimeout(timeoutId);
    throw error;
  }
  console.log(`本地同步服务已启动：127.0.0.1:${PORT}，正在等待 SillyTavern…`);

  try {
    return await resultPromise;
  } finally {
    await new Promise((resolveClose) => {
      if (!server.listening) {
        resolveClose();
        return;
      }
      server.close(resolveClose);
      setTimeout(resolveClose, 500).unref();
    });
  }
}

async function main() {
  const [command, presetName, ...flags] = process.argv.slice(2);
  if (!command || ['help', '--help', '-h'].includes(command)) {
    printHelp();
    return;
  }

  const config = await loadSyncConfig();
  if (command === 'list') {
    const entries = Object.entries(config.presets);
    if (!entries.length) {
      console.log('尚未配置任何预设。');
      return;
    }
    console.log('可用的规则路由预设：');
    for (const [name, path] of entries) console.log(`  ${name} -> ${path}`);
    return;
  }
  if (!['pull', 'push'].includes(command)) throw new Error(`未知命令“${command}”`);
  if (!presetName) throw new Error(`${command} 命令需要提供预设名称`);
  const unknownFlags = flags.filter((flag) => flag !== '--force' && flag !== '-f');
  if (unknownFlags.length) throw new Error(`未知参数：${unknownFlags.join(' ')}`);
  if (command === 'pull' && flags.length) throw new Error('pull 命令不支持 --force');

  const filePath = resolvePreset(config, presetName);
  if (command === 'pull') {
    const response = await runBridge({
      command: 'pull',
      mode: 'merge',
      data: null,
      timeoutMs: config.timeoutMs,
      allowedOrigins: config.allowedOrigins,
    });
    const pulled = validatePresetData(response.data);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, `${JSON.stringify(pulled, null, 2)}\n`, 'utf8');
    console.log(`Pull 完成：${presetName}`);
    console.log(`已写入：${filePath}`);
    console.log('安全检查：配置文件不含 API Key。');
    return;
  }

  let localData;
  try {
    localData = validatePresetData(JSON.parse(await readFile(filePath, 'utf8')));
  } catch (error) {
    throw new Error(`无法读取预设“${presetName}”：${error instanceof Error ? error.message : String(error)}`);
  }
  const force = flags.includes('--force') || flags.includes('-f');
  const response = await runBridge({
    command: 'push',
    mode: force ? 'replace' : 'merge',
    data: localData,
    timeoutMs: config.timeoutMs,
    allowedOrigins: config.allowedOrigins,
  });
  console.log(`Push 完成：${presetName}${force ? '（强制替换文件中包含的世界书配置）' : '（合并）'}`);
  if (response.summary) {
    console.log(`已应用：${response.summary.books} 本世界书 / ${response.summary.rules} 条规则`);
  }
  console.log('本机 API Key 已保留。');
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
