// cloudfunctions/ueeshopApi/config.js
//
// Ueeshop API 配置
// - 使用 mock (Beeceptor) 与正式环境自由切换
// - AccessNumber / Secret 通过 config.local.js 私密注入（.gitignore）
//

const local = (() => {
  try {
    // 私密配置文件（不会提交到 GitHub）
    return require('./config.local.js');
  } catch (e) {
    return {};
  }
})();

module.exports = {
  // Mock 环境（调试阶段用 Beeceptor）
  IS_MOCK: local.IS_MOCK !== undefined ? local.IS_MOCK : true,

  API_NAME: 'openapi',

  // 真实接入码和密钥在 config.local.js 里，不写死在仓库里
  ACCESS_NUMBER: local.ACCESS_NUMBER || 'DEV_NUMBER',
  SECRET: local.SECRET || 'DEV_SECRET',

  // Mock 地址
  BASE_URL_MOCK:
    local.BASE_URL_MOCK ||
    'https://domain.free.beeceptor.com/gateway/',

  // 正式地址
  BASE_URL_PROD:
    local.BASE_URL_PROD || 'https://www.domain.com/gateway/',

  getBaseUrl() {
    return this.IS_MOCK ? this.BASE_URL_MOCK : this.BASE_URL_PROD;
  },
};
