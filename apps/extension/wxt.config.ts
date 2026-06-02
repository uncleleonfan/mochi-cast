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
    permissions: ['storage', 'activeTab', 'contextMenus', 'system.network'],
    host_permissions: ['<all_urls>'],
    icons: {
      16: 'icon.svg',
      32: 'icon.svg',
      48: 'icon.svg',
      96: 'icon.svg',
      128: 'icon.svg',
    },
    action: {
      default_popup: 'popup/index.html',
      default_icon: {
        16: 'icon.svg',
        32: 'icon.svg',
        48: 'icon.svg',
      },
    },
    options_ui: {
      page: 'options/index.html',
      open_in_tab: true,
    },
  },
});
