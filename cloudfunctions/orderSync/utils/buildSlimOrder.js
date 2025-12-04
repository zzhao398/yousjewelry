// cloudfunctions/orderSync/utils/buildSlimOrder.js

function toSec(ts) {
    if (!ts) return 0;
    const n = Number(ts);
    return Number.isFinite(n) ? n : 0;
  }
  
  function buildSlimOrder(uOrder) {
    // uOrder 可能是 Ueeshop 原始结构，也可能上层已经只传了 orders
    const order = uOrder.orders || uOrder;
    const productList = uOrder.orders_products_list || uOrder.items || [];
    const pkgList = uOrder.orders_package_info || [];
  
    // ---------- 1. 订单号 ----------
    const rawOid =
      order.OId ||
      order.Oid ||
      order.oid ||
      order.id ||
      '';
  
    const oid = String(rawOid || '').trim();
    if (!oid) {
      console.warn('[buildSlimOrder] missing OId, raw order =', order);
      throw new Error('buildSlimOrder: order missing OId');
    }
  
    // ---------- 2. 时间 ----------
    const createdSec = toSec(order.OrderTime);
    const updatedSec = toSec(order.UpdateTime);
    const paySec = toSec(order.PayTime);
  
    // ---------- 3. 金额相关 ----------
    // 产品金额：ProductPrice 是商品总价
    const productAmount = Number(order.ProductPrice || 0);
  
    // 运费：订单级 ShippingPrice
    const shippingPrice = Number(order.ShippingPrice || 0);
  
    // 税费
    const taxPrice = Number(order.TaxPrice || 0);
  
    // 优惠券金额（单独存，方便前端展示“优惠券”一行）
    const couponPrice = Number(order.CouponPrice || 0);
  
    // 折扣金额（不再把优惠券加进来）
    const discountPrice = Number(order.DiscountPrice || 0);
  
    // 手续费：支付手续费 + 额外费用
    const feePrice =
      Number(order.PayFeePrice || 0) +
      Number(order.PayAdditionalFee || 0);
  
    // 总金额：优先用 OrderTotalPrice，没有就退回 PayTotalPrice
    const orderTotalPrice = Number(
      order.OrderTotalPrice != null
        ? order.OrderTotalPrice
        : order.PayTotalPrice || 0,
    );
  
    // ---------- 4. 配送信息 ----------
    const firstPkg = Array.isArray(pkgList) && pkgList.length > 0 ? pkgList[0] : {};
  
    const shippingMethod =
      firstPkg.ShippingExpress ||
      order.ShippingExpress ||
      '';
  
    const trackingNumber =
      firstPkg.TrackingNumber ||
      order.TrackingNumber ||
      '';
  
    const shippingAddress = [
      order.ShippingAddressLine1,
      order.ShippingAddressLine2,
      order.ShippingCity,
      order.ShippingState,
      order.ShippingZipCode,
      order.ShippingCountry,
    ]
      .filter(Boolean)
      .join(' ');
  
    // 包裹重量 & 产品数量，用来在“包裹”卡片里展示
    const packageWeight = Number(firstPkg.Weight || order.TotalWeight || 0);
  
    const packageQty = (Array.isArray(productList) ? productList : [])
      .reduce((sum, it) => sum + Number(it.Qty || 0), 0);
  
    // ---------- 5. 客户信息 / 备注 ----------
    const customerName = [
      order.ShippingFirstName || '',
      order.ShippingLastName || '',
    ]
      .filter(Boolean)
      .join(' ');
  
    const customerEmail = order.Email || '';
  
    const customerCountry =
      order.ShippingCountry ||
      order.BillCountry ||
      '';
  
    const customerNote = order.Comments || ''; // 顾客备注
    const adminNote = order.Remarks || '';     // 后台备注
  
    const currency = order.Currency || order.PayCurrency || 'USD';
  
    // ---------- 6. 商品清单（轻量版） ----------
    const items = (Array.isArray(productList) ? productList : []).map((it) => ({
      pic: it.PicPath || '',
      name: it.Name || '',
      sku: it.SKU || '',
      qty: Number(it.Qty || 0),
      price: Number(it.Price || 0),
      currency,
    }));
  
    // ---------- 7. pidList ----------
    const pidList = (Array.isArray(productList) ? productList : [])
      .map((it) =>
        String(
          it.ProductId ||
          it.ProductID ||
          it.product_id ||
          it.ProductNo ||
          '',
        ).trim(),
      )
      .filter(Boolean);
  
    // ---------- 8. 返回瘦表记录 ----------
    return {
      // 主键
      oid,
  
      // 时间
      orderCreatedAt: createdSec,
      orderDate: createdSec
        ? new Date(createdSec * 1000).toISOString().slice(0, 10)
        : '',
      sourceUpdatedAt: updatedSec,
      payTime: paySec,
  
      // 状态
      orderStatus: Number(order.OrderStatus || 0),
      paymentStatus: order.PaymentStatus || '',
      shippingStatus: order.ShippingStatus || '',
  
      // 金额（前端详情页会直接用这些字段）
      orderTotalPrice,
      productAmount,
      shippingPrice,
      taxPrice,
      couponPrice,
      discountPrice,
      feePrice,
  
      // 客户信息
      customerEmail,
      customerCountry,
      customerName,
  
      // 币种
      currency,
  
      // 配送信息
      shippingMethod,
      trackingNumber,
      shippingAddress,
      packageWeight,
      packageQty,
  
      // 备注
      customerNote,
      adminNote,
  
      // 商品
      items,
      pidList,
  
      // 下面这些还是交给 upsertOne / 其它逻辑补：
      // anchorIdList / visibleToAnchors / channelType / anchorCommissionAmount ...
    };
  }
  
  module.exports = {
    toSec,
    buildSlimOrder,
  };
  