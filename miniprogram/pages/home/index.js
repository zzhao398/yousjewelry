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
    range: '7d',
  },

  onLoad() {
    this.fetchAll();
  },

  // ========== 新增：根据当前 range 计算秒级时间区间 ==========
  getDateRangeSec() {
    const nowSec = Math.floor(Date.now() / 1000);
    const r = this.data.range;
    let startSec;

    if (r === '7d') {
      startSec = nowSec - 7 * 24 * 3600;
    } else if (r === '30d') {
      startSec = nowSec - 30 * 24 * 3600;
    } else if (r === '1y') {
      startSec = nowSec - 365 * 24 * 3600;
    } else {
      // 'all' → 查全部
      startSec = 0;
    }

    return { startSec, endSec: nowSec };
  },

// ====== 工具：把日期字符串映射到“周 key” ======
  // 返回类似：2025-W48
  getWeekKey(dayStr) {
    if (!dayStr) return 'unknown';
    const d = new Date(dayStr + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return dayStr;

    // 把星期一作为一周的开始
    const day = (d.getDay() + 6) % 7; // 0 = Monday
    const monday = new Date(d);
    monday.setDate(d.getDate() - day);

    const year = monday.getFullYear();
    const firstJan = new Date(year, 0, 1);
    const diffDays = Math.floor((monday - firstJan) / (24 * 3600 * 1000));
    const week = Math.floor(diffDays / 7) + 1;

    return `${year}-W${String(week).padStart(2, '0')}`;
  },

  // ====== 根据 range 对 dayStats 做二次聚合 ======
  transformDayStatsByRange(rawList) {
    const r = this.data.range;
    const list = rawList || [];
    if (!list.length) return [];

    // 7天：保持按天
    if (r === '7d') {
      return list;
    }

    // 30天：按周
    if (r === '30d') {
      const map = {};
      list.forEach((it) => {
        const key = this.getWeekKey(it.day);
        if (!map[key]) {
          map[key] = {
            day: key,          // 用 week key 作为显示标签
            orderCount: 0,
            gmv: 0,
            commission: 0,
          };
        }
        map[key].orderCount += Number(it.orderCount || 0);
        map[key].gmv += Number(it.gmv || 0);
        map[key].commission += Number(it.commission || 0);
      });

      return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
    }

    // 1年：按月
    if (r === '1y') {
      const map = {};
      list.forEach((it) => {
        const parts = String(it.day || '').split('-');
        const y = parts[0];
        const m = parts[1];
        if (!y || !m) return;
        const key = `${y}-${m}`; // 2025-11

        if (!map[key]) {
          map[key] = {
            day: key,
            orderCount: 0,
            gmv: 0,
            commission: 0,
          };
        }
        map[key].orderCount += Number(it.orderCount || 0);
        map[key].gmv += Number(it.gmv || 0);
        map[key].commission += Number(it.commission || 0);
      });

      return Object.values(map).sort((a, b) => a.day.localeCompare(b.day));
    }

    // all：不展示趋势列表
    if (r === 'all') {
      return [];
    }

    return list;
  },
  
  // ====== 管理员图表数据 ======
  fetchMetrics() {
    if (!this.data.isAdmin) {
      return Promise.resolve();
    }

    const { startSec, endSec } = this.getDateRangeSec();
    const baseParams = { dateRange: { startSec, endSec } };

    const pDay = call('dashboard.metrics', {
      ...baseParams,
      groupBy: 'day',
    });

    const pAnchor = call('dashboard.metrics', {
      ...baseParams,
      groupBy: 'anchor',
    });

    return Promise.all([pDay, pAnchor]).then(([dayRes, anchorRes]) => {
      const rawDayStats = (dayRes && dayRes.dayStats) || [];
      const dayStats = this.transformDayStatsByRange(rawDayStats);

      this.setData({
        dayStats,
        anchorStats: (anchorRes && anchorRes.anchorStats) || [],
      });
    });
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
   // ========== 新增：时间范围切换 ==========
  // WXML 里用 data-range="7d|30d|1y|all" 绑定到这个函数
  onRangeChange(e) {
    const r = e.currentTarget.dataset.range || '7d';

    if (r === this.data.range) return; // 同一个就不刷新

    this.setData({ range: r });
    // 只刷新图表数据，不需要重新拉用户信息和今日概况
    this.fetchMetrics();
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