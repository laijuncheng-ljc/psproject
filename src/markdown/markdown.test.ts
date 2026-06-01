import { describe, expect, it } from "vitest";
import { moveCard } from "../utils/board";
import { parseBoardMarkdown } from "./parseBoardMarkdown";
import { serializeBoardMarkdown } from "./serializeBoardMarkdown";

const sampleBoard = `# 个人看板

## 项目备注

项目目标：把本地 Markdown 变成项目管理面板。

## 待办

### 实现拖拽排序
<!-- id: card-20260531-001 -->

支持同列排序和跨列移动。

### 写 Markdown 解析器
<!-- id: card-20260531-002 -->

把 board.md 解析成 columns 和 cards。

## 进行中

### 搭建 Vite 项目
<!-- id: card-20260531-003 -->

初始化 React + TypeScript 项目。

## 已完成

### 确定 MVP 范围
<!-- id: card-20260531-004 -->

只做本地 Markdown 看板。`;

describe("Markdown board parser and serializer", () => {
  it("parses a normal board.md file with Chinese column headings", () => {
    const board = parseBoardMarkdown(sampleBoard);

    expect(board.title).toBe("个人看板");
    expect(board.notes).toBe("项目目标：把本地 Markdown 变成项目管理面板。");
    expect(board.columns).toHaveLength(3);
    expect(board.columns[0].cards).toHaveLength(2);
    expect(board.columns[0].cards[0]).toMatchObject({
      id: "card-20260531-001",
      title: "实现拖拽排序",
      body: "支持同列排序和跨列移动。",
      columnId: "todo",
    });
    expect(board.columns[1].cards[0].title).toBe("搭建 Vite 项目");
  });

  it("creates the default board for an empty file", () => {
    const board = parseBoardMarkdown("");

    expect(board.title).toBe("个人看板");
    expect(board.notes).toBe("");
    expect(board.columns.map((column) => column.title)).toEqual([
      "待办",
      "进行中",
      "已完成",
    ]);
    expect(board.columns.every((column) => column.cards.length === 0)).toBe(true);
  });

  it("keeps compatibility with old English column headings", () => {
    const board = parseBoardMarkdown(`# Personal Board

## Todo

### Missing id

Body without an id comment.
`);

    const card = board.columns[0].cards[0];
    expect(card.title).toBe("Missing id");
    expect(card.id).toMatch(/^card-/);
  });

  it("keeps card counts and titles stable after serialize then parse", () => {
    const firstParse = parseBoardMarkdown(sampleBoard);
    const serialized = serializeBoardMarkdown(firstParse);
    const secondParse = parseBoardMarkdown(serialized);

    expect(serialized).toContain("## 项目备注");
    expect(serialized).toContain("## 当前任务状态");
    expect(serialized).toContain("- 当前状态: 待办");
    expect(serialized).toContain("- 完成情况: 卡片未完成");
    expect(serialized).toContain("## 待办");
    expect(serialized).toContain("## 进行中");
    expect(serialized).toContain("## 已完成");
    expect(secondParse.columns.map((column) => column.cards.length)).toEqual([2, 1, 1]);
    expect(secondParse.columns[0].cards.map((card) => card.title)).toEqual([
      "实现拖拽排序",
      "写 Markdown 解析器",
    ]);
    expect(secondParse.notes).toBe("项目目标：把本地 Markdown 变成项目管理面板。");
  });

  it("ignores generated task summaries when parsing cards", () => {
    const board = parseBoardMarkdown(`# 个人看板

## 项目备注

整体备注。

## 风险记录

这里仍然属于项目备注。

## 当前任务状态
<!-- generated: true -->

### 状态：待办

#### 这不是卡片

- 当前状态: 待办

## 待办

### 真正的卡片
<!-- id: real-card -->

正文。
`);

    expect(board.notes).toBe("整体备注。\n\n## 风险记录\n\n这里仍然属于项目备注。");
    expect(board.columns[0].cards).toHaveLength(1);
    expect(board.columns[0].cards[0].title).toBe("真正的卡片");
  });

  it("does not parse headings inside fenced code blocks as cards or columns", () => {
    const board = parseBoardMarkdown(`# 个人看板

## 待办

### 代码示例
<!-- id: card-code -->

\`\`\`js
### 这不是卡片标题
## 这不是列标题
\`\`\`

仍然属于同一张卡片。

## 已完成
`);

    expect(board.columns[0].cards).toHaveLength(1);
    expect(board.columns[0].cards[0].body).toContain("### 这不是卡片标题");
    expect(board.columns[0].cards[0].body).toContain("仍然属于同一张卡片。");
    expect(board.columns[2].cards).toHaveLength(0);
  });

  it("moves cards across columns with the pure board helper", () => {
    const board = parseBoardMarkdown(sampleBoard);
    const moved = moveCard(board, "card-20260531-001", "done", 1);

    expect(moved.columns[0].cards.map((card) => card.id)).toEqual([
      "card-20260531-002",
    ]);
    expect(moved.columns[2].cards.map((card) => card.id)).toEqual([
      "card-20260531-004",
      "card-20260531-001",
    ]);
    expect(moved.columns[2].cards[1].columnId).toBe("done");
    expect(moved.columns[2].cards[1].body).toContain("进入已完成");
    expect(moved.columns[2].cards[1].body).toContain("<!-- stage: done -->");
  });
});
