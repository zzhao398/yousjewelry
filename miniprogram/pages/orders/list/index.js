// pages/orders/list/index.js
//
// 功能：
// - 顶部搜索栏 + Tab
// - 不输入关键字：正常分页 orders.list
// - 输入关键字：orders.list + keyword/searchType
// - 主播看不到邮箱，只能搜到自己的订单
// - 金额格式化成 "USD 230.00"

const { getOrders } = require('../../../utils/busiApi');
const { withThrottle } = require('../../../utils/throttle');
const { log } = require('../../../utils/logger');
const i18n = require('../../../utils/i18n');

Page({
  data: {
    role: 'anchor',
    anchorId: null,
    displayName: '',

    // tab: all | pending | unshipped | unpaid | paid | shipped
    tab: 'all',
    list: [],
    page: 1,
    pageSize: 20,
    loading: false,
    finished: false,

    keyword: '', // 搜索关键字

    // 多语言
    lang: i18n.getCurrentLang(),
    tOrdersList: i18n.getDict().ordersList,
    tOrderCommon: i18n.getDict().orderCommon,
  },

  onLoad() {
    this.refreshI18n();
    this.fetchOrders(true);
  },

  onShow() {
    this.refreshI18n();
    // 如果已经拿到用户角色但列表还是空的，再兜底拉一次
    if (!this.data.loading && this.data.list.length === 0) {
      this.fetchOrders(true);
    }
  },

  // ===== 多语言：刷新当前页文案 =====
  refreshI18n() {
    const dict = i18n.getDict();
    this.setData({
      lang: i18n.getCurrentLang(),
      tOrdersList: dict.ordersList,
      tOrderCommon: dict.orderCommon,
    });
  },

  // ===== 核心：拉订单列表（支持搜索 / 分页） =====
  fetchOrders(reset = false) {
    if (this.data.loading) return Promise.resolve();

    const nextPage = reset ? 1 : this.data.page + 1;
    const { tab, pageSize } = this.data;
    const keyword = (this.data.keyword || '').trim();

    const statusMap = {
      all: undefined,        // “所有”不传 status
      pending: 'pending',
      unshipped: 'unshipped',
      unpaid: 'unpaid',
      paid: 'paid',
      shipped: 'shipped',
    };

    // 先只放公共参数
    const params = {
      page: nextPage,
      pageSize,
      keyword,
      searchType: 'auto',
    };

    // 除了 all，其它 tab 才加 status
    const status = statusMap[tab];
    if (status) {
      params.status = status;
    }

    this.setData({ loading: true });

    log('orders.fetch', {
      reset,
      tab,
      keyword,
      page: nextPage,
      statusSent: params.status,
    });

    return getOrders(params)
      .then((res) => {
        const rawList = res.list || [];

        const cookedList = rawList.map((o) => {
          const amount = Number(o.orderTotalPrice || 0);
          const currency = o.currency || 'USD';

          // 兜底保证有 oid
          const oid = o.oid || o.OId || o.id || '';

          const tCommon = this.data.tOrderCommon || i18n.getDict().orderCommon;

          let shippingStatusLabel = tCommon.ship_unshipped;
          let shippingTagClass = 'tag-red';
          if (o.shippingStatus === 'shipped') {
            shippingStatusLabel = tCommon.ship_shipped;
            shippingTagClass = 'tag-green';
          } else if (o.shippingStatus === 'partial') {
            shippingStatusLabel = tCommon.ship_partial;
            shippingTagClass = 'tag-yellow';
          }

          let payStatusLabel = tCommon.pay_unpaid;
          let payTagClass = 'tag-red';
          if (o.paymentStatus === 'paid') {
            payStatusLabel = tCommon.pay_paid;
            payTagClass = 'tag-green';
          } else if (o.paymentStatus === 'partially_paid') {
            payStatusLabel = tCommon.pay_partial;
            payTagClass = 'tag-yellow';
          }

          return {
            ...o,
            oid,
            displayOid: oid,
            displayAmount: `${currency} ${amount.toFixed(2)}`,
            shippingStatusLabel,
            shippingTagClass,
            payStatusLabel,
            payTagClass,
          };
        });

        const newList = reset
          ? cookedList
          : this.data.list.concat(cookedList);

        this.setData({
          list: newList,
          page: nextPage,
          finished: cookedList.length < this.data.pageSize,
          role: res.role || this.data.role,
        });
      })
      .catch((err) => {
        console.error('fetchOrders error', err);
        wx.showToast({
          title: this.data.tOrdersList.toast_load_failed,
          icon: 'none',
        });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  // ===== 搜索相关 =====

  // 输入时只更新 keyword，不发请求
  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  // 点击键盘“搜索” or 点击放大镜
  onSearchConfirm: withThrottle(
    'orders:list:search',
    function () {
      const kw = (this.data.keyword || '').trim();

      // 关键字为空：相当于“清空搜索”→ 刷新列表
      if (!kw) {
        return this.fetchOrders(true);
      }

      // 主播不能按邮箱搜索
      if (this.data.role === 'anchor' && kw.includes('@')) {
        wx.showToast({
          title: this.data.tOrdersList.toast_anchor_email_forbidden,
          icon: 'none',
        });
        return Promise.resolve();
      }

      return this.fetchOrders(true);
    },
    1000,
  ),

  // 清空搜索
  onSearchClear() {
    this.setData({ keyword: '' }, () => {
      this.fetchOrders(true);
    });
  },

  // 下拉刷新
  onPullDownRefresh: withThrottle(
    'orders:list:refresh',
    function () {
      log('orders.list.refresh', {});
      return this.fetchOrders(true).finally(() => {
        wx.stopPullDownRefresh();
      });
    },
    1000,
  ),

  // 上拉加载更多（注意：如果用 page-level 滚动才会触发）
  onReachBottom() {
    if (this.data.loading || this.data.finished) return;
    this.fetchOrders(false);
  },

  // 切换顶部 Tab
  onTabChange(e) {
    const { tab } = e.currentTarget.dataset;
    if (tab === this.data.tab) return;

    this.setData(
      {
        tab,
        list: [],
        page: 1,
        finished: false,
      },
      () => this.fetchOrders(true),
    );
  },

  // 点击订单卡片
  onOrderTap(e) {
    const { oid } = e.currentTarget.dataset;
    if (!oid) {
      wx.showToast({
        title: this.data.tOrdersList.toast_missing_oid,
        icon: 'none',
      });
      return;
    }

    wx.navigateTo({
      url: `/pages/orders/detail/index?oid=${encodeURIComponent(oid)}`,
    });
  },
});
