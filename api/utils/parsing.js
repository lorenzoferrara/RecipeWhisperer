// api/utils/parsing.js

function parseCommand(text) {
  const trimmed = String(text || '').trim();
  const match = trimmed.match(/^\/([a-zA-Z]+)(?:@\w+)?(?:\s+([\s\S]*))?$/);

  if (!match) {
    return { command: null, args: '' };
  }

  return {
    command: match[1].toLowerCase(),
    args: (match[2] || '').trim(),
  };
}

function parseNumericId(raw) {
  const normalized = String(raw || '').trim();
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) return null;
  return Number(normalized);
}

export { parseCommand, parseNumericId };
