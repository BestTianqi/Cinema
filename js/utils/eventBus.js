/* === 事件总线（发布-订阅） ===
   模块间通信的唯一通道。

   使用：
     EventBus.on('score:updated', data => { ... });
     EventBus.emit('score:updated', { score: 85 });
     const unsub = EventBus.on('evt', fn);  unsub();  // 取消订阅
*/
const EventBus = (() => {
  const listeners = {};

  return {
    on(event, callback) {
      (listeners[event] ??= []).push(callback);
      return () => this.off(event, callback);
    },
    off(event, callback) {
      listeners[event] = listeners[event]?.filter(fn => fn !== callback);
    },
    emit(event, data) {
      listeners[event]?.forEach(fn => {
        try { fn(data); } catch (e) { console.error(`[EventBus] ${event}:`, e); }
      });
    },
    once(event, callback) {
      const wrap = (data) => { callback(data); this.off(event, wrap); };
      this.on(event, wrap);
    },
  };
})();
