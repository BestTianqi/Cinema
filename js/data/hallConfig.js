/* === 影厅配置管理 === */

const HallConfig = (() => {
  let _current = 'small';

  function get() {
    return { ...window.CinemaConfig.halls[_current], key: _current };
  }

  function switchHall(key) {
    if (window.CinemaConfig.halls[key]) _current = key;
  }

  function list() {
    return Object.entries(window.CinemaConfig.halls).map(([k, v]) => ({
      key: k, ...v,
    }));
  }

  return { get, switchHall, list };
})();
