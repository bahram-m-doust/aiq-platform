import "@testing-library/jest-dom/vitest";

// jsdom ships without ResizeObserver, which Radix popper-based primitives
// (Tooltip, Select, …) construct as soon as they open. Provide a no-op so
// components that surface a tooltip in unit tests don't throw.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserver as unknown as typeof globalThis.ResizeObserver;
}

// jsdom doesn't implement scrollIntoView; components that scroll a target into
// view (e.g. the questionnaire's "fix this" deep link) call it directly. A
// no-op keeps those code paths from throwing under test.
if (
  typeof Element !== "undefined" &&
  typeof Element.prototype.scrollIntoView !== "function"
) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
