// miniprogram/pages/admin/product-pid/index.js

const { callByName } = require('../../../utils/request');
const i18n = require('../../../utils/i18n');

Page({
  data: {
    syncing: false,

    list: [],        // 全量 [{ pid, name }]
    displayList: [], // 过滤后
    total: 0,

    keyword: '',

    lang: i18n.getCurrentLang(),
    tProductPid: i18n.getDict().productPid,
  },

  refreshI18n() {
    const dict = i18n.getDict();
    this.setData({
      lang: i18n.getCurrentLang(),
      tProductPid: dict.productPid,
    });
  },

  onShow() {
    this.refreshI18n();
  },

  // 点击一次：拉 Ueeshop → 写库 → 返回列表
  onSyncTap() {
    if (this.data.syncing) return Promise.resolve();

    this.setData({ syncing: true });

    return callByName('pidFunction', { action: 'pid.sync' })
      .then((res) => {
        // 兼容：wx.cloud.callFunction 标准返回是 { result }
        const payload = (res && res.result) ? res.result : res;

        if (!payload || payload.code !== 0) {
          throw new Error((payload && payload.msg) || 'PID_SYNC_FAILED');
        }

        const data = payload.data || {};
        const list = Array.isArray(data.list) ? data.list : [];
        const total = Number(data.total || list.length);

        this.setData(
          {
            list,
            total,
          },
          () => this.applyFilter(),
        );

        wx.showToast({
          title: this.data.tProductPid.toast_ok.replace('{{n}}', String(total)),
          icon: 'success',
          duration: 2000,
        });
      })
      .catch((err) => {
        console.error('pid.sync error', err);
        wx.showToast({
          title: err.message || this.data.tProductPid.toast_failed,
          icon: 'none',
        });
      })
      .finally(() => {
        this.setData({ syncing: false });
      });
  },

  onKeywordInput(e) {
    this.setData({ keyword: e.detail.value }, () => this.applyFilter());
  },

  onKeywordConfirm() {
    this.applyFilter();
  },

  onClearTap() {
    this.setData({ keyword: '' }, () => this.applyFilter());
  },

  applyFilter() {
    const kw = String(this.data.keyword || '').trim().toLowerCase();
    const list = Array.isArray(this.data.list) ? this.data.list : [];

    if (!kw) {
      this.setData({ displayList: list });
      return;
    }

    const filtered = list.filter((it) => {
      const pid = String(it.pid || '').toLowerCase();
      const name = String(it.name || '').toLowerCase();
      return pid.includes(kw) || name.includes(kw);
    });

    this.setData({ displayList: filtered });
  },
});
