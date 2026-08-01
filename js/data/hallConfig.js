/* === 影厅配置管理 === */

const HallConfig = (() => {
  let _current = 'small';

  function get() {
    return { ...window.CinemaConfig.halls[_current], key: _current };
  }

  function switchHall(key) {
    if (window.CinemaConfig.halls[key]) _current = key;
  }

  return { get, switchHall };
})();
