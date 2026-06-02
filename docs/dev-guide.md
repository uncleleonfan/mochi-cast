# 开发指南

## 环境要求

- Node.js 18+
- pnpm 9+
- Chrome 120+ 或 Edge 120+

## 快速开始

```bash
# 安装依赖
pnpm install

# 构建协议库
pnpm --filter @mochi-cast/dlna-core build

# 开发模式（热重载扩展）
pnpm dev

# 在 Chrome 中加载：chrome://extensions → 开发者模式 → 加载已解压的扩展程序
# 选择 apps/extension/.output/chrome-mv3
```

## 项目结构

```
mochi-cast/
├── apps/extension/       # 浏览器扩展 (WXT)
├── packages/dlna-core/   # DLNA/UPnP 协议库
└── docs/                 # 文档
```

## 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 扩展开发模式 |
| `pnpm build` | 构建全部包 |
| `pnpm test` | 运行单元测试 |
| `pnpm --filter @mochi-cast/extension zip` | 打包扩展 zip |

## 本地测试投屏

1. 确保电脑与电视在同一 Wi-Fi
2. 在电视上开启 DLNA / 无线投屏
3. 获取电视 IP（电视网络设置）
4. 打开任意含 MP4 直链的测试页，例如：

```html
<!-- test.html -->
<video src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" controls></video>
```

5. 加载扩展，打开 Popup，扫描或手动添加电视 IP
6. 选择检测到的视频，点击「开始投屏」

## 真机测试清单

- [ ] 子网扫描能否发现电视
- [ ] 手动 IP 添加是否成功
- [ ] MP4 直链投屏播放
- [ ] 暂停 / 继续 / 停止
- [ ] 设备记忆是否生效

将结果提交到 [compatibility.md](./compatibility.md)。

## 调试

- 扩展 Service Worker：`chrome://extensions` → 麻薯投屏 → Service Worker
- Content Script：目标页面 DevTools → Console
- 启用 Options 中的「调试日志」

## 架构说明

### 消息流

```
Popup / Options
    ↕ chrome.runtime.sendMessage
Background (Service Worker)
    ↕ chrome.tabs.sendMessage
Content Script (视频嗅探)
    ↕ HTTP/SOAP (fetch)
DLNA 电视
```

### DLNA 控制

投屏使用 UPnP AVTransport SOAP 动作：

1. `SetAVTransportURI` — 设置媒体 URL
2. `Play` — 开始播放

控制 URL 从电视的 `description.xml` 解析。

## 发布

```bash
pnpm build
pnpm --filter @mochi-cast/extension zip
```

产物位于 `apps/extension/.output/`。

Chrome Web Store 上架需：

- 开发者账号（$5 一次性）
- 隐私政策 URL（见 `apps/extension/public/privacy-policy.html`）
- 权限说明（`<all_urls>` 用于视频嗅探与局域网 SOAP）
