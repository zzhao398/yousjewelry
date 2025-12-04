// cloudfunctions/monitorSync/utils/logger.js

let dbInstance = null;

const initLogger = (db) => {
  dbInstance = db;
};

const LEVEL = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

const log = (entry) => {
  const { level = LEVEL.INFO, action = '', message = '', data = {}, openid = '' } = entry || {};

  console.log(
    JSON.stringify({
      timestamp: Date.now(),
      level,
      action,
      message,
      data,
      openid,
    }),
  );

  if (!dbInstance) return;

  dbInstance.collection('logs').add({
    data: {
      timestamp: Date.now(),
      level,
      action,
      message,
      data,
      openid,
    },
  });
};

module.exports = {
  initLogger,
  log,
  LEVEL,
};
