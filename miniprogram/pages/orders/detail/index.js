// pages/orders/detail/index.js
//
// 订单详情页：
// - 从 ueeApi 拿 orders.detail（直接读 orders_slim / 或你以后扩展的字段）
// - 在这里把金额 / 标签 / 文本都格式化好，WXML 只负责展示

const { getOrderDetail } = require('../../../utils/ueeApi');
const { log } = require('../../../utils/logger');

function formatTime(sec) {
  if (!sec) return '';
  const d = new Date(Number(sec) * 1000);
  const pad = (n) => (n < 10 ? '0' + n : n);
  const Y = d.getFullYear();
  const M = pad(d.getMonth() + 1);
  const D = pad(d.getDate());
  const h = pad(d.getHours());
  const m = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

Page({
  data: {
    oid: '',
    loading: false,
    order: null,
  },

  onLoad(options) {
    console.log('[order detail onLoad] options =', options);
    const oid = options.oid || '';
    this.setData({ oid });

    if (!oid) {
      wx.showToast({ title: '缺少订单号', icon: 'none' });
      return;
    }

    this.fetchDetail();
  },

  // 拉取订单详情
  fetchDetail() {
    const { oid } = this.data;
    if (!oid) return;

    this.setData({ loading: true });

    log('orders.detail.fetch', { oid });

    // ✅ 关键：只传字符串
    getOrderDetail(oid)
      .then((res) => {
        if (!res) {
          wx.showToast({ title: '未找到该订单', icon: 'none' });
          this.setData({ order: null });
          return;
        }

        // 后端返回的原始订单对象（来自 orders_slim + 你以后扩展的字段）
        const o = res;

        const currency = o.currency || o.Currency || o.PayCurrency || 'USD';

        // ------- 金额相关（尽量兼容 Ueeshop 字段） -------
        const productAmount = Number(
          o.productAmount || o.ProductPrice || 0,
        );
        const shippingPrice = Number(
          o.shippingPrice || o.ShippingPrice || 0,
        );
        const couponPrice = Number(
          o.couponPrice || o.CouponPrice || 0,
        );
        const discountPrice = Number(
          o.discountPrice || o.DiscountPrice || 0,
        );
        const feePrice = Number(
          o.feePrice || o.PayAdditionalFee || 0,
        );
        const taxPrice = Number(
          o.taxPrice || o.TaxPrice || 0,
        );

        const amount = Number(
          o.orderTotalPrice || o.OrderTotalPrice || 0,
        );

        // ------- 状态标签 -------
        let payStatusLabel = '未付款';
        let payTagClass = 'tag-red';
        const payStatus = o.paymentStatus || o.PaymentStatus;
        if (payStatus === 'paid') {
          payStatusLabel = '已付款';
          payTagClass = 'tag-green';
        } else if (payStatus === 'partially_paid') {
          payStatusLabel = '部分付款';
          payTagClass = 'tag-yellow';
        }

        let shipStatusLabel = '未发货';
        let shipTagClass = 'tag-red';
        const shipStatus = o.shippingStatus || o.ShippingStatus;
        if (shipStatus === 'shipped') {
          shipStatusLabel = '已发货';
          shipTagClass = 'tag-green';
        } else if (shipStatus === 'partial') {
          shipStatusLabel = '部分发货';
          shipTagClass = 'tag-yellow';
        }

        // ------- 顾客信息 -------
        const customerName =
          o.customerName ||
          [o.ShippingFirstName, o.ShippingLastName]
            .filter(Boolean)
            .join(' ') ||
          '';

        const customerEmail = o.customerEmail || o.Email || '';
        const customerCountry =
          o.customerCountry ||
          o.ShippingCountry ||
          o.BillCountry ||
          '';

        const customerIp = o.customerIp || o.IP || '';

        // ------- 配送信息 / 地址 -------
        const shippingMethod =
          o.shippingMethod || o.ShippingExpress || '';
        const totalWeight =
          Number(o.totalWeight || o.TotalWeight || 0) || 0;
        const itemCount =
          Number(o.itemCount || o.totalQty || 0) || 0;

        const shippingAddress =
          o.shippingAddress ||
          [
            o.ShippingAddressLine1,
            o.ShippingAddressLine2,
            o.ShippingCity,
            o.ShippingState,
            o.ShippingZipCode,
            o.ShippingCountry,
          ]
            .filter(Boolean)
            .join(' ') ||
          '—';

        const trackingNumber =
          o.trackingNumber || o.TrackingNumber || '—';

        // ------- 商品清单 -------
        const rawItems =
          Array.isArray(o.items) && o.items.length
            ? o.items
            : o.orders_products_list || [];

        const items = rawItems.map((it) => ({
          pic: it.PicPath || it.pic || '',
          name: it.Name || it.name || '',
          sku: it.SKU || it.sku || '',
          qty: Number(it.Qty || it.qty || 0),
          price: Number(it.Price || it.price || 0),
          currency,
        }));

        // ------- 备注 -------
        const customerNote = o.customerNote || o.Comments || '';
        const adminNote = o.adminNote || o.Remarks || '';

        const createdAtText = formatTime(
          o.orderCreatedAt || o.OrderTime,
        );
        const paidAtText = formatTime(o.payTime || o.PayTime);

        const displayOrder = {
          ...o,

          // 顶部
          displayOid: o.oid || o.OId || o._id || oid,
          createdAtText,
          paidAtText,

          // 金额
          currency,
          amount,
          productAmount,
          shippingPrice,
          couponPrice,
          discountPrice,
          feePrice,
          taxPrice,
          displayAmountText: `${currency} ${amount.toFixed(2)}`,

          // 状态
          payStatusLabel,
          payTagClass,
          shipStatusLabel,
          shipTagClass,

          // 顾客
          customerName,
          customerEmail,
          customerCountry,
          customerIp,

          // 配送
          shippingMethod,
          shippingAddress,
          trackingNumber,
          totalWeight,
          itemCount,

          // 备注
          customerNote: customerNote || '无',
          adminNote: adminNote || '无',

          // 商品
          items,
        };

        this.setData({ order: displayOrder });
      })
      .catch((err) => {
        console.error('getOrderDetail error', err);
        wx.showToast({ title: '加载订单详情失败', icon: 'none' });
      })
      .finally(() => {
        this.setData({ loading: false });
      });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.fetchDetail();
    wx.stopPullDownRefresh();
  },
});
