/** The Anthropic cache_control marks of one request body, in the shape the engine's /metrics record calls cache_hints. */

/** -> {marks, byBlock, lastMarkedMessage, atLastMessage, ttl}, or null when the request marks no cache point. */
export function cacheHints(body) {
  const marks = { system: 0, messages: 0, tools: 0 };
  const ttl = new Set();
  const count = (blocks) => {
    let found = 0;
    if (!Array.isArray(blocks)) return found;
    for (const block of blocks) {
      const control = block && typeof block === 'object' ? block.cache_control : null;
      if (!control || typeof control !== 'object') continue;
      found += 1;
      if (control.ttl === '5m' || control.ttl === '1h') ttl.add(control.ttl);
    }
    return found;
  };
  if (Array.isArray(body?.system)) marks.system = count(body.system);
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  let lastMarked = null;
  messages.forEach((message, index) => {
    const found = message && typeof message === 'object' ? count(message.content) : 0;
    marks.messages += found;
    if (found) lastMarked = index;
  });
  marks.tools = count(body?.tools);
  const total = marks.system + marks.messages + marks.tools;
  if (!total) return null;
  return {
    marks: total,
    byBlock: Object.fromEntries(Object.entries(marks).filter(([, count]) => count > 0)),
    lastMarkedMessage: lastMarked,
    atLastMessage: lastMarked !== null && lastMarked === messages.length - 1,
    ttl: [...ttl].sort(),
  };
}
