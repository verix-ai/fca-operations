import '@testing-library/jest-dom/vitest'

// Node.js 25+ ships a native globalThis.localStorage stub that lacks .clear()
// and overrides jsdom's full implementation.  When jsdom is the test environment
// we replace the native stub with jsdom's real Storage object so that tests can
// call localStorage.clear() / setItem() / getItem() as expected.
if (typeof globalThis.jsdom !== 'undefined') {
  const jsdomLocalStorage = globalThis.jsdom.window.localStorage;
  if (jsdomLocalStorage && typeof jsdomLocalStorage.clear === 'function') {
    Object.defineProperty(globalThis, 'localStorage', {
      get: () => jsdomLocalStorage,
      configurable: true,
    });
  }
}

// Polyfill Blob.prototype.arrayBuffer and Blob.prototype.text for jsdom,
// which ships an older Blob without these methods.
if (typeof Blob !== 'undefined' && !Blob.prototype.arrayBuffer) {
  Blob.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(reader.error)
      reader.readAsArrayBuffer(this)
    })
  }
}

if (typeof Blob !== 'undefined' && !Blob.prototype.text) {
  Blob.prototype.text = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(reader.error)
      reader.readAsText(this)
    })
  }
}
