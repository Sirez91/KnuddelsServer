// Mirrors the Knuddels production runtime, which monkey-patches the global
// String.prototype with chat-specific helpers (see the String interface in
// types/knuddels-userapp-backend-api.d.ts). Userapps assume these methods
// exist on every string; without this shim, sandbox-side calls like
// `msg.getText().stripKCode()` throw "is not a function".
//
// V8 quirk: a `vm.createContext` has its own *intrinsic* String.prototype
// that primitives auto-box to. The explicit `String` global we pass into
// the sandbox object refers to the host's constructor, but
// `"".__proto__` inside the context refers to the context-intrinsic
// prototype — and that's what every string method lookup actually hits,
// even for strings produced by host code that cross the boundary. So the
// install must run *inside* each new context, against the intrinsic.

import * as vm from 'node:vm';

const SOURCE = `
(function () {
  var proto = ''.__proto__;
  function def(name, fn) {
    if (typeof proto[name] === 'function') return;
    Object.defineProperty(proto, name, {
      value: fn, enumerable: false, configurable: true, writable: true,
    });
  }
  def('stripKCode', function () {
    return ('' + this)
      .replace(/_K_[A-Za-z0-9]+_K_[^_]*_K_/g, '')
      .replace(/\\u00B0[^\\u00B0]*\\u00B0/g, '');
  });
  def('escapeKCode', function () {
    return ('' + this).replace(/_/g, '__');
  });
  def('isAllowedAsChatMessage', function () { return true; });
  def('isEmpty', function () { return this.length === 0; });
  def('hasOnlyDigits', function () { return /^\\d+$/.test('' + this); });
  def('toCamelCase', function () {
    var s = '' + this;
    if (s.length === 0) return s;
    return s.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, function (_m, ch) {
      return ch.toUpperCase();
    });
  });
  def('capitalize', function () {
    var s = '' + this;
    if (s.length === 0) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  });
  def('contains', function (needle) {
    return ('' + this).indexOf(needle) >= 0;
  });
  def('getPixelWidth', function (fontSize) {
    return this.length * fontSize;
  });
  def('limitString', function (fontSize, _isBold, maxPixelWidth, abbreviationMarker) {
    var s = '' + this;
    var maxChars = Math.max(0, Math.floor(maxPixelWidth / Math.max(1, fontSize)));
    if (s.length <= maxChars) return s;
    var marker = abbreviationMarker == null ? '' : '' + abbreviationMarker;
    var cut = Math.max(0, maxChars - marker.length);
    return s.slice(0, cut) + marker;
  });
  def('minimalConversionCost', function () { return 0; });
})();
`;

export function installKnuddelsStringExtensionsInContext(context: vm.Context): void {
  vm.runInContext(SOURCE, context, { filename: 'knuddels-string-extensions.js' });
}
