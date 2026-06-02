# 麻薯投屏 / Mochi Cast

[![CI](https://github.com/mochi-cast/mochi-cast/actions/workflows/ci.yml/badge.svg)](https://github.com/mochi-cast/mochi-cast/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)

**麻薯投屏**是一款开源浏览器扩展，让你在一键将网页视频投送到同一 Wi-Fi 下的智能电视——支持小米、TCL、Sony、LG 等 DLNA 电视，无需安装电视端 App。

[English](#english) | [中文](#中文)

---

## 中文

### 特性

- 局域网 DLNA/UPnP 投屏，适配国内主流电视品牌
- 自动检测网页中的 `<video>` 及媒体链接
- 子网设备扫描 + 手动 IP 添加（双模式发现）
- 播放 / 暂停 / 停止控制
- 开源可审计，数据仅存本地
- 中英文界面

### 快速安装

**从源码加载（开发/测试）**

```bash
git clone https://github.com/mochi-cast/mochi-cast.git
cd mochi-cast
pnpm install
pnpm build
# Chrome → chrome://extensions → 开发者模式 → 加载已解压的扩展程序
# 选择 apps/extension/.output/chrome-mv3
```

**Chrome Web Store**（即将上架）

### 使用方法

1. 电脑与电视连接**同一 Wi-Fi**
2. 在电视上开启**无线投屏 / DLNA**（小米：设置 → 连接 → 无线投屏）
3. 在浏览器中打开含视频的网页并**开始播放**
4. 点击麻薯投屏图标 → **扫描**或**添加电视 IP** → 选择视频 → **开始投屏**

### 支持的视频

| 类型 | 支持 |
|------|------|
| MP4 直链 (H.264) | ✅ 推荐 |
| WebM | ⚠️ 视电视而定 |
| HLS (m3u8) | ⚠️ 电视需原生支持 |
| DRM (Netflix 等) | ❌ |
| blob: 本地 blob URL | ❌ |

### 电视设置

<details>
<summary>小米电视</summary>

1. 设置 → 连接 → 无线投屏 → 开启
2. 设置 → 网络 → 网络信息 → 记下 IP 地址
3. 若自动扫描未发现，在插件中使用「添加 IP」

</details>

<details>
<summary>TCL 电视</summary>

1. 设置 → 网络 → 多屏互动 → 开启
2. 手动添加电视 IP 进行投屏

</details>

更多型号见 [设备兼容性列表](docs/compatibility.md)。

### 技术说明

Chrome MV3 扩展无法使用 UDP 组播，因此采用**子网 HTTP 探测**替代 SSDP 自动发现。完整分析见 [SSDP 验证报告](docs/ssdp-validation.md)。

核心协议库 `@mochi-cast/dlna-core` 可独立用于其他项目。

### 文档

- [产品需求文档 (PRD)](docs/prd.md)
- [开发指南](docs/dev-guide.md)
- [设备兼容性](docs/compatibility.md)
- [贡献指南](CONTRIBUTING.md)

### 免责声明

麻薯投屏与小米、TCL 等品牌无官方关联。请仅投屏您有权观看的内容。本软件按「原样」提供，不提供任何形式的保证。

---

## English

### Features

- Cast web videos to DLNA smart TVs on your local network
- Auto-detect videos from web pages
- Subnet scan + manual IP device discovery
- Playback controls (play / pause / stop)
- Open source, privacy-first (local storage only)
- Chinese & English UI

### Install from source

```bash
git clone https://github.com/mochi-cast/mochi-cast.git
cd mochi-cast
pnpm install && pnpm build
# Load apps/extension/.output/chrome-mv3 in chrome://extensions
```

### Supported browsers

- Google Chrome 120+
- Microsoft Edge 120+

### License

[MIT](LICENSE)

---

Made with care for home streaming.
