// pages/orders/list/index.js
//
// 功能：
// - 顶部自带搜索栏（就在列表页上方）
// - 不输入关键字：正常分页列表（orders.list）
// - 输入关键字：同一个接口 orders.list + keyword/searchType（后端自动识别）
// - 角色控制：主播看不到邮箱、只能搜到自己的订单
// - 顶部搜索 + Tab（所有 / 待发货 / 已付款 / 未付款 / 已发货）
// - 同一个接口 orders.list 做列表 + 搜索
// - 把金额格式化成 230.00，在 WXML 里配合 $ 显示

const { getOrders } = require('../../../utils/ueeApi');
  const { withThrottle } = require('../../../utils/throttle');
  const { log } = require('../../../utils/logger');
  
  let orderListEnterTime = 0;
  const CACHE_TTL = 30 * 1000; // 30 秒

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
      cache: {}
    },
  
    onLoad() {
      this.fetchOrders(true);
    },
  
    onShow() {
        orderListEnterTime = Date.now();
    
        // ✅ 如果已经拿到用户角色但列表还是空的，再兜底拉一次
        if (!this.data.loading && this.data.list.length === 0) {
          this.fetchOrders(true);
        }
      },
  
    fetchOrders(reset = false) {
        if (this.data.loading) return Promise.resolve();
      
        const nextPage = reset ? 1 : this.data.page + 1;
        const { tab, pageSize } = this.data;
        const keyword = (this.data.keyword || '').trim();

      const cacheKey = `${tab}|${keyword}`;
        // 如果是重置列表（比如切 tab、回到列表、搜索），先看缓存
  if (reset) {
    const cache = this.data.cache || {};
    const cached = cache[cacheKey];
    if (cached && Date.now() - cached.lastLoadedAt < CACHE_TTL) {
      log('orders.fetch.cacheHit', { cacheKey, tab, keyword });

      this.setData({
        list: cached.list,
        page: cached.page,
        finished: cached.finished,
        role: cached.role || this.data.role,
      });

      // 直接用缓存，不再打云函数
      return Promise.resolve();
    }
  }

        const statusMap = {
          all: undefined,        // “所有”不传 status
          pending: 'pending',
          unshipped: 'unshipped',
          unpaid: 'unpaid',
          paid: 'paid',
          shipped: 'shipped',
        };
      
        // ⭐ 先只放公共参数
        const params = {
          page: nextPage,
          pageSize,
          keyword,
          searchType: 'auto',
        };
      
        // ⭐ 除了 all，其它 tab 才加 status
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
          // 方便排查：也看看真正发了什么 status
          statusSent: params.status,
        });
      
        return getOrders(params)
          .then((res) => {
            const rawList = res.list || [];
      
            const cookedList = rawList.map((o) => {
  const amount = Number(o.orderTotalPrice || 0);
  const currency = o.currency || 'USD';

  // ✅ 这里兜底一遍，保证前端 list 里一定有 oid
  const oid = o.oid || o.OId || o.id || '';

  let shippingStatusLabel = '未发货';
  let shippingTagClass = 'tag-red';
  if (o.shippingStatus === 'shipped') {
    shippingStatusLabel = '已发货';
    shippingTagClass = 'tag-green';
  } else if (o.shippingStatus === 'partial') {
    shippingStatusLabel = '部分发货';
    shippingTagClass = 'tag-yellow';
  }

  let payStatusLabel = '未付款';
  let payTagClass = 'tag-red';
  if (o.paymentStatus === 'paid') {
    payStatusLabel = '已付款';
    payTagClass = 'tag-green';
  } else if (o.paymentStatus === 'partially_paid') {
    payStatusLabel = '部分付款';
    payTagClass = 'tag-yellow';
  }
      
              return {
    ...o,
    oid,                       // ⭐ 确保有 oid
    displayOid: oid,           // 方便 wxml 用这个显示
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

      const finished = cookedList.length < this.data.pageSize;
      const role = res.role || this.data.role;

      // ⭐ 写入缓存
      const cache = this.data.cache || {};
      cache[cacheKey] = {
        list: newList,
        page: nextPage,
        finished,
        role,
        lastLoadedAt: Date.now(),
      };

    this.setData({
      list: newList,
      page: nextPage,
      finished: cookedList.length < this.data.pageSize,
      role: res.role || this.data.role,  // ⭐ 关键：把云端返回的 role 存起来
    });
  })
          .catch((err) => {
            console.error('fetchOrders error', err);
            wx.showToast({ title: '加载订单失败', icon: 'none' });
          })
          .finally(() => {
            this.setData({ loading: false });
          });
      },
  
    // 搜索框输入
    onKeywordInput(e) {
      this.setData({ keyword: e.detail.value });
    },
  
    // 点击键盘“搜索”
    onSearchConfirm: withThrottle(
      'orders:list:search',
      function () {
        const kw = (this.data.keyword || '').trim();
  
        if (!kw) {
          // 空字符串就等于重置列表
          return this.fetchOrders(true);
        }
  
        // 主播禁止按邮箱搜（有 @ 大概率是邮箱）
        if (this.data.role === 'anchor' && kw.includes('@')) {
          wx.showToast({
            title: '主播不能按邮箱搜索',
            icon: 'none',
          });
          return Promise.resolve();
        }
  
        return this.fetchOrders(true);
      }.bind(this),
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
        return this.fetchOrders(true).finally(() => {
          wx.stopPullDownRefresh();
        });
      }.bind(this),
      1000,
    ),
  
    // 上拉加载更多
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
  console.log('order card dataset =', e.currentTarget.dataset);
  const { oid } = e.currentTarget.dataset;
  if (!oid) {
    wx.showToast({ title: '缺少订单号', icon: 'none' });
    return;
  }

  wx.navigateTo({
    url: `/pages/orders/detail/index?oid=${encodeURIComponent(oid)}`,
  });
},


  });
  