// Maps between a DOM Selection/Range and plain-text character offsets within a
// container, so a comment can anchor to an exact text range that survives
// re-render. Offsets are measured against the concatenation of the container's
// text nodes in document order — the same basis Range.toString() uses, so
// capture (getSelectionOffsets) and replay (createRangeFromOffsets) agree.
//
// Client-only: every function touches the DOM and the live Selection.

function walkTextNodes(container: Node): Text[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

// Character count from the start of `container` up to (node, offset).
function offsetTo(container: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(node, offset);
  return range.toString().length;
}

// The plain-text offsets of `range` within `container`, or null when the range
// is empty or escapes the container.
export function getSelectionOffsets(
  container: HTMLElement,
  range: Range,
): { start: number; end: number } | null {
  if (
    !container.contains(range.startContainer) ||
    !container.contains(range.endContainer)
  ) {
    return null;
  }
  const start = offsetTo(container, range.startContainer, range.startOffset);
  const end = offsetTo(container, range.endContainer, range.endOffset);
  if (end <= start) return null;
  return { start, end };
}

// Rebuilds a DOM Range from plain-text offsets. Returns null if the offsets no
// longer fit the container (e.g. the document was shortened after a re-export).
export function createRangeFromOffsets(
  container: HTMLElement,
  start: number,
  end: number,
): Range | null {
  const nodes = walkTextNodes(container);
  let acc = 0;
  let startNode: Text | null = null;
  let startLocal = 0;
  let endNode: Text | null = null;
  let endLocal = 0;

  for (const node of nodes) {
    const len = node.data.length;
    if (startNode === null && start <= acc + len) {
      startNode = node;
      startLocal = start - acc;
    }
    if (startNode !== null && end <= acc + len) {
      endNode = node;
      endLocal = end - acc;
      break;
    }
    acc += len;
  }

  if (startNode === null || endNode === null) return null;
  const range = document.createRange();
  try {
    range.setStart(startNode, startLocal);
    range.setEnd(endNode, endLocal);
  } catch {
    return null;
  }
  return range;
}

// Re-anchoring fallback: locate `quote` within the container's text. Used when
// the stored offsets no longer line up with the quoted text.
export function findQuoteOffsets(
  container: HTMLElement,
  quote: string,
): { start: number; end: number } | null {
  if (!quote) return null;
  const text = container.textContent ?? "";
  const start = text.indexOf(quote);
  if (start < 0) return null;
  return { start, end: start + quote.length };
}

// The plain-text offset under a screen point, for click-to-activate (the
// reverse direction: clicking a painted highlight selects its comment). Returns
// null when the point is outside the container or the browser lacks the API.
export function offsetUnderPoint(
  container: HTMLElement,
  x: number,
  y: number,
): number | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  let node: Node | null = null;
  let offset = 0;
  if (typeof doc.caretPositionFromPoint === "function") {
    const pos = doc.caretPositionFromPoint(x, y);
    if (!pos) return null;
    node = pos.offsetNode;
    offset = pos.offset;
  } else if (typeof doc.caretRangeFromPoint === "function") {
    const range = doc.caretRangeFromPoint(x, y);
    if (!range) return null;
    node = range.startContainer;
    offset = range.startOffset;
  } else {
    return null;
  }

  if (!node || !container.contains(node)) return null;
  return offsetTo(container, node, offset);
}

// Whether the browser can paint highlights without DOM mutation. When false the
// comments still work; the ranges just aren't visually marked.
export function supportsHighlightApi(): boolean {
  return (
    typeof CSS !== "undefined" &&
    "highlights" in CSS &&
    typeof Highlight !== "undefined"
  );
}
