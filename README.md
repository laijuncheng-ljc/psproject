# 机械 MD 看板

一个赛博朋克机械风的本地 Markdown 项目看板。下载整个项目文件夹后，核心数据都在 `project-data/` 里，双击启动脚本即可一键运行。

## 功能

- 启动后自动读取 `project-data/board.md`
- 自动解析为“待办 / 进行中 / 已完成”三列
- 拖拽卡片调整顺序或状态
- 卡片变多时，各状态列和归档列表会独立滚动
- 完成任务后顶部会显示一个轻量的小人挖坑动画
- 新建、编辑、删除卡片
- 给整个项目记录备注，并同步到 `project-data/notes.md`
- 给卡片设置分类、标签、优先级和归档状态
- 给内容较长的专项卡片绑定 `project-data/details/*.md` 独立文档
- 复制卡片链接并粘到另一张卡片正文，自动显示为可读取的链接子模块
- 在卡片里管理“时间管理”子项目，并在勾选完成时记录本地时间戳
- 自动记录卡片进入待办、进行中、已完成和归档的时间点
- 保存时自动生成“当前任务状态”，方便大模型读取所有任务的当前情况
- 保存时同步刷新 `project-data/resources.md` 和 `project-data/achievements.md` 里的挖坑记录
- 修改后自动覆盖写回 `project-data/board.md`，也可以点“立即保存”手动触发
- 可选开启每 2 小时自动备份，备份文件会写入 `project-data/backups/`
- 没有远程后端、数据库、账号系统或 GitHub 同步

## 数据文件夹

`project-data/` 是项目的数据舱：

- `project-data/board.md`: 看板主数据、任务状态、时间节点和当前状态总览。
- `project-data/notes.md`: 项目整体备注。
- `project-data/resources.md`: 由完成卡片和子项目自动计算出的挖坑进度。
- `project-data/achievements.md`: 自动生成的挖坑记录。
- `project-data/details/*.md`: 专项长文档，例如数据需求、字段口径、方案细节。
- `project-data/backups/`: 自动备份目录，默认不提交到 Git。

旧版本的根目录 `board.md` 和 `card-details/` 会在启动时自动迁移/兼容到 `project-data/`。

## 挖坑规则

- 每完成 1 张任务卡片，小人多挖 1 层。
- 每完成 1 个子项目，小人多挖 1 层。
- 顶部只保留小型挖坑动画，不再展示大资源面板。

## 推荐用法

线上版：

[https://laijuncheng-ljc.github.io/psproject/](https://laijuncheng-ljc.github.io/psproject/)

线上版会读取随项目发布的 `project-data/board.md`。浏览器不能直接覆盖 GitHub 仓库里的 Markdown 文件，所以线上编辑会先保存到当前浏览器；要直接替换项目文件夹里的 Markdown，请使用下面的本地一键运行。

macOS 可以直接双击项目根目录里的 `start-kanban.command`。它会自动安装依赖、构建生产版页面、启动本机读写通道，并打开浏览器里的看板页面。你不需要手动发布、本地部署或输入命令。

这个本机读写通道只跑在自己的电脑上，用来让浏览器安全地读写 `project-data/board.md`、专项文档和备份文件；关闭终端窗口后，看板页面就会停止运行。

命令行一键运行：

```bash
npm run app
```

开发模式：

```bash
npm install
npm run dev
```

页面会自动读取 `project-data/board.md`。修改看板后会自动保存，程序会通过本地服务直接替换这个文件，不会弹出下载窗口；工具栏里的“立即保存”可以作为手动兜底。

如果 `project-data/board.md` 不存在，开发服务会优先从旧版根目录 `board.md` 或 `example-board.md` 初始化一份；如果示例文件也不存在，会创建一个空看板。

纯静态 HTML 直接覆盖本地 Markdown 文件会被浏览器安全策略拦截，所以固定文件保存推荐使用上面的双击启动方式。

## 备份

工具栏里的“备份历史”可以开启“每 2 小时自动备份”。开启后，页面保持打开时会定时把当前看板内容写入 `project-data/backups/board-时间戳.md`。也可以点“立即备份”手动创建备份。

`project-data/backups/` 已加入 `.gitignore`，默认不会提交到 Git。

## Markdown 格式

固定文件 `project-data/board.md`：

```md
# 个人看板

## 项目备注

记录项目目标、背景、阶段性结论、风险或任何整体备注。

## 当前任务状态
<!-- generated: true -->

- 更新时间: 2026-05-31T10:00:00.000Z
- 任务总数: 3
- 待办: 1
- 进行中: 1
- 已完成: 1

### 状态：待办

#### 写 Markdown 解析器

- ID: card-example-001
- 当前状态: 待办
- 完成情况: 卡片未完成；子项目 1/3 已完成
- 分类: 专项
- 优先级: high
- 标签: 解析器, MVP
- 时间节点:
  - 2026-05-31T09:00:00+08:00: 进入待办
- 相关细节:
  - 正文: 把本地 Markdown 文件解析成看板数据。
  - 子项目:
    - [x] 识别三列结构（已完成，完成于 2026-05-31T09:18:42+08:00）
    - [ ] 支持缺失 ID 的卡片（未完成）
    - [ ] 验证代码块中的标题不会被误解析（未完成）

## 待办

### 写 Markdown 解析器
<!-- id: card-example-001 -->
<!-- category: 专项 -->
<!-- priority: high -->
<!-- tags: 解析器, MVP -->

把本地 Markdown 文件解析成看板数据。

#### 时间管理

##### 环节记录

- 2026-05-31T09:00:00+08:00 进入待办 <!-- stage: todo -->

##### 子项目

- [x] 识别三列结构 <!-- completed_at: 2026-05-31T09:18:42+08:00 -->
- [ ] 支持缺失 ID 的卡片
- [ ] 验证代码块中的标题不会被误解析

## 进行中

### 实现拖拽
<!-- id: card-example-002 -->
<!-- category: 紧急 -->
<!-- priority: medium -->
<!-- tags: 交互 -->

支持同列排序和跨列移动。

## 已完成

### 确定 MVP 范围
<!-- id: card-example-003 -->
<!-- category: 长期 -->
<!-- priority: low -->

只做本地 Markdown 文件驱动的个人看板。

## 归档
```

`## 项目备注` 是手动编辑内容。`## 当前任务状态` 是保存时自动生成的状态总览，给大模型快速读取用；真正的任务数据仍然保存在下方“待办 / 进行中 / 已完成”三列里。

每张卡片用 `###` 标题表示。卡片 ID 写在 `<!-- id: ... -->` 里；如果缺少 ID，程序会自动生成。保存时会统一输出中文栏目标题。

卡片进入某个环节时，会在“时间管理”里追加一条环节记录：

```md
#### 时间管理

##### 环节记录

- 2026-05-31T09:00:00+08:00 进入待办 <!-- stage: todo -->
- 2026-05-31T10:00:00+08:00 进入进行中 <!-- stage: doing -->
- 2026-05-31T11:30:00+08:00 进入已完成 <!-- stage: done -->

##### 子项目

- [x] 子项目 1 <!-- completed_at: 2026-05-31T09:18:42+08:00 -->
```

可选元数据：

```md
<!-- category: 专项 -->
<!-- priority: high -->
<!-- tags: 解析器, MVP -->
<!-- detail: project-data/details/data-requirements.md -->
<!-- column: todo -->
<!-- archived_at: 2026-05-31T10:30:00+08:00 -->
```

- `category` 是下拉选择的列内大模块，当前内置：长期、专项、紧急、其他。看板会在每个状态列里按这些大模块分组显示。
- `priority` 使用 `high`、`medium`、`low` 三个机器值，界面显示为高、中、低。
- `tags` 是逗号分隔的标签。
- `detail` 指向独立专项文档，例如 `project-data/details/data-requirements.md`；适合放字段口径、数据来源、交付物等长内容。
- `column` 用于归档卡片恢复时回到原列。
- `archived_at` 会在归档时自动写入。
- 归档卡片保存在同一个文件的 `## 归档` 下。

卡片链接使用固定格式，适合人和大模型一起读取：

```md
[[card:card-data-requirements]]
```

也兼容普通 Markdown 链接：

```md
[数据需求专项](card:card-data-requirements)
```

在编辑器里点“复制链接”即可拿到当前卡片链接。把它粘到另一张卡片正文里后，界面会把被链接卡片显示为“链接子模块”；保存时，`## 当前任务状态` 也会写出被链接卡片的状态、分类、子项目进度和专项文档路径。

## 开发

```bash
npm install
npm run dev
```

## 测试

```bash
npm run test
```

## 构建

```bash
npm run build
```
