// miniprogram/utils/i18n.js
const zh = require('../i18n/zh');
const en = require('../i18n/en');

const LANG_ZH = 'zh';
const LANG_EN = 'en';
const DEFAULT_LANG = LANG_ZH;

const DICT = {
  [LANG_ZH]: zh,
  [LANG_EN]: en,
};

function getCurrentLang() {
  const lang = wx.getStorageSync('lang');
  if (lang === LANG_ZH || lang === LANG_EN) return lang;
  return DEFAULT_LANG;
}

function setCurrentLang(lang) {
  if (lang !== LANG_ZH && lang !== LANG_EN) return;
  wx.setStorageSync('lang', lang);
}

function getDict(lang) {
  const useLang = lang || getCurrentLang();
  return DICT[useLang] || DICT[DEFAULT_LANG];
}

module.exports = {
  LANG_ZH,
  LANG_EN,
  getCurrentLang,
  setCurrentLang,
  getDict,
};
