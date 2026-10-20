# 首次准备与可复用工具

## 环境通过条件

- 设计通道：默认选择 Vibe 前端导出能力；只读请求实际成功读取目标文件/画板才算连接通过。工具命名以当前签名为准。Magic 是备选，不要求同时安装；用户指定路线优先。不在本技能中猜端口、认证配置或自动安装 MCP。
- 浏览器：现有 Node.js、Playwright 与 Chrome/Chromium，或宿主允许且能读取、截图、控制视口的工具。先复用已知运行时，不自动下载。浏览器执行权限和 MCP 权限分别验证。
- 资源：导出的结构、截图和素材对应同一画板，文件对当前执行环境可读。准备目标实际使用的字体及字重，分发字体文件前确认允许嵌入。
- 输出：工作区可写；桌面目录已按宿主方式定位，实际复制时按权限流程执行。静态 HTML 优先 file://，无需预装框架、构建工具或 HTTP 服务。

## 字体预检（布局修复前）

选择关键数字、普通正文、强调文字和混排文字各一个实际节点，记录设计中的字体名、字重、字号、行高，再检查浏览器实际使用的字体。`getComputedStyle` 和 `document.fonts.check` 不能证明真实字形来源。Chromium 可通过 CDP 的 `CSS.getPlatformFontsForNode` 记录 PostScript 名、字形数和自定义字体标志；混排可能合理使用多个字体，不把“预期字体出现”当作全部字符均正确。

当字体存在但粗细不对，先检查静态字体文件的真实字重及映射。例如部分 MiSans Latin 文件使用 330、380、520，而不是惯常的 400、500、600。不要将这个例子套用到其他字体，也不要盲目降低 CSS 数值。存在可用且允许嵌入的字体时，用 `@font-face` 为各实际字重显式指定文件；可变字体按真实轴范围声明。复核数字宽度、换行和中英文回退。缺少证据时报告缺项，不承诺等价还原。

不要仅凭CSS的380等数值推断Regular或Medium。先读取设计样式名；接口仅给数值时，核对该项目实际字体文件的OS/2 usWeightClass、family/subfamily（包括typographic名称）和PostScript名，无法唯一对应时标为待确认，不把本机匹配结果当设计证据。一个family可能分组不完整，数值正确仍会匹配Light。确认后用独立别名与精确文件绑定；仅本机预览可用精确PostScript的local()，但须声明其他设备仍有回退风险。对外分发仅使用允许嵌入的文件或项目已确认可用的字体URL，不擅自复制字体。

主价格、涨跌额、涨跌幅、结算价及卡片数字按不同款式分别核对；不能只验证大号粗体就宣称全部数字正确。字重与款式在所有适配宽度固定，不用vw、媒体查询、字号联动或字体切换改变粗细。首次在基准、最窄、最宽手机宽度验证同一文本的computed weight和实际PostScript来源；保持字号与字重验证独立。使用fontCheckWidths和expectedWeight并入现有批次，后续只回归受影响字体。

## 统一浏览器入口

`scripts/qa.cjs` 不安装依赖，不修改 HTML。使用已验证的 Node.js 和 Playwright 运行时（必要时设置 NODE_PATH），传入 JSON 配置文件：

```json
{
  "page": "/absolute/project/design.html",
  "outputDir": "/absolute/project/qa",
  "browserExecutable": "/absolute/path/to/chrome",
  "phase": "initial",
  "baselineWidth": 393,
  "fontCheckWidths": [393, 320, 440],
  "pageSelector": ".page",
  "fillWidths": [320, 440],
  "scrollSelectors": [".chart-scroll"],
  "textSelectors": [".metric-value"],
  "viewportHeight": 900,
  "widths": [393, 320, 440],
  "screenshotWidths": [393, 320],
  "fontSamples": [
    {"selector": ".quote-price", "expectedPostScriptName": "", "expectedWeight": "520"}
  ]
}
```

```sh
node /absolute/skill/scripts/qa.cjs /absolute/project/qa-config.json
```

将示例宽度替换为真实画板宽度；fillWidths必须包含在widths中，示例需据实际批次调整。pageSelector须唯一指向页面外壳，要求铺满外壳而不是带内边距的正文；无页面选择器时不会验证铺满。字体选择器须唯一且指向文字节点。scrollSelectors/textSelectors仅选实际存在且需要检查的区块；独立内容滚动区也可加入。首次未知 PostScript 名可留空，从实际结果与设计、字体文件核对；不能将浏览器第一次错误匹配的结果直接当作预期。最终批次覆盖技能要求的全部宽度，中间批次只覆盖受影响宽度；截图只留必要尺寸。

脚本在一个浏览器进程中检查本地页面，按配置记录手机外壳是否铺满、文字容器横向溢出、滚动区能否到达末端（检查后恢复滚动位置），输出每个宽度的资源/控制台、页面宽度、标题、缺失 alt、基准宽度字体证据及选定截图。等待有上限，浏览器失败也保存错误报告。退出码 1 表示执行或技术检查失败；退出码 0 仍可能包含 needs-review。`visualVerdict` 始终是 not-reviewed：必须实际查看截图再在项目报告中判定。该脚本不替代交互测试、背景图片就绪检查、逐区视觉验收、语义审核或 HTTP 页面检查；这些按实际页面补充，不扩大脚本成任意代码执行入口。

## 项目记录与交付核对

在工作区保存一份精简项目记录（JSON 或已有报告均可）：设计链接与画板身份、MCP 路线、基准宽度、源目录和交付目录、运行时路径、浏览器版本、QA 配置路径、最后报告、未解决问题、阶段起止时间。环境记录是复用线索，跨会话仍需验证受影响状态，不作为永久健康证明。不要保存凭据或将本机路径配置发布进技能仓库。

分别记录工作区修改、QA 完成和桌面同步状态。先整理准确的交付相对路径清单（JSON 数组，包含 HTML、CSS、素材及必要报告），复制前检查目标是否有人为改动，复制后执行：

```sh
python3 /absolute/skill/scripts/verify-delivery.py /absolute/source /absolute/desktop/design /absolute/project/delivery-files.json
```

此脚本只比较清单内文件的 SHA-256，不复制、不删除、不核验清单是否完整。只有返回 verified 才记录“桌面同步完成”；缺失或不同文件返回非零。清单必须包括所有依赖资源，不能用两端同时缺失冒充一致。无需对相同文件重复截图。

新增几何检查只提供定位线索，不能证明没有重叠或语义正确。铺满不符合、配置选择器缺失及滚动末端失败均为技术失败；文本溢出为needs-review，合理省略号需人工说明。viewportHeight可按截图问题证据调整，不默认加高所有任务。

expectedWeight按设计和字体证据填写，示例520不是默认字重。fontCheckWidths默认仅基准，显式配置须包含基准且属于widths；expectedWeight为可选数字字符串。实际字体未匹配或字重不符返回failed。混排时预期字体出现只证明该字体参与渲染，仍需核对其他字形来源及放大后的笔画；不将CDP成功等同于视觉一致。
