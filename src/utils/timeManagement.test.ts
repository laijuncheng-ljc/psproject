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

#### Time Management

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
