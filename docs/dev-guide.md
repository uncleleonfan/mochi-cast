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

## 调试日志

1. 打开扩展 **设置** → 勾选 **启用调试日志** → 保存
2. 在 Popup 点击 **扫描** 或 **添加 IP**
3. 回到设置页点击 **刷新日志**，或打开 `chrome://extensions` → 麻薯投屏 → **Service Worker** → Console

日志会标明各阶段是否成功，例如：

| 日志事件 | 含义 |
|----------|------|
| `network / chrome.system.network unavailable` | macOS/Windows 无法用系统 API 猜网段（正常） |
| `network / WebRTC ICE finished` | 是否从 ICE 得到本机网段 |
| `probe / probe_error` | 对该 IP 的 HTTP 请求失败（超时、拒绝等） |
| `probe / probe_http_status` | 有响应但非 200 |
| `probe / probe_not_renderer` | 有 XML 但不是 MediaRenderer |
| `probe / probe_found` | 发现 DLNA 电视 |
| `probe / probe_http_forbidden_but_xml` | HTTP 403 但正文仍是 UPnP XML（已兼容） |
| `probe / probe_http_status` + `userAgent` | 某组 DLNA 请求头仍被拒绝 |
| `discovery / session_end` | 扫描结束与设备列表 |

若提示 **HTTP 403**：电视能连通但拒绝了客户端。扩展会自动换用 DLNA User-Agent 重试；请在电视上重新开启无线投屏/DLNA，必要时重启电视或清除旧的投屏配对。

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
4. 打开任意含 **MP4 直链** 的测试页，例如：

```html
<!-- test.html -->
<video src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" controls></video>
```

5. **先播放视频**，再打开 Popup 点 **↻ 刷新**（或粘贴直链到「添加链接」）
6. 扫描或手动添加电视 IP，选择视频，点击「开始投屏」

**视频检测说明**：仅支持 `http(s)` 直链（页面 `<video>`、`m3u8`、网络请求捕获）。`blob:`、YouTube、Netflix 等 DRM 页面无法自动检测，请用 Popup 下方 **添加链接** 粘贴可访问的 MP4 URL。

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
