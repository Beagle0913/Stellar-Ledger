import '@testing-library/jest-dom/vitest'

// jsdom has no Electron confirm — stub for SaveLoadPage delete flow if needed.
if (typeof globalThis.confirm !== 'function') {
  globalThis.confirm = () => true
}
