# 首次准备与可复用工具

## 环境通过条件

- 设计通道：默认选择 Vibe 前端导出能力；只读请求实际成功读取目标文件/画板才算连接通过。工具命名以当前签名为准。Magic 是备选，不要求同时安装；用户指定路线优先。不在本技能中猜端口、认证配置或自动安装 MCP。
- 浏览器：现有 Node.js、Playwright 与 Chrome/Chromium，或宿主允许且能读取、截图、控制视口的工具。先复用已知运行时，不自动下载。浏览器执行权限和 MCP 权限分别验证。
- 资源：导出的结构、截图和素材对应同一画板，文件对当前执行环境可读。准备目标实际使用的字体及字重，分发字体文件前确认允许嵌入。
- 输出：工作区可写；桌面目录已按宿主方式定位，实际复制时按权限流程执行。静态 HTML 优先 file://，无需预装框架、构建工具或 HTTP 服务。

## 字体预检（布局修复前）

选择关键数字、普通正文、强调文字和混排文字各一个实际节点，记录设计中的字体名、字重、字号、行高，再检查浏览器实际使用的字体。`getComputedStyle` 和 `document.fonts.check` 不能证明真实字形来源。Chromium 可通过 CDP 的 `CSS.getPlatformFontsForNode` 记录 PostScript 名、字形数和自定义字体标志；混排可能合理使用多个字体，不把“预期字体出现”当作全部字符均正确。

当字体存在但粗细不对，先检查静态字体文件的真实字重及映射。例如部分 MiSans Latin 文件使用 330、380、520，而不是惯常的 400、500、600。不要将这个例子套用到其他字体，也不要盲目降低 CSS 数值。存在可用且允许嵌入的字体时，用 `@font-face` 为各实际字重显式指定文件；可变字体按真实轴范围声明。复核数字宽度、换行和中英文回退。缺少证据时报告缺项，不承诺等价还原。

## 统一浏览器入口

`scripts/qa.cjs` 不安装依赖，不修改 HTML。使用已验证的 Node.js 和 Playwright 运行时（必要时设置 NODE_PATH），传入 JSON 配置文件：

```json
{
  "page": "/absolute/project/design.html",
  "outputDir": "/absolute/project/qa",
  "browserExecutable": "/absolute/path/to/chrome",
  "phase": "initial",
  "baselineWidth": 393,
  "widths": [393, 320],
  "screenshotWidths": [393, 320],
  "fontSamples": [
    {"selector": ".quote-price", "expectedPostScriptName": ""}
  ]
}
```

```sh
node /absolute/skill/scripts/qa.cjs /absolute/project/qa-config.json
```

将示例宽度替换为真实画板宽度，选择器须唯一且指向文字节点。首次未知 PostScript 名可留空，从实际结果与设计、字体文件核对；不能将浏览器第一次错误匹配的结果直接当作预期。最终批次覆盖技能要求的全部宽度，中间批次只覆盖受影响宽度；截图只留必要尺寸。

脚本在一个浏览器进程中检查本地页面，输出每个宽度的资源/控制台、页面宽度、标题、缺失 alt、基准宽度字体证据及选定截图。等待有上限，浏览器失败也保存错误报告。退出码 1 表示执行或技术检查失败；退出码 0 仍可能包含 needs-review。`visualVerdict` 始终是 not-reviewed：必须实际查看截图再在项目报告中判定。该脚本不替代交互测试、背景图片就绪检查、逐区视觉验收、语义审核或 HTTP 页面检查；这些按实际页面补充，不扩大脚本成任意代码执行入口。

## 项目记录与交付核对

在工作区保存一份精简项目记录（JSON 或已有报告均可）：设计链接与画板身份、MCP 路线、基准宽度、源目录和交付目录、运行时路径、浏览器版本、QA 配置路径、最后报告、未解决问题、阶段起止时间。环境记录是复用线索，跨会话仍需验证受影响状态，不作为永久健康证明。不要保存凭据或将本机路径配置发布进技能仓库。

分别记录工作区修改、QA 完成和桌面同步状态。先整理准确的交付相对路径清单（JSON 数组，包含 HTML、CSS、素材及必要报告），复制前检查目标是否有人为改动，复制后执行：

```sh
python3 /absolute/skill/scripts/verify-delivery.py /absolute/source /absolute/desktop/design /absolute/project/delivery-files.json
```

此脚本只比较清单内文件的 SHA-256，不复制、不删除、不核验清单是否完整。只有返回 verified 才记录“桌面同步完成”；缺失或不同文件返回非零。清单必须包括所有依赖资源，不能用两端同时缺失冒充一致。无需对相同文件重复截图。
