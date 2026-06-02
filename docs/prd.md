# 麻薯投屏 (Mochi Cast) 产品需求文档

> 版本 v0.1 | 状态：已实现 MVP 骨架

完整 PRD 详见项目规划文档。本文档为开发用精简版。

## 产品概述

开源浏览器扩展，通过 DLNA/UPnP 将网页视频投屏到局域网智能电视（小米、TCL、Sony 等）。

- **形态**：Chrome / Edge 扩展 (Manifest V3)
- **协议**：DLNA MediaRenderer + UPnP AVTransport
- **v1 范围**：可直链 MP4/WebM；不支持 DRM、HLS 转码、Miracast

## MVP 功能 (P0)

| ID | 功能 | 状态 |
|----|------|------|
| F-001 | 设备发现（子网扫描 + 手动 IP） | ✅ |
| F-002 | 视频嗅探 | ✅ |
| F-003 | 一键投屏 | ✅ |
| F-004 | 播放控制（播放/暂停/停止） | ✅ |
| F-005 | 设备记忆 | ✅ |
| F-006 | 基础设置（语言、超时） | ✅ |

## 技术架构

- `@mochi-cast/dlna-core` — 可复用 DLNA 协议库
- `apps/extension` — WXT + TypeScript 浏览器扩展
- 设备发现：子网 HTTP 探测（SSDP UDP 在 MV3 不可用，见 [ssdp-validation.md](./ssdp-validation.md)）

## 非目标 (v1)

- Chromecast / 小米妙播专有协议
- Firefox 支持
- 桌面伴侣 / HLS 转码
- DRM 绕过

## 里程碑

| 阶段 | 交付物 |
|------|--------|
| M1 | DLNA 核心 + SSDP 验证文档 |
| M2 | 扩展 MVP（嗅探 + Popup + 控制） |
| M3 | 真机兼容测试 + compatibility.md |
| M4 | GitHub 发布 + Chrome Web Store |

## KPI（发布后 3 个月）

- GitHub Stars 500+
- 小米/TCL MP4 直链成功率 > 85%
- 兼容设备文档 20+ 条
