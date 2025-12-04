// pages/home/index.js
//
// 职责：
// - 加载首页概况（今日订单数 / GMV / 待发货）
// - 管理员：额外看到 7 天 GMV/订单数曲线 + 按主播统计
// - 主播：只看自己的概况
// - 支持下拉刷新（带节流）

const { getMe, getDashboardSummary } = require('../../utils/ueeApi');
const { call } = require('../../utils/request');
const { withThrottle } = require('../../utils/throttle');
const { log } = require('../../utils/logger');

Page({
  data: {
    role: 'anchor',       // 实际角色
    isAdmin: false,       // 是否管理员视图（owner 也算）
    displayName: '',
    anchorId: null,

    // 今日概况
    orderCount: 0,
    gmv: 0,
    toShipCount: 0,

    // 管理员统计用
    dayStats: [],         // [{ day, orderCount, gmv, commission }]
    anchorStats: [],      // [{ anchorId, orderCount, gmv, commission }]

    loading: false,
  },

  onLoad() {
    this.fetchAll();
  },

  // 同时拉 用户信息 + 今日概况 +（如果是管理员）近 7 天统计
  fetchAll() {
    this.setData({ loading: true });

    getMe()
      .then((me) => {
        const role = me.role || 'anchor';
        const isAdmin = role === 'admin' || role === 'owner';

        this.setData({
          role,
          isAdmin,
          displayName: me.displayName || '',
          anchorId: me.anchorId || null,
        });

        const pSummary = getDashboardSummary();

        // 管理员才去调 dashboard.metrics
        let pMetrics = Promise.resolve([null, null]);
        if (isAdmin) {
          const nowSec = Math.floor(Date.now() / 1000);
          const sevenDaysAgo = nowSec - 7 * 24 * 3600;

          const baseParams = { dateRange: { startSec: sevenDaysAgo, endSec: nowSec } };

          const pDay = call('dashboard.metrics', {
            ...baseParams,
            groupBy: 'day',
          });

          const pAnchor = call('dashboard.metrics', {
            ...baseParams,
            groupBy: 'anchor',
          });

          pMetrics = Promise.all([pDay, pAnchor]);
        }

        return Promise.all([pSummary, pMetrics]);
      })
      .then(([summary, metrics]) => {
        const [dayRes, anchorRes] = metrics || [];

        // 今日概况（主播和管理员都有）
        this.setData({
          orderCount: (summary && summary.orderCount) || 0,
          gmv: (summary && summary.gmv) || 0,
          toShipCount: (summary && summary.toShipCount) || 0,
        });

        // 只有管理员才设置 dayStats / anchorStats
        if (this.data.isAdmin) {
          this.setData({
            dayStats: (dayRes && dayRes.dayStats) || [],
            anchorStats: (anchorRes && anchorRes.anchorStats) || [],
          });
        }
      })
      .catch((err) => {
        console.error('home.fetchAll error', err);
        wx.showToast({ title: '加载首页数据失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  // 下拉刷新（节流）
  onPullDownRefresh: withThrottle(
    'home:refresh',
    function () {
      log('home.refresh', {});
      return this.fetchAll().finally(() => {
        wx.stopPullDownRefresh();
      });
    }.bind(this),
    1000,
  ),
});