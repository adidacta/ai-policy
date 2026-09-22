/**
 * Loading and validating the policy corpus. Shared by validate, build and query
 * so all three agree on what a valid policy is.
 */

import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './frontmatter.mjs';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const POLICY_DIR = join(ROOT, 'policies');

const SCHEMA = JSON.parse(
  await readFile(join(ROOT, 'schema', 'policy.schema.json'), 'utf8'),
);

/** Keys the schema declares as arrays — used to normalise a lone scalar. */
const LIST_KEYS = Object.entries(SCHEMA.properties)
  .filter(([, spec]) => spec.type === 'array')
  .map(([key]) => key);

/** The relation keys that become graph edges, in the order they are drawn. */
export const RELATIONS = ['depends_on', 'relates_to', 'supersedes'];

function checkAgainstSchema(data, file, problems) {
  for (const key of SCHEMA.required) {
    if (!Object.hasOwn(data, key)) {
      problems.push(`${file}: missing required key "${key}"`);
    }
  }

  for (const [key, value] of Object.entries(data)) {
    const spec = SCHEMA.properties[key];
    if (!spec) {
      problems.push(`${file}: unknown key "${key}" (add it to schema/policy.schema.json if intended)`);
      continue;
    }

    if (spec.type === 'array') {
      if (!Array.isArray(value)) {
        problems.push(`${file}: "${key}" must be a list`);
      }
      continue;
    }

    if (Array.isArray(value)) {
      problems.push(`${file}: "${key}" must be a single value, not a list`);
      continue;
    }

    if (spec.enum && !spec.enum.includes(value)) {
      problems.push(`${file}: "${key}" is "${value}" — expected one of ${spec.enum.join(', ')}`);
    }

    if (spec.pattern && !new RegExp(spec.pattern).test(value)) {
      problems.push(`${file}: "${key}" is "${value}" — expected to match ${spec.pattern}`);
    }

    if (spec.minLength !== undefined && value.length < spec.minLength) {
      problems.push(`${file}: "${key}" is empty`);
    }
  }
}

/**
 * Read every policy in policies/, validate it, and resolve cross-references.
 *
 * @returns {{ policies: Array<object>, problems: string[] }}
 *   Always returns both — callers decide whether problems are fatal.
 */
export async function loadPolicies() {
  const entries = await readdir(POLICY_DIR);
  const files = entries
    .filter((name) => name.endsWith('.md') && !name.startsWith('_'))
    .sort();

  const policies = [];
  const problems = [];

  for (const file of files) {
    const stem = basename(file, '.md');
    const source = await readFile(join(POLICY_DIR, file), 'utf8');

    let parsed;
    try {
      parsed = parseFrontmatter(source, file);
    } catch (error) {
      problems.push(error.message);
      continue;
    }

    const { data, body } = parsed;

    // A missing list means "none"; a lone scalar is a courtesy we accept.
    for (const key of LIST_KEYS) {
      if (!Object.hasOwn(data, key)) data[key] = [];
      else if (!Array.isArray(data[key])) data[key] = [data[key]];
    }

    checkAgainstSchema(data, file, problems);

    if (data.id && data.id !== stem) {
      problems.push(`${file}: id "${data.id}" does not match the filename stem "${stem}"`);
    }

    policies.push({ ...data, file, body, wordCount: body.split(/\s+/).filter(Boolean).length });
  }

  // Cross-reference checks, once the whole corpus is known.
  const byId = new Map(policies.map((p) => [p.id, p]));

  for (const policy of policies) {
    for (const relation of RELATIONS) {
      for (const target of policy[relation]) {
        if (!byId.has(target)) {
          problems.push(`${policy.file}: ${relation} points at "${target}", which does not exist`);
          continue;
        }
        if (target === policy.id) {
          problems.push(`${policy.file}: ${relation} points at itself`);
        }
        if (relation === 'supersedes' && byId.get(target).status !== 'superseded') {
          problems.push(
            `${policy.file}: supersedes "${target}", but that policy's status is ` +
            `"${byId.get(target).status}" rather than "superseded"`,
          );
        }
      }
    }
  }

  return { policies, problems };
}
