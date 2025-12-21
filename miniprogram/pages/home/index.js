// pages/home/index.js
//
// 职责：
// - 加载首页概况（今日订单数 / GMV / 待发货）
// - 管理员：额外看到 GMV/订单数曲线 + 按主播统计
// - 主播：看到自己的趋势曲线，但看不到排行榜
// - 支持下拉刷新（带节流）

const { getMe, getDashboardSummary } = require('../../utils/busiApi');
const { call } = require('../../utils/request');
const { withThrottle } = require('../../utils/throttle');
const { log } = require('../../utils/logger');
const i18n = require('../../utils/i18n');
const app = getApp();

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

    // 趋势统计
    dayStats: [],         // [{ day, orderCount, gmv, commission }]
    anchorStats: [],      // [{ anchorId, orderCount, gmv, commission }]

    loading: false,
    range: '7d',          // 7d | 30d | 1y | all

    // ====== 多语言相关 ======
    lang: i18n.getCurrentLang(),        // 当前语言 zh/en
    tCommon: i18n.getDict().common,     // 公共文案
    tHome: i18n.getDict().home,         // 首页文案
    langMenuVisible: false,             // 右上角语言下拉菜单
  },

  onLoad() {
    this.fetchAll();
  },

  onShow() {
    // 从其他页面返回时，如果语言变了，这里刷新一下文案
    this.refreshI18n();
  },

  // ====== 刷新当前页面用到的文案 ======
  refreshI18n() {
    const dict = i18n.getDict();
    this.setData({
      lang: i18n.getCurrentLang(),
      tCommon: dict.common,
      tHome: dict.home,
    });
  },

  // ====== 右上角语言按钮：展开 / 收起菜单 ======
  onLangButtonTap() {
    this.setData({
      langMenuVisible: !this.data.langMenuVisible,
    });
  },

  // ====== 在菜单里选择具体语言 ======
  onSelectLang(e) {
    const lang = e.currentTarget.dataset.lang; // 'zh' or 'en'

    // 让 app.js 处理全局语言 + tabBar
    if (app && typeof app.switchLang === 'function') {
      app.switchLang(lang);
    } else {
      // 兜底：至少把语言存起来
      i18n.setCurrentLang(lang);
    }

    // 刷新本页文案
    this.refreshI18n();

    this.setData({
      langMenuVisible: false,
    });
  },

  // ========== 根据当前 range 计算秒级时间区间 ==========
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

  // ====== 管理员 / 主播 图表数据 ======
  fetchMetrics() {
    const { isAdmin } = this.data;
    const { startSec, endSec } = this.getDateRangeSec();
    const baseParams = { dateRange: { startSec, endSec } };

    if (!isAdmin) {
      // ⭐ 主播：只看自己的按天趋势，不要 anchor 榜单
      return call('dashboard.metrics', {
        ...baseParams,
        groupBy: 'day',
      }).then((dayRes) => {
        const rawDayStats = (dayRes && dayRes.dayStats) || [];
        const dayStats = this.transformDayStatsByRange(rawDayStats);
        this.setData({
          dayStats,
          anchorStats: [],   // 主播没有榜单
        });
      });
    }

    // ⭐ 管理员：按天 + 按主播
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

  // 同时拉 用户信息 + 今日概况 + 趋势
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
        const pMetrics = this.fetchMetrics(); // 管理员 / 主播 都有趋势

        return Promise.all([pSummary, pMetrics]);
      })
      .then(([summary]) => {
        // 今日概况
        this.setData({
          orderCount: (summary && summary.orderCount) || 0,
          gmv: (summary && summary.gmv) || 0,
          toShipCount: (summary && summary.toShipCount) || 0,
        });
        // dayStats / anchorStats 已在 fetchMetrics 里 setData 了
      })
      .catch((err) => {
        console.error('home.fetchAll error', err);
        wx.showToast({ title: '加载首页数据失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  // ========== 时间范围切换 ==========
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
