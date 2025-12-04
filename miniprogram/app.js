// app.js
App({
  onLaunch() {
    this.globalData.env = "";
      // env 参数说明：
      //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
      //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
      //   如不填则使用默认环境（第一个创建的环境）
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
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
