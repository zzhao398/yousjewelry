// cloudfunctions/orderSync/config.local.js
//
// 私密配置（仅本地生效，不上传 Git）
//

module.exports = {
  IS_MOCK: false,

  ACCESS_NUMBER: 'UPBG917',
  SECRET: '1b4d420465dc1bb7ab64',

  // ⭐ 两个地址都写，随时可以切换测试
  BASE_URL_PROD_LIST: [
    'https://yousjewelry.com/gateway/',
    'https://www.yousjewelry.com/gateway/',
  ],

  BASE_URL_MOCK: 'https://youjewelry.free.beeceptor.com/gateway/',
  // 默认使用哪一个
  BASE_URL_PROD: 'https://yousjewelry.com/gateway/'
};
