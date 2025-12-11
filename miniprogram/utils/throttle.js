// miniprogram/utils/throttle.js
//
// 作用：限制前端高频调用（例如下拉刷新），避免用户疯狂刷新
// 默认：同一个 key 在 wait 毫秒内只允许执行一次
//

const lastCall = {};

const canRun = (key, wait = 1000) => {
  const now = Date.now();
  const last = lastCall[key] || 0;
  if (now - last < wait) return false;
  lastCall[key] = now;
  return true;
};

const withThrottle = (key, fn, wait = 1000) => {
  // ❗ 用普通 function，不要用箭头函数
  return function (...args) {
    if (!canRun(key, wait)) {
      wx.showToast({ title: '刷新太频繁，请稍等', icon: 'none' });
      return;
    }
    // 把当前 this（页面实例）传给 fn
    return fn.apply(this, args);
  };
};

module.exports = {
  canRun,
  withThrottle,
};