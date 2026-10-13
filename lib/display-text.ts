// Decode display text once, without parsing HTML or changing stored snapshots.
// React must still render the result as a text child, never as raw HTML.
const namedEntities: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
  pound: "£", euro: "€", copy: "©", reg: "®", trade: "™",
  ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
};

export function decodeDisplayText(value: string) {
  return value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/gi, (entity, code: string) => {
    if (!code.startsWith("#")) return Object.hasOwn(namedEntities, code) ? namedEntities[code] : entity;
    const hex = code[1].toLowerCase() === "x";
    const point = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (!Number.isSafeInteger(point) || point <= 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return entity;
    return String.fromCodePoint(point);
  });
}
