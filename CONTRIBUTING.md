# Contributing to Mochi Cast

感谢你对麻薯投屏的关注！以下是参与贡献的指南。

## 如何贡献

### 报告 Bug

使用 [Bug Report](../../issues/new?template=bug_report.md) 模板，请包含：

- 浏览器版本
- 扩展版本
- 电视品牌/型号
- 复现步骤
- 控制台错误信息

### 设备兼容性

使用 [Device Compatibility](../../issues/new?template=device_compat.md) 模板提交测试结果，我们会汇总到 [docs/compatibility.md](docs/compatibility.md)。

### 功能建议

使用 [Feature Request](../../issues/new?template=feature_request.md) 模板。

### 代码贡献

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feat/your-feature`
3. 安装依赖并开发：

```bash
pnpm install
pnpm dev
```

4. 确保通过测试与类型检查：

```bash
pnpm test
pnpm typecheck
pnpm build
```

5. 提交 Pull Request，描述变更动机与测试方式

## 开发规范

- 使用 TypeScript，保持 strict 模式
- 遵循现有代码风格，最小化变更范围
- 新功能需更新相关文档
- commit message 使用英文，格式：`feat: ...` / `fix: ...` / `docs: ...`

## 真机测试

DLNA 投屏功能必须在真实电视环境下验证。若你无法访问测试设备，请在 PR 中说明，并尽量提供单元测试覆盖协议层逻辑。

## 行为准则

- 尊重他人，友好交流
- 不得贡献 DRM 绕过、盗版相关功能
- 遵守各视频平台的 Terms of Service

## 许可证

贡献的代码以 [MIT](LICENSE) 许可证发布。
