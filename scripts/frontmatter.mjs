/**
 * A deliberately small YAML-frontmatter reader.
 *
 * It understands exactly the subset schema/policy.schema.json allows:
 *   key: scalar
 *   key: [a, b, c]
 *   key:
 *     - a
 *     - b
 *
 * Anything else is an error rather than a guess. A policy repo is better served
 * by a parser that refuses unfamiliar input than by one that silently
 * misreads it — the graph is only as trustworthy as the frontmatter.
 */

const DELIMITER = '---';

export class FrontmatterError extends Error {
  constructor(message, { file, line }) {
    super(`${file}:${line} ${message}`);
    this.name = 'FrontmatterError';
    this.file = file;
    this.line = line;
  }
}

/** Strip an optional wrapping pair of single or double quotes. */
function unquote(value) {
  const quoted = /^(["'])(.*)\1$/.exec(value);
  return quoted ? quoted[2] : value;
}

function parseInlineList(raw, ctx) {
  const inner = raw.slice(1, -1).trim();
  if (inner === '') return [];
  return inner.split(',').map((item) => {
    const value = unquote(item.trim());
    if (value === '') {
      throw new FrontmatterError('empty item in inline list', ctx);
    }
    return value;
  });
}

/**
 * @returns {{ data: Record<string, string|string[]>, body: string }}
 */
export function parseFrontmatter(source, file = '<unknown>') {
  const lines = source.split('\n');

  if (lines[0].trim() !== DELIMITER) {
    throw new FrontmatterError(`expected frontmatter to open with "${DELIMITER}"`, { file, line: 1 });
  }

  const closing = lines.indexOf(DELIMITER, 1);
  if (closing === -1) {
    throw new FrontmatterError(`unterminated frontmatter — no closing "${DELIMITER}"`, { file, line: 1 });
  }

  const data = {};
  let openListKey = null;

  for (let i = 1; i < closing; i++) {
    const raw = lines[i];
    const lineNo = i + 1;
    const ctx = { file, line: lineNo };
    const trimmed = raw.trim();

    if (trimmed === '' || trimmed.startsWith('#')) continue;

    // Continuation of a block list opened by a previous "key:" line.
    if (trimmed.startsWith('- ')) {
      if (openListKey === null) {
        throw new FrontmatterError('list item without a preceding key', ctx);
      }
      const value = unquote(trimmed.slice(2).trim());
      if (value === '') {
        throw new FrontmatterError('empty list item', ctx);
      }
      data[openListKey].push(value);
      continue;
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/.exec(trimmed);
    if (!match) {
      throw new FrontmatterError(`cannot parse line: ${JSON.stringify(raw)}`, ctx);
    }

    const [, key, rest] = match;
    if (Object.hasOwn(data, key)) {
      throw new FrontmatterError(`duplicate key "${key}"`, ctx);
    }

    if (rest === '') {
      // Opens a block list. An immediately-following non-item line leaves it
      // empty, which is fine and means "none".
      data[key] = [];
      openListKey = key;
      continue;
    }

    openListKey = null;

    if (rest.startsWith('[')) {
      if (!rest.endsWith(']')) {
        throw new FrontmatterError('inline list must close on the same line', ctx);
      }
      data[key] = parseInlineList(rest, ctx);
      continue;
    }

    if (rest.startsWith('{')) {
      throw new FrontmatterError('nested maps are not supported in this frontmatter subset', ctx);
    }

    data[key] = unquote(rest);
  }

  return { data, body: lines.slice(closing + 1).join('\n').trim() };
}
