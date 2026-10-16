# MasterGo-to-HTML

目标版本：v1.0.0

第一版

将 MasterGo 设计稿转换为可维护的移动端 HTML/CSS/JavaScript。技能仅包含流程规则，不包含账号凭据、设计素材或运行依赖。

## 安装

在 Codex 中使用：

```text
$skill-installer
安装 https://github.com/chenyan-cc/MasterGo-to-HTML/tree/main/mastergo-to-html
```

固定版本安装：发布 v1.0.0 标签后，可将链接中的 main 替换为 v1.0.0；请先确认仓库 Tags/Releases 中存在该版本。

## 使用

```text
$mastergo-to-html
将这个 MasterGo 设计稿转换为 HTML：[设计稿链接]
```

使用者需要自行配置 MasterGo MCP、设计稿访问权限和浏览器/Playwright 验收能力。已有同名技能时先备份本地修改；本地安装不会自动跟随仓库更新。

## 工作流

访问验证 → 设计读取 → 原尺寸还原 → CSS 与语义整理 → 响应式验收 → 最多三轮修复 → 本地交付。只读原设计稿，同画板后续增量更新。

详细说明见 [SKILL.md](mastergo-to-html/SKILL.md)。
