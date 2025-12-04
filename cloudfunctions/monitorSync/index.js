// cloudfunctions/monitorSync/index.js
//
// 功能：
//   - 作为「监控」云函数的入口
//   - 一般由「定时触发器」每 10 分钟或 5 分钟调用一次
//   - 调用 monitorService.runMonitor，检查同步延迟、错误率等
//

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

const { initLogger, log, LEVEL } = require('./utils/logger');
const { runMonitor } = require('./monitorService');

// 注入 db 以便 logger 写日志到 logs 集合
initLogger(db);

/**
 * 监控云函数入口
 *
 * @param {Object} event   外界传参，一般为空
 * @param {Object} context 云函数上下文
 */
exports.main = async (event, context) => {
  try {
    const res = await runMonitor({ db, _, event, context });

    log({
      level: LEVEL.INFO,
      action: 'monitorSync',
      message: 'OK',
      data: res,
    });

    return { code: 0, msg: 'ok', data: res };
  } catch (err) {
    log({
      level: LEVEL.ERROR,
      action: 'monitorSync',
      message: err.message || 'MONITOR_FAILED',
      data: { stack: err.stack },
    });

    return { code: -1, msg: err.message || 'monitorSync failed' };
  }
};
