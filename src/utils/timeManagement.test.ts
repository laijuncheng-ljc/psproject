import { describe, expect, it } from "vitest";
import {
  createTimeManagementItem,
  formatLocalTimestamp,
  parseTimeManagementSection,
  serializeTimeManagementSection,
} from "./timeManagement";

describe("time management helpers", () => {
  it("parses task list items from the time management section", () => {
    const parsed = parseTimeManagementSection(`Normal card notes.

#### Time Management

- [x] subitem 1 <!-- completed_at: 2026-05-31T09:18:42+08:00 -->
- [ ] subitem 2
`);

    expect(parsed.body).toBe("Normal card notes.");
    expect(parsed.items).toEqual([
      {
        id: "time-item-1",
        title: "subitem 1",
        completed: true,
        completedAt: "2026-05-31T09:18:42+08:00",
      },
      {
        id: "time-item-2",
        title: "subitem 2",
        completed: false,
        completedAt: null,
      },
    ]);
    expect(parsed.history).toEqual([]);
  });

  it("parses and serializes stage history inside time management", () => {
    const parsed = parseTimeManagementSection(`Normal card notes.

#### 时间管理

##### 环节记录

- 2026-05-31T09:00:00+08:00 进入待办 <!-- stage: todo -->
- 2026-05-31T10:00:00+08:00 进入进行中 <!-- stage: doing -->
`);

    expect(parsed.body).toBe("Normal card notes.");
    expect(parsed.history).toEqual([
      {
        id: "stage-history-3",
        stage: "todo",
        timestamp: "2026-05-31T09:00:00+08:00",
      },
      {
        id: "stage-history-4",
        stage: "doing",
        timestamp: "2026-05-31T10:00:00+08:00",
      },
    ]);
    expect(
      serializeTimeManagementSection(parsed.body, parsed.items, parsed.history),
    ).toContain("##### 环节记录");
  });

  it("serializes task list items with completed_at timestamps", () => {
    const markdown = serializeTimeManagementSection("Normal card notes.", [
      {
        id: "one",
        title: "subitem 1",
        completed: true,
        completedAt: "2026-05-31T09:18:42+08:00",
      },
      createTimeManagementItem("subitem 2"),
    ]);

    expect(markdown).toBe(`Normal card notes.

#### 时间管理

##### 子项目

- [x] subitem 1 <!-- completed_at: 2026-05-31T09:18:42+08:00 -->
- [ ] subitem 2`);
  });

  it("recognizes the Chinese time management heading too", () => {
    const parsed = parseTimeManagementSection(`Notes.

#### 时间管理

- [ ] 子项目 1
`);

    expect(parsed.body).toBe("Notes.");
    expect(parsed.items[0].title).toBe("子项目 1");
  });

  it("formats a local timestamp with timezone offset", () => {
    expect(formatLocalTimestamp(new Date(2026, 4, 31, 9, 18, 42))).toMatch(
      /^2026-05-31T09:18:42[+-]\d{2}:\d{2}$/,
    );
  });
});
