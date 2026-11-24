/* Roma Hub iOS 12: compatibility layer. Loaded synchronously before application scripts.
   Scope: iOS 12 only; this does not alter the modern application. */
(function () {
  'use strict';
  var ua = navigator.userAgent || '';
  var ios = /iPad|iPhone|iPod/.test(ua);
  var version = /OS (\d+)[_.](\d+)/.exec(ua);
  var legacy = !!(ios && version && Number(version[1]) === 12);
  window.CoroIOS12 = { isIOS12: legacy, version: version ? Number(version[1]) + '.' + Number(version[2]) : '' };
  if (!legacy) return;

  document.documentElement.className += (document.documentElement.className ? ' ' : '') + 'ios12';
  if (typeof window.globalThis === 'undefined') window.globalThis = window;

  /* replaceChildren landed after iOS 12, and is used by the score viewer. */
  function replaceChildren() {
    while (this.firstChild) this.removeChild(this.firstChild);
    for (var i = 0; i < arguments.length; i++) {
      var child = arguments[i];
      this.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    }
  }
  if (!Element.prototype.replaceChildren) Element.prototype.replaceChildren = replaceChildren;
  if (window.DocumentFragment && !DocumentFragment.prototype.replaceChildren) {
    DocumentFragment.prototype.replaceChildren = replaceChildren;
  }
  if (!Promise.allSettled) {
    Promise.allSettled = function (promises) {
      return Promise.all(Array.prototype.map.call(promises, function (item) {
        return Promise.resolve(item).then(
          function (value) { return { status: 'fulfilled', value: value }; },
          function (reason) { return { status: 'rejected', reason: reason }; }
        );
      }));
    };
  }

  /* Older Safari lacks IntersectionObserver; preserve lazy thumbnails. */
  if (!('IntersectionObserver' in window)) {
    window.IntersectionObserver = function (callback, options) {
      var self = this;
      this.items = [];
      this.root = options && options.root || null;
      this.margin = 200;
      this.queued = false;
      this.check = function () {
        self.queued = false;
        var box = self.root ? self.root.getBoundingClientRect() : {
          top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight
        };
        var visible = [];
        self.items.forEach(function (node) {
          var r = node.getBoundingClientRect(), m = self.margin;
          if (r.bottom >= box.top - m && r.top <= box.bottom + m &&
              r.right >= box.left - m && r.left <= box.right + m) {
            visible.push({ target: node, isIntersecting: true, intersectionRatio: 1 });
          }
        });
        if (visible.length) callback(visible, self);
      };
      this.queue = function () {
        if (self.queued) return;
        self.queued = true;
        window.requestAnimationFrame(self.check);
      };
      (this.root || window).addEventListener('scroll', this.queue, { passive: true });
      window.addEventListener('resize', this.queue);
    };
    window.IntersectionObserver.prototype.observe = function (target) {
      if (this.items.indexOf(target) < 0) this.items.push(target);
      this.queue();
    };
    window.IntersectionObserver.prototype.unobserve = function (target) {
      var i = this.items.indexOf(target);
      if (i >= 0) this.items.splice(i, 1);
    };
    window.IntersectionObserver.prototype.disconnect = function () {
      (this.root || window).removeEventListener('scroll', this.queue);
      window.removeEventListener('resize', this.queue);
      this.items.length = 0;
    };
  }

  /* iOS 12 has Touch Events but no Pointer Events. Adapt finger drawing on
     the existing SVG annotation surface; hand mode keeps native scrolling. */
  if (!window.PointerEvent) {
    var active = null, finger = null;
    function overlayOf(node) {
      while (node && node !== document) {
        if (node.classList && node.classList.contains('notesOverlay')) return node;
        node = node.parentNode;
      }
      return null;
    }
    function sendPointer(type, target, touch) {
      if (!target || !touch) return;
      var event = document.createEvent('MouseEvents');
      event.initMouseEvent(type, true, true, window, 1, touch.screenX, touch.screenY,
        touch.clientX, touch.clientY, false, false, false, false, 0, null);
      try {
        Object.defineProperty(event, 'pointerId', { value: 1 });
        Object.defineProperty(event, 'isPrimary', { value: true });
      } catch (err) { /* SVG handlers accept the remaining mouse coordinates. */ }
      target.dispatchEvent(event);
    }
    document.addEventListener('touchstart', function (event) {
      if (event.touches.length !== 1) return;
      var candidate = overlayOf(event.target);
      if (!candidate || candidate.style.pointerEvents === 'none') return;
      active = candidate;
      finger = event.changedTouches[0].identifier;
      if (event.cancelable) event.preventDefault();
      sendPointer('pointerdown', active, event.changedTouches[0]);
    }, { passive: false, capture: true });
    document.addEventListener('touchmove', function (event) {
      if (!active) return;
      for (var i = 0; i < event.changedTouches.length; i++) {
        if (event.changedTouches[i].identifier === finger) {
          if (event.cancelable) event.preventDefault();
          sendPointer('pointermove', active, event.changedTouches[i]);
          break;
        }
      }
    }, { passive: false, capture: true });
    function endTouch(event, type) {
      if (!active) return;
      for (var i = 0; i < event.changedTouches.length; i++) {
        if (event.changedTouches[i].identifier === finger) {
          if (event.cancelable) event.preventDefault();
          sendPointer(type, active, event.changedTouches[i]);
          active = null; finger = null;
          break;
        }
      }
    }
    document.addEventListener('touchend', function (event) { endTouch(event, 'pointerup'); },
      { passive: false, capture: true });
    document.addEventListener('touchcancel', function (event) { endTouch(event, 'pointercancel'); },
      { passive: false, capture: true });
  }
}());
