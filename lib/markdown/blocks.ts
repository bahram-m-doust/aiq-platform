// Splits a markdown document into anchored sections so each section can carry
// its own comment thread. A "block" starts at a heading (or the preamble before
// the first heading) and runs until the next heading of equal-or-higher level.
//
// The anchor id is a slug of the heading text — stable across re-render and RTL,
// and the same key a RAG chunker can use, so a comment and its knowledge chunk
// share one identity. Falls back to `section-N` when a heading is empty or
// missing, and de-duplicates collisions (`-2`, `-3`, …).

export type MarkdownBlock = {
  anchorId: string;
  label: string | null;
  level: number; // 0 = preamble, 1..6 = heading level
  markdown: string;
};

// Keep unicode letters/numbers (incl. Persian) so anchors stay meaningful;
// collapse everything else to single hyphens.
export function slugifyAnchor(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_~#>[\]()]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

const headingPattern = /^(#{1,6})\s+(.*)$/;

export function splitMarkdownIntoBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  const used = new Set<string>();

  function pushAnchor(base: string): string {
    const slug = base || `section-${blocks.length + 1}`;
    let candidate = slug;
    let n = 2;
    while (used.has(candidate)) {
      candidate = `${slug}-${n}`;
      n += 1;
    }
    used.add(candidate);
    return candidate;
  }

  let current: { label: string | null; level: number; lines: string[] } | null =
    null;

  const flush = () => {
    if (!current) return;
    const text = current.lines.join("\n").trim();
    // Drop an empty preamble, but keep heading-only sections.
    if (current.level === 0 && !text) {
      current = null;
      return;
    }
    blocks.push({
      anchorId: pushAnchor(
        current.label ? slugifyAnchor(current.label) : "",
      ),
      label: current.label,
      level: current.level,
      markdown: current.lines.join("\n").trim(),
    });
    current = null;
  };

  for (const line of lines) {
    const match = headingPattern.exec(line);
    if (match) {
      flush();
      current = {
        label: match[2].trim() || null,
        level: match[1].length,
        lines: [line],
      };
    } else {
      if (!current) {
        current = { label: null, level: 0, lines: [] };
      }
      current.lines.push(line);
    }
  }
  flush();

  // A document with no headings at all still needs one commentable block.
  if (blocks.length === 0 && markdown.trim()) {
    blocks.push({
      anchorId: "section-1",
      label: null,
      level: 0,
      markdown: markdown.trim(),
    });
  }

  return blocks;
}
