export interface CascadingConfig {
  parentLabel: string;
  childLabel: string;
  parentOptions: string[];
  childOptions: Record<string, string[]>;
}

/**
 * Parses options string in JSON format or human-friendly colon/newline format into a structured CascadingConfig.
 */
export function parseCascadingOptions(optionsStr: string | null | undefined): CascadingConfig {
  const defaultPortConfig: CascadingConfig = {
    parentLabel: 'Ana Port Grubu',
    childLabel: 'Port Numarası',
    parentOptions: ['1000', '2000', '3000'],
    childOptions: {
      '1000': ['1001', '1002', '1003'],
      '2000': ['2001', '2002', '2003'],
      '3000': ['3001', '3002', '3003'],
    },
  };

  if (!optionsStr || !optionsStr.trim()) {
    return defaultPortConfig;
  }

  const raw = optionsStr.trim();

  // 1. Try JSON format
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.parentOptions && parsed.childOptions) {
        return {
          parentLabel: parsed.parentLabel || 'Ana Port Grubu',
          childLabel: parsed.childLabel || 'Port Numarası',
          parentOptions: Array.isArray(parsed.parentOptions) ? parsed.parentOptions.map((x: unknown) => String(x).trim()) : [],
          childOptions: typeof parsed.childOptions === 'object' ? parsed.childOptions : {},
        };
      }
      // If object is simply { "1000": ["1001", "1002"], "2000": ["2001"] }
      const parentKeys = Object.keys(parsed);
      const childMap: Record<string, string[]> = {};
      for (const k of parentKeys) {
        if (Array.isArray(parsed[k])) {
          childMap[k] = parsed[k].map((x: unknown) => String(x).trim());
        }
      }
      return {
        parentLabel: 'Ana Port Grubu',
        childLabel: 'Port Numarası',
        parentOptions: parentKeys.length > 0 ? parentKeys : defaultPortConfig.parentOptions,
        childOptions: parentKeys.length > 0 ? childMap : defaultPortConfig.childOptions,
      };
    } catch {
      // Fallback to text parsing
    }
  }

  // 2. Comma-separated list without colons: "1000, 2000, 3000"
  if (!raw.includes(':') && !raw.includes('->') && raw.includes(',')) {
    const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
    const parentOptions: string[] = [];
    const childOptions: Record<string, string[]> = {};

    for (const token of tokens) {
      parentOptions.push(token);
      const num = parseInt(token, 10);
      if (!isNaN(num) && num > 0) {
        childOptions[token] = [`${num + 1}`, `${num + 2}`, `${num + 3}`];
      } else {
        childOptions[token] = [`${token}-1`, `${token}-2`, `${token}-3`];
      }
    }

    return {
      parentLabel: 'Ana Port Grubu',
      childLabel: 'Port Numarası',
      parentOptions,
      childOptions,
    };
  }

  // 3. Line-based format: "1000: 1001, 1002 \n 2000: 2001, 2002" or "1000 -> 1001, 1002"
  const lines = raw.split(/\r?\n|;/).map((l) => l.trim()).filter(Boolean);
  const parentOptions: string[] = [];
  const childOptions: Record<string, string[]> = {};

  for (const line of lines) {
    const separatorIdx = line.indexOf(':') !== -1 ? line.indexOf(':') : line.indexOf('->');
    if (separatorIdx !== -1) {
      const isArrow = line.indexOf('->') !== -1 && (line.indexOf(':') === -1 || line.indexOf('->') < line.indexOf(':'));
      const sepLen = isArrow ? 2 : 1;
      const parent = line.substring(0, separatorIdx).trim();
      const childrenStr = line.substring(separatorIdx + sepLen).trim();
      const children = childrenStr
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      if (parent) {
        if (!parentOptions.includes(parent)) {
          parentOptions.push(parent);
        }
        childOptions[parent] = children;
      }
    } else {
      // Single token without explicit children
      if (!parentOptions.includes(line)) {
        parentOptions.push(line);
      }
      const num = parseInt(line, 10);
      if (!isNaN(num) && num > 0) {
        childOptions[line] = [`${num + 1}`, `${num + 2}`, `${num + 3}`];
      } else {
        childOptions[line] = [];
      }
    }
  }

  return {
    parentLabel: 'Ana Port Grubu',
    childLabel: 'Port Numarası',
    parentOptions: parentOptions.length > 0 ? parentOptions : defaultPortConfig.parentOptions,
    childOptions: Object.keys(childOptions).length > 0 ? childOptions : defaultPortConfig.childOptions,
  };
}

/**
 * Resolves current parent and child selected values from a saved fieldValue.
 * Supports: "1000 > 1002", "1000: 1002", direct child "1002", or parent "1000".
 */
export function resolveCascadingValues(
  fieldValue: string | null | undefined,
  config: CascadingConfig
): { parentVal: string; childVal: string } {
  if (!fieldValue || !fieldValue.trim()) {
    return { parentVal: '', childVal: '' };
  }
  const val = fieldValue.trim();

  // Case A: "1000 > 1002"
  if (val.includes(' > ')) {
    const parts = val.split(' > ');
    return { parentVal: parts[0].trim(), childVal: parts[1]?.trim() || '' };
  }

  // Case B: "1000: 1002"
  if (val.includes(':')) {
    const parts = val.split(':');
    return { parentVal: parts[0].trim(), childVal: parts[1]?.trim() || '' };
  }

  // Case C: direct child match in childOptions (e.g. "1002")
  for (const [parent, children] of Object.entries(config.childOptions)) {
    if (children.includes(val)) {
      return { parentVal: parent, childVal: val };
    }
  }

  // Case D: matches a parent option directly
  if (config.parentOptions.includes(val)) {
    return { parentVal: val, childVal: '' };
  }

  return { parentVal: '', childVal: val };
}
