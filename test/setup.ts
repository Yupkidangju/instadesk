// jsdom에는 Canvas 구현이 없으므로 xterm의 기능 감지만 안전하게 대체한다.
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  configurable: true,
  value: () => null,
});
