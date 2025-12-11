// app.js
const i18n = require('./utils/i18n');
App({
    onLaunch() {
      this.globalData.env = "cloud1-5gq5mg2ba8c93e1b";
  
      if (!wx.cloud) {
        console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      } else {
        wx.cloud.init({
          env: this.globalData.env,
          traceUser: true,
        });
      }
  
      // ⭐ 启动时按当前语言初始化一次 tabBar 文案
      this.applyLang();
    },
  
    // ⭐ 2. 根据当前语言刷新 tabBar 文案（全局）
    applyLang() {
      if (!wx.setTabBarItem) return;  // 防止某些环境下没有这个 API
  
      const dict = i18n.getDict();
      const tab = dict.tabbar || {};
  
      try {
        // index 必须和 app.json 里的 tabBar.list 顺序一致
        wx.setTabBarItem({
          index: 0,
          text: tab.home || '首页',
        });
        wx.setTabBarItem({
          index: 1,
          text: tab.orders || '订单',
        });
        wx.setTabBarItem({
          index: 2,
          text: tab.mine || '我的',
        });
      } catch (e) {
        console.warn('setTabBarItem error:', e);
      }
    },
  
    // ⭐ 3. 全局切换语言：Home 那边点按钮时要调用这个
    switchLang(lang) {
      i18n.setCurrentLang(lang);  // 写入 storage
      this.applyLang();           // 顺便更新 tabBar
    },
  
    globalData: {
      env: "",
      // 用户信息缓存（5 分钟）
      me: null,
      meCachedAt: 0,
  
      // 首页概况缓存（5 分钟）
      dashboard: null,
      dashboardCachedAt: 0,
  
      // 订单列表缓存（1 分钟，只缓存第一页）
      orderCache: {}, // key -> { data, cachedAt }
    },
  });