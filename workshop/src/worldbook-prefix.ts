import { InputError } from './validation';

export type WorldbookCategory = '角色' | '事件' | '扩展';

export interface DlcRelations {
  exclusions: string[];
  replacements: string[];
  prerequisites: string[];
}

export interface DlcEntryName {
  category: WorldbookCategory;
  label: string;
  dlcKey: string;
  relations: DlcRelations;
}

const BASE_PATTERN = /^\[DLC\]\[(角色|事件|扩展)\]\[([^\]]+)\]/u;
const RELATION_PATTERN = /^\[([!><])([^\]]+)\]/u;

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function parseDlcEntryName(name: string): DlcEntryName {
  const base = name.match(BASE_PATTERN);
  if (!base) throw new InputError(`条目“${name.slice(0, 80)}”不符合 [DLC][类别][名称] 命名格式`);
  const category = base[1] as WorldbookCategory;
  const label = base[2]?.trim() ?? '';
  if (!label || label.length > 80) throw new InputError('DLC 名称必须为 1～80 字');
  const dlcKey = `[DLC][${category}][${label}]`;
  const relations: DlcRelations = { exclusions: [], replacements: [], prerequisites: [] };
  let rest = name.slice(base[0].length);
  while (rest.startsWith('[')) {
    const relation = rest.match(RELATION_PATTERN);
    if (!relation) throw new InputError(`条目“${name.slice(0, 80)}”在 DLC 名称后包含无效的关系标记`);
    const target = relation[2]?.trim() ?? '';
    if (!target || target.length > 80) throw new InputError('DLC 关系目标必须为 1～80 字');
    if (relation[1] === '!') relations.exclusions.push(target);
    if (relation[1] === '>') relations.replacements.push(target);
    if (relation[1] === '<') relations.prerequisites.push(target);
    rest = rest.slice(relation[0].length);
  }
  relations.exclusions = unique(relations.exclusions);
  relations.replacements = unique(relations.replacements);
  relations.prerequisites = unique(relations.prerequisites);
  return { category, label, dlcKey, relations };
}

export function validateWorldbookPayload(bytes: Uint8Array): {
  name: string;
  category: WorldbookCategory;
  dlcKey: string;
  relations: DlcRelations;
  entryCount: number;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new InputError('世界书文件不是有效的 UTF-8 JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new InputError('世界书文件结构无效');
  const entriesValue = (parsed as { entries?: unknown }).entries;
  const entries = Array.isArray(entriesValue)
    ? entriesValue
    : entriesValue && typeof entriesValue === 'object'
      ? Object.values(entriesValue)
      : [];
  if (entries.length < 1 || entries.length > 500) throw new InputError('世界书包必须包含 1～500 个条目');

  let identity: DlcEntryName | undefined;
  const relations: DlcRelations = { exclusions: [], replacements: [], prerequisites: [] };
  for (const [index, value] of entries.entries()) {
    if (!value || typeof value !== 'object') throw new InputError(`第 ${index + 1} 个世界书条目结构无效`);
    const rawName = (value as { comment?: unknown; name?: unknown }).comment ??
      (value as { name?: unknown }).name;
    if (typeof rawName !== 'string' || !rawName.trim()) throw new InputError(`第 ${index + 1} 个条目缺少名称`);
    const current = parseDlcEntryName(rawName.trim());
    if (!identity) identity = current;
    if (current.dlcKey !== identity.dlcKey) {
      throw new InputError(`世界书包只能包含同一组条目：期望 ${identity.dlcKey}，但发现 ${current.dlcKey}`);
    }
    relations.exclusions.push(...current.relations.exclusions);
    relations.replacements.push(...current.relations.replacements);
    relations.prerequisites.push(...current.relations.prerequisites);
  }
  if (!identity) throw new InputError('世界书包没有有效条目');
  relations.exclusions = unique(relations.exclusions);
  relations.replacements = unique(relations.replacements);
  relations.prerequisites = unique(relations.prerequisites);
  return {
    name: identity.label,
    category: identity.category,
    dlcKey: identity.dlcKey,
    relations,
    entryCount: entries.length,
  };
}
