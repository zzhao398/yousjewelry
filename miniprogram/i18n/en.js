// miniprogram/i18n/en.js
module.exports = {
    common: {
      languageLabel: 'Language',
      lang_zh: '中文',
      lang_en: 'English',
      error: 'Failed to load, please try again later',
    },
    tabbar: {
        home: 'Home',
        orders: 'Orders',
        mine: 'Me',
      },
    home: {
      section_title: 'Anchor Dashboard',
      welcome: 'Welcome back, {{name}}',
  
      pending_label: 'To Ship',
  
      summary_label: 'Summary',
      tag_today: 'Today',
      metric_order_count: 'Orders Today',
      metric_gmv: 'GMV Today',
      metric_to_ship: 'To Ship',
  
      trend_title_prefix: 'Last',           // Last 7 days Trend
      trend_title_suffix: 'Trend',
      trend_subtitle: 'Orders & GMV (by day)',
  
      range_7d: '7 days',
      range_30d: '30 days',
      range_1y: '1 year',
      range_all: 'All',
  
      empty_day_stats: 'No data in current range',
  
      anchor_rank_title: 'Anchor Ranking',
      anchor_rank_subtitle: 'Sorted by GMV (current range)',
      label_order: 'Orders',
      label_gmv: 'GMV',
      empty_anchor_stats: 'No anchor data in current range',
    },
    // ⭐ 登录页文案
  login: {
    logo: 'YOUJEWLRY',
    account_placeholder: 'Username / Phone / Email',
    password_placeholder: 'Password',
    btn_login: 'Log in',
    btn_register_anchor: 'Register as Anchor',
    btn_register_admin: 'Register as Admin',
    toast_need_account: 'Please enter account and password',
    toast_login_success: 'Login successful',
    toast_pending: 'Logged in, waiting for approval',
    toast_rejected: 'Rejected, please update your info and resubmit',
    footer_copyright: '@ YouJewlry All Rights Reserved',
  },

  // ⭐ 注册页文案
  register: {
    title_anchor: 'Anchor Registration',
    title_admin: 'Admin Registration',

    label_name: 'Name',
    placeholder_name: 'Please enter your real name',

    label_displayName: 'Display Name',
    placeholder_displayName: 'Name shown on pages',

    label_loginAccount: 'Login Account',
    placeholder_loginAccount: 'Phone or Email',

    label_password: 'Password',
    placeholder_password: 'Set your password',

    label_confirmPassword: 'Confirm Password',
    placeholder_confirmPassword: 'Enter password again',

    label_phone: 'Phone',
    placeholder_phone: 'Optional',

    label_email: 'Email',
    placeholder_email: 'Optional',

    label_platform: 'Platform',
    placeholder_platform: 'e.g. Douyin / TikTok (optional)',

    label_accountId: 'Account ID',
    placeholder_accountId: 'Optional',

    label_remark: 'Remark',
    placeholder_remark: 'Optional, e.g. strengths, platforms',

    btn_submit: 'Submit',

    toast_need_name: 'Please fill in your name',
    toast_need_loginAccount: 'Please fill in login account',
    toast_need_password: 'Please set a password',
    toast_password_mismatch: 'Passwords do not match',

    modal_title: 'Submitted',
    modal_content_anchor:
      'Your anchor registration has been submitted.\nPlease contact the admin for approval. Once approved, you can log in and view orders.',
    modal_content_admin:
      'Your admin registration has been submitted.\nPlease contact the admin for approval. Once approved, you can log in and view orders.',
  },
  orderCommon: {
    ship_unshipped: 'Unshipped',
    ship_shipped: 'Shipped',
    ship_partial: 'Partially Shipped',

    pay_unpaid: 'Unpaid',
    pay_paid: 'Paid',
    pay_partial: 'Partially Paid',
  },

  ordersList: {
    tab_all: 'All',
    tab_pending: 'Pending',
    tab_unshipped: 'Unshipped',
    tab_unpaid: 'Unpaid',
    tab_paid: 'Paid',
    tab_shipped: 'Shipped',

    search_placeholder: 'Search by OID / Email / PID',

    empty: 'No orders',
    loading: 'Loading…',
    no_more: 'No more',

    toast_load_failed: 'Failed to load orders',
    toast_missing_oid: 'Missing order ID',
    toast_anchor_email_forbidden: 'Anchors cannot search by email',
  },

  orderDetail: {
    loading: 'Loading…',

    order_id_label: 'Order ID:',
    created_at_label: 'Created at:',
    paid_at_label: 'Paid at:',

    section_amount: 'Amount',
    product_amount_label: 'Product total:',
    shipping_price_label: 'Shipping:',
    coupon_price_label: 'Coupon:',
    discount_price_label: 'Discount:',
    fee_price_label: 'Fee:',
    tax_price_label: 'Tax:',
    total_label: 'Total:',

    section_customer: 'Customer',
    customer_name_label: 'Name:',
    customer_email_label: 'Email:',
    customer_country_label: 'Country:',
    customer_ip_label: 'IP:',

    section_shipping: 'Shipping',
    shipping_method_label: 'Shipping method:',
    package_label: 'Package:',
    package_weight_prefix: 'Weight:',
    package_qty_prefix: 'Quantity:',
    address_label: 'Address:',
    tracking_label: 'Tracking No.:',

    section_items: 'Items',
    items_empty: 'No item data',

    section_notes: 'Notes',
    note_customer_label: 'Customer note:',
    note_admin_label: 'Admin note:',

    empty_title: 'No order data',
    empty_btn_reload: 'Reload',

    toast_not_found: 'Order not found',
    toast_load_failed: 'Failed to load order detail',

    default_none: 'None',
    default_dash: '—',
  },
  mine: {
    loading: 'Loading…',

    role_owner: 'Super Admin',
    role_admin: 'Admin',
    role_anchor: 'Anchor',

    label_account: 'Account: ',

    status_pending:
      'Your account is under review. You cannot view order data for now. Please remind the admin to complete the verification.',
    status_approved:
      'Your account has been approved. You can view orders normally.',
    status_rejected:
      'Your registration was rejected. Please contact the administrator.',

    section_admin: 'Management',
    section_account: 'Account',

    admin_anchor_approve: 'Anchor approval',
    admin_anchor_list: 'Anchor management',

    logout: 'Log out',
    logout_title: 'Log out',
    logout_content: 'Are you sure you want to log out?',

    toast_load_failed: 'Failed to load data',
  },
  };
  