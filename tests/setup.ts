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
