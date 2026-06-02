import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  zip: {
    artifactTemplate: 'mochi-cast-{{version}}-{{browser}}.zip',
  },
  manifest: {
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'zh_CN',
    permissions: ['storage', 'activeTab', 'contextMenus', 'scripting'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: 'icon16.png',
      32: 'icon32.png',
      48: 'icon48.png',
      96: 'icon96.png',
      128: 'icon128.png',
    },
    action: {
      default_popup: 'popup/index.html',
      default_icon: {
        16: 'icon16.png',
        32: 'icon32.png',
        48: 'icon48.png',
      },
    },
    options_ui: {
      page: 'options/index.html',
      open_in_tab: true,
    },
  },
});
