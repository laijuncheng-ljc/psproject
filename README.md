# Local MD Kanban

A personal Trello-like Kanban board powered by one local Markdown file.

## Features

- Open a local Markdown file
- Parse Markdown into Todo / Doing / Done columns
- Drag and drop cards
- Add, edit, and delete cards
- Save changes back to the same Markdown file
- No backend
- No database
- No account

## Browser Support

This app requires Chrome or Edge desktop because it uses the File System Access API.

The Codex in-app browser may show the page, but it usually cannot grant the local file permissions needed to open and write back to the same Markdown file. Open the local dev URL in Chrome or Edge desktop for the full workflow.

If the browser does not support local file read/write, the app shows:

```txt
当前浏览器不支持本地文件读写。请使用 Chrome 或 Edge 桌面版。
```

## Markdown Format

Create a `board.md` file like this:

```md
# Personal Board

## Todo

### 写 Markdown parser
<!-- id: card-example-001 -->

把本地 Markdown 文件解析成看板数据。

#### Time Management

- [x] 识别 Todo / Doing / Done 三列 <!-- completed_at: 2026-05-31T09:18:42+08:00 -->
- [ ] 支持缺失 ID 的卡片
- [ ] 验证代码块中的标题不会误解析

### 实现卡片编辑
<!-- id: card-example-002 -->

支持编辑标题和正文。

## Doing

### 实现拖拽
<!-- id: card-example-003 -->

支持同列排序和跨列移动。

## Done

### 确定 MVP 范围
<!-- id: card-example-004 -->

只做本地 Markdown 文件驱动的个人 Kanban。
```

The parser expects one board title, fixed `Todo`, `Doing`, and `Done` columns, and cards represented by `###` headings. Missing card IDs are generated automatically, and missing columns are added when the board is saved.

Each card can also include a `#### Time Management` section. The app renders those lines as checkbox subitems in the card editor:

```md
<!-- priority: high -->
<!-- tags: parser, mvp -->

#### Time Management

- [x] subitem 1 <!-- completed_at: 2026-05-31T09:18:42+08:00 -->
- [ ] subitem 2
```

Checking a subitem writes the current local timestamp into `completed_at`. Unchecking it removes that timestamp.

The standalone app also supports these optional card metadata comments:

```md
<!-- priority: high -->
<!-- tags: parser, mvp -->
<!-- column: todo -->
<!-- archived_at: 2026-05-31T10:30:00+08:00 -->
```

- `priority` can be `high`, `medium`, or `low`.
- `tags` is a comma-separated list.
- `column` is used when an archived card is restored.
- `archived_at` is written automatically when a card is archived.
- Archived cards are stored under `## Archived` in the same Markdown file.

## Development

```bash
npm install
npm run dev
```

## Standalone HTML

If you do not want to run a dev server, open this file directly in Chrome or Edge:

```txt
local-md-kanban-standalone.html
```

This standalone file contains its own HTML, CSS, and JavaScript. Use `Open` when the browser allows direct local file access. If direct file access is blocked, use `Import` to load a Markdown file and `Download` to save the updated Markdown.

## Test

```bash
npm run test
```

## Build

```bash
npm run build
```
