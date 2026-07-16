const acorn = require('acorn-loose');

const DEFAULT_CLIENT_REFERENCES_EXCLUDE =
  /(^|[/\\])(?:node_modules|vendor[/\\](?:bundle|cache)|public[/\\](?:assets|packs|vite|webpack|rspack|builds)|app[/\\]assets[/\\](?:builds|vite|webpack|rspack))(?:[/\\]|$)/;
const DEFAULT_CLIENT_REFERENCES_INCLUDE = /\.[cm]?[jt]sx?$/;

function hasDirectiveTerminator(source, end) {
  if (source[end - 1] === ';') return true;

  let index = end;
  while (index < source.length) {
    const charCode = source.charCodeAt(index);
    if (charCode === 9 || charCode === 11 || charCode === 12 || charCode === 32) {
      index += 1;
      continue;
    }
    if (charCode === 10 || charCode === 13) return true;
    if (source.startsWith('//', index)) return true;
    if (source.startsWith('/*', index)) {
      const commentEnd = source.indexOf('*/', index + 2);
      if (commentEnd === -1) return false;
      if (/[\r\n]/.test(source.slice(index + 2, commentEnd))) return true;
      index = commentEnd + 2;
      continue;
    }
    return false;
  }

  return true;
}

function hasUseClientDirective(source) {
  const text = Buffer.isBuffer(source) ? source.toString('utf8') : source;
  if (!text.includes('use client')) return false;

  let program;
  try {
    program = acorn.parse(text, {
      allowHashBang: true,
      ecmaVersion: 'latest',
      sourceType: 'module',
    });
  } catch {
    return false;
  }

  for (const statement of program.body || []) {
    if (
      statement.type !== 'ExpressionStatement' ||
      statement.expression?.type !== 'Literal' ||
      typeof statement.expression.value !== 'string'
    ) {
      return false;
    }

    if (!statement.directive) return false;
    if (!hasDirectiveTerminator(text, statement.end)) return false;
    if (statement.directive === 'use client') return true;
  }

  return false;
}

module.exports = {
  DEFAULT_CLIENT_REFERENCES_EXCLUDE,
  DEFAULT_CLIENT_REFERENCES_INCLUDE,
  hasUseClientDirective,
};
