// miniprogram/i18n/zh.js
module.exports = {
    common: {
      languageLabel: '语言',
      lang_zh: '中文',
      lang_en: 'English',
      error: '加载失败，请稍后重试',
    },
    tabbar: {
        home: '首页',
        orders: '订单',
        mine: '我的',
      },
    home: {
      section_title: '主播概况',
      welcome: '欢迎回来，{{name}}',
  
      pending_label: '待发货',
  
      summary_label: '概况',
      tag_today: '今天',
      metric_order_count: '今日订单',
      metric_gmv: '今日 GMV',
      metric_to_ship: '待发货',
  
      trend_title_prefix: '近',            // 近 7 天 趋势
      trend_title_suffix: '趋势',
      trend_subtitle: '订单数 & GMV（按天）',
  
      range_7d: '7天',
      range_30d: '30天',
      range_1y: '1年',
      range_all: '全部',
  
      empty_day_stats: '当前时间范围内没有订单数据',
  
      anchor_rank_title: '主播榜单',
      anchor_rank_subtitle: '按 GMV 排序（当前时间范围）',
      label_order: '订单',
      label_gmv: 'GMV',
      empty_anchor_stats: '当前时间范围内暂无主播数据',
    },
    // ⭐ 登录页文案
  login: {
    logo: 'YOUJEWLRY',
    account_placeholder: '用户名 / 手机号 / 邮箱',
    password_placeholder: '密码',
    btn_login: '登录',
    btn_register_anchor: '注册为主播',
    btn_register_admin: '注册为管理员',
    toast_need_account: '请输入账号和密码',
    toast_login_success: '登录成功',
    toast_pending: '已登录，等待管理员审核',
    toast_rejected: '审核未通过，请修改资料后重新提交',
    footer_copyright: '@ YouJewlry 版权所有',
  },

  // ⭐ 注册页文案
  register: {
    title_anchor: '主播注册',
    title_admin: '管理员注册',

    label_name: '姓名',
    placeholder_name: '请输入真实姓名',

    label_displayName: '显示昵称',
    placeholder_displayName: '页面展示时的名字',

    label_loginAccount: '登录账号',
    placeholder_loginAccount: '手机号或邮箱',

    label_password: '密码',
    placeholder_password: '请设置密码',

    label_confirmPassword: '确认密码',
    placeholder_confirmPassword: '请再输入一次密码',

    label_phone: '手机号',
    placeholder_phone: '选填',

    label_email: '邮箱',
    placeholder_email: '选填',

    label_platform: '平台',
    placeholder_platform: '如 抖音 / TikTok（选填）',

    label_accountId: '账号ID',
    placeholder_accountId: '选填',

    label_remark: '备注',
    placeholder_remark: '选填，例如擅长平台、商品等',

    btn_submit: '提交注册',

    toast_need_name: '请填写姓名',
    toast_need_loginAccount: '请填写登录账号',
    toast_need_password: '请设置密码',
    toast_password_mismatch: '两次密码不一致',

    modal_title: '提交成功',
    modal_content_anchor:
      '你已提交主播注册申请。\n请联系管理员完成审核，通过后即可登录并查看订单。',
    modal_content_admin:
      '你已提交管理员注册申请。\n请联系管理员完成审核，通过后即可登录并查看订单。',
  },
   // 订单通用状态文字（列表 + 详情共用）
   orderCommon: {
    ship_unshipped: '未发货',
    ship_shipped: '已发货',
    ship_partial: '部分发货',

    pay_unpaid: '未付款',
    pay_paid: '已付款',
    pay_partial: '部分付款',
  },

  // 订单列表页
  ordersList: {
    tab_all: '所有',
    tab_pending: '待处理',
    tab_unshipped: '未发货',
    tab_unpaid: '未付款',
    tab_paid: '已付款',
    tab_shipped: '已发货',

    search_placeholder: '搜索订单号 / 邮箱 / PID',

    empty: '暂无订单',
    loading: '正在加载…',
    no_more: '没有更多了',

    toast_load_failed: '加载订单失败',
    toast_missing_oid: '缺少订单号',
    toast_anchor_email_forbidden: '主播不能按邮箱搜索',
  },

  // 订单详情页
  orderDetail: {
    loading: '加载中…',

    order_id_label: '订单号：',
    created_at_label: '下单时间：',
    paid_at_label: '付款时间：',

    section_amount: '金额信息',
    product_amount_label: '产品总额：',
    shipping_price_label: '运费：',
    coupon_price_label: '优惠券：',
    discount_price_label: '折扣：',
    fee_price_label: '手续费：',
    tax_price_label: '税费：',
    total_label: '总计：',

    section_customer: '顾客',
    customer_name_label: '姓名：',
    customer_email_label: '邮箱：',
    customer_country_label: '国家：',
    customer_ip_label: 'IP：',

    section_shipping: '配送信息',
    shipping_method_label: '物流方式：',
    package_label: '包裹：',
    package_weight_prefix: '重量：',
    package_qty_prefix: '产品数量：',
    address_label: '地址：',
    tracking_label: '运单号：',

    section_items: '商品清单',
    items_empty: '暂无商品数据',

    section_notes: '备注',
    note_customer_label: '顾客备注：',
    note_admin_label: '后台备注：',

    empty_title: '暂无订单数据',
    empty_btn_reload: '重新加载',

    toast_not_found: '未找到该订单',
    toast_load_failed: '加载订单详情失败',

    default_none: '无',
    default_dash: '—',
  },
  mine: {
    loading: '加载中…',

    role_owner: '超级管理员',
    role_admin: '管理员',
    role_anchor: '主播',

    label_account: '账号：',

    status_pending:
      '你的账号正在审核中，暂时无法查看订单数据，请提醒管理员完成认证。',
    status_approved: '账号已通过审核，可以正常查看订单。',
    status_rejected: '你的注册申请未通过，请联系管理员。',

    section_admin: '管理功能',
    section_account: '账号',

    admin_anchor_approve: '主播认证审核',
    admin_anchor_list: '主播信息管理',

    logout: '退出登录',
    logout_title: '退出登录',
    logout_content: '确定要退出当前账号吗？',

    toast_load_failed: '加载失败',
    admin_product_pid: '产品 PID 查询',
  },

  // 在 module.exports = { ... } 里加：
productPid: {
  title: '产品 PID 查询',
  sub: '点击按钮后从 Ueeshop 拉取产品列表，写入云数据库并返回结果。',
  btn_sync: '点击查询',
  loading: '查询中...',
  search_placeholder: '输入产品名或 PID 过滤（本地）',
  col_name: '产品名称',
  col_pid: 'PID',
  empty: '暂无数据，点击上方按钮开始查询',
  no_match: '没有匹配结果',
  toast_ok: '已更新，共 {{n}} 条',
  toast_failed: '查询失败',
  total_prefix: '共 ',
total_suffix: ' 条',

},


  };
  