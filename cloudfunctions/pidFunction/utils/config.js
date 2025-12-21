// cloudfunctions/pidFunction/config.js

let local = {};
try {
  local = require('./config.local.js');
} catch (e) {
  local = {};
}

const IS_MOCK =
  typeof local.IS_MOCK === 'boolean'
    ? local.IS_MOCK
    : true;

const API_NAME = 'openapi';

const ACCESS_NUMBER = local.ACCESS_NUMBER || 'DEV_NUMBER';
const SECRET = local.SECRET || 'DEV_SECRET';

const BASE_URL_MOCK =
  local.BASE_URL_MOCK ||
  'https://youjewelry.free.beeceptor.com/gateway/';

const BASE_URL_PROD =
  local.BASE_URL_PROD ||
  'https://www.yousjewelry.com/gateway/';

const API_FROM = local.API_FROM || '';

const getBaseUrl = () => (IS_MOCK ? BASE_URL_MOCK : BASE_URL_PROD);

module.exports = {
  IS_MOCK,
  API_NAME,
  ACCESS_NUMBER,
  SECRET,
  BASE_URL_MOCK,
  BASE_URL_PROD,
  API_FROM,
  getBaseUrl,
};
