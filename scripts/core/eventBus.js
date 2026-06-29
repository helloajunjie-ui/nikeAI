/**
 * NikoAI — 轻量级 EventBus (Pub/Sub)
 * 底层与 UI 之间的唯一通信桥梁。
 * 单例模式，控制在 30 行以内。
 */

const _listeners = new Map();

export const EventBus = {
  on(event, callback) {
    if (!_listeners.has(event)) _listeners.set(event, []);
    _listeners.get(event).push(callback);
  },

  off(event, callback) {
    const cbs = _listeners.get(event);
    if (!cbs) return;
    const idx = cbs.indexOf(callback);
    if (idx !== -1) cbs.splice(idx, 1);
  },

  emit(event, data) {
    const cbs = _listeners.get(event);
    if (!cbs) return;
    cbs.forEach(cb => {
      try { cb(data); } catch (e) { console.error(`[EventBus] ${event} error:`, e); }
    });
  }
};
