import "@testing-library/jest-dom/vitest"

// Polyfill for ResizeObserver (used by Recharts)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
