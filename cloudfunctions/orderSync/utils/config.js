// cloudfunctions/orderSync/config.js
//
// Ueeshop API 配置（orderSync 专用）
// - 支持 config.local.js 覆盖
// - 支持 Mock / Prod 自动切换
// - 禁止使用 this（内部常量 + 函数）
//

/** 尝试加载本地私密配置（不会上传 Git） */
let local = {};
try {
  local = require('./config.local.js');
} catch (e) {
  local = {};
}

/** 是否使用 Mock（Beeceptor） */
// 优先本地配置 → 默认 true
const IS_MOCK =
  typeof local.IS_MOCK === 'boolean'
    ? local.IS_MOCK
    : true;

/** 公共参数 */
const API_NAME = 'openapi';

/** 接入码和密钥（敏感）——从 config.local.js 注入 */
const ACCESS_NUMBER = local.ACCESS_NUMBER || 'DEV_NUMBER';
const SECRET = local.SECRET || 'DEV_SECRET';

/** Mock 地址（用于开发调试） */
const BASE_URL_MOCK =
  local.BASE_URL_MOCK ||
  'https://youjewelry.free.beeceptor.com/gateway/';

/** 正式地址（你的独立站） */
const BASE_URL_PROD =
  local.BASE_URL_PROD ||
  'https://www.yousjewelry.com/gateway/';

/** 返回最终要用的 base URL */
const getBaseUrl = () => (IS_MOCK ? BASE_URL_MOCK : BASE_URL_PROD);

module.exports = {
  IS_MOCK,
  API_NAME,
  ACCESS_NUMBER,
  SECRET,
  BASE_URL_MOCK,
  BASE_URL_PROD,
  getBaseUrl,
};
