// miniprogram/utils/logger.js
//
// 前端轻量日志：输出到 devtools console
// 使用方式： log('orders.list', { page, tab })

const log = (action, data = {}) => {
  console.log(`[FE:${action}]`, JSON.stringify(data).slice(0, 500));
};

module.exports = { log };
