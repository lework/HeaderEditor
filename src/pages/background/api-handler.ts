import browser from 'webextension-polyfill';
import logger from '@/share/core/logger';
import { APIs, TABLE_NAMES_ARR, TABLE_NAMES } from '@/share/core/constant';
import { prefs } from '@/share/core/prefs';
import rules from './core/rules';
import { openURL } from './utils';
import { getDatabase } from './core/db';


function execute(request: any) {
  if (request.method === 'notifyBackground') {
    request.method = request.reason;
    delete request.reason;
  }
  switch (request.method) {
    case APIs.HEALTH_CHECK:
      return new Promise((resolve) => {
        getDatabase()
          .then(() => resolve(true))
          .catch(() => resolve(false));
      });
    case APIs.OPEN_URL:
      return openURL(request);
    case APIs.GET_RULES:
      return Promise.resolve(rules.get(request.type, request.options));
    case APIs.SAVE_RULE:
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        console.log('tabs', tabs);
        tabs.forEach((tab) => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, { method: APIs.SAVE_RULE, rule: request.rule });
          }
        });
      });
      return rules.save(request.rule);
    case APIs.DELETE_RULE:
      return rules.remove(request.type, request.id);
    case APIs.SET_PREFS:
      browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
        console.log('tabs', tabs);
        tabs.forEach((tab) => {
          if (tab.id) {
            browser.tabs.sendMessage(tab.id, { method: APIs.SET_PREFS, key: request.key, value: request.value });
          }
        });
      });
      return prefs.set(request.key, request.value);
    case APIs.UPDATE_CACHE:
      if (request.type === 'all') {
        return Promise.all(TABLE_NAMES_ARR.map((tableName) => rules.updateCache(tableName)));
      } else {
        return rules.updateCache(request.type);
      }
    default:
      break;
  }
  // return false;
}

export default function createApiHandler() {
  browser.runtime.onMessage.addListener((request: any, sender, sendResponse) => {
    console.log('createApiHandler-----', request, sender);

    if (request.method === 'GetData') {
      const response = {
        rules: rules.get(TABLE_NAMES.sendHeader, { enable: true }),
        enable: !prefs.get('disable-all'),
      };

      logger.debug('createApiHandler-----', response);
      sendResponse(response);
    }


    logger.debug('Background Receive Message', request);
    if (request.method === 'batchExecute') {
      const queue = request.batch.map((item) => {
        const res = execute(item);
        if (res) {
          return res;
        }
        return Promise.resolve();
      });
      return Promise.allSettled(queue);
    }
    return execute(request);
  });
}
