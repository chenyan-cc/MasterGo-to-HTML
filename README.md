# MasterGo-to-HTML

当前版本：v1.0.4

将 MasterGo 设计稿转换为可维护的移动端 HTML/CSS/JavaScript。技能仅包含流程规则，不包含账号凭据、设计素材或运行依赖。

## 安装

在 Codex 中使用：

```text
$skill-installer
安装 https://github.com/chenyan-cc/MasterGo-to-HTML/tree/v1.0.4/mastergo-to-html
```

以上链接固定安装v1.0.4；需要主分支最新内容时，可将v1.0.4替换为main。已有同名技能时，安装器不会直接覆盖；应先备份并对比本地修改，再更新全部技能文件。

## 使用

```text
$mastergo-to-html
将这个 MasterGo 设计稿转换为 HTML：[设计稿链接]
```

使用者需要自行配置 MasterGo MCP、设计稿访问权限和浏览器/Playwright 验收能力。已有同名技能时先备份本地修改；本地安装不会自动跟随仓库更新。

## 工作流

访问验证 → 项目规则与设计读取 → 原尺寸还原 → CSS 与语义整理及适配 → 批量验收与细节放大 → 最多三轮修复 → 本地交付。只读原设计稿，同画板后续增量更新。

v1.0.4默认在320–440px手机视口铺满，优先复用项目适配约定；新增局部放大检查、字体款式核对及跨尺寸固定字重验证。QA脚本可检查页面铺满、文字溢出和滚动末端，仍不能替代视觉验收。详见[更新记录](CHANGELOG.md)。

详细说明见 [SKILL.md](mastergo-to-html/SKILL.md)。
