import {
  DEFAULT_BOARD_TITLE,
  DEFAULT_COLUMNS,
  getColumnTitle,
} from "../constants/columns";
import type { ArchivedCard, Board, Card } from "../types/board";
import {
  serializeLinkedCardsForSummary,
  stripCardLinks,
} from "../utils/cardLinks";
import { parseCardMetadata, stripCardMetadataComments } from "../utils/cardMetadata";
import { generateCardId } from "../utils/id";
import {
  formatLocalTimestamp,
  parseTimeManagementSection,
  type StageHistoryEntry,
} from "../utils/timeManagement";

export function serializeBoardMarkdown(board: Board): string {
  const title = sanitizeHeading(board.title, DEFAULT_BOARD_TITLE);
  const sections = [
    `# ${title}`,
    serializeBoardNotes(board.notes),
    serializeBoardStatusSummary(board),
  ];

  for (const columnConfig of DEFAULT_COLUMNS) {
    const column = board.columns.find((candidate) => candidate.id === columnConfig.id);
    const cardBlocks = (column?.cards ?? []).map((card) => serializeCard(card));
    const columnBody =
      cardBlocks.length > 0
        ? `## ${columnConfig.title}\n\n${cardBlocks.join("\n\n")}`
        : `## ${columnConfig.title}`;

    sections.push(columnBody);
  }

  sections.push(serializeArchive(board.archivedCards ?? []));

  return `${sections.join("\n\n")}\n`;
}

function serializeBoardNotes(notes: string): string {
  const cleanNotes = trimTrailingBlankLines(notes);

  return cleanNotes ? `## 项目备注\n\n${cleanNotes}` : "## 项目备注";
}

function serializeBoardStatusSummary(board: Board): string {
  const generatedAt = formatLocalTimestamp();
  const cards = board.columns.flatMap((column) =>
    column.cards.map((card) => ({
      column,
      card,
      parsedTime: parseTimeManagementSection(card.body),
    })),
  );
  const summaryLines = [
    "## 当前任务状态",
    "<!-- generated: true -->",
    "",
    `- 更新时间: ${generatedAt}`,
    "- 数据文件夹: project-data/",
    "- 挖坑进度: project-data/resources.md",
    "- 挖坑记录: project-data/achievements.md",
    `- 任务总数: ${cards.length}`,
    ...DEFAULT_COLUMNS.map((columnConfig) => {
      const count =
        board.columns.find((column) => column.id === columnConfig.id)?.cards.length ??
        0;

      return `- ${columnConfig.title}: ${count}`;
    }),
    `- 归档: ${board.archivedCards?.length ?? 0}`,
  ];

  if (cards.length === 0) {
    summaryLines.push("", "暂无任务。");
    return summaryLines.join("\n");
  }

  for (const columnConfig of DEFAULT_COLUMNS) {
    const cardsInColumn = cards.filter(
      ({ column }) => column.id === columnConfig.id,
    );

    summaryLines.push("", `### 状态：${columnConfig.title}`);

    if (cardsInColumn.length === 0) {
      summaryLines.push("", "暂无任务。");
      continue;
    }

    for (const { card, parsedTime } of cardsInColumn) {
      const metadata = parseCardMetadata(card.body);
      const completedItems = parsedTime.items.filter((item) => item.completed).length;
      const completionText =
        parsedTime.items.length > 0
          ? `子项目 ${completedItems}/${parsedTime.items.length} 已完成`
          : "无子项目记录";
      const cleanBody = stripMetadataComments(parsedTime.body);

      summaryLines.push(
        "",
        `#### ${sanitizeHeading(card.title, "无标题")}`,
        "",
        `- ID: ${card.id}`,
        `- 当前状态: ${getColumnTitle(card.columnId)}`,
        `- 完成情况: ${card.columnId === "done" ? "卡片已完成" : "卡片未完成"}；${completionText}`,
        `- 分类: ${metadata.category || "未分类"}`,
        `- 专项文档: ${metadata.detailPath || "无"}`,
        `- 优先级: ${metadata.priority ?? "未设置"}`,
        `- 标签: ${metadata.tags.length > 0 ? metadata.tags.join(", ") : "无"}`,
        "- 时间节点:",
        ...serializeStageHistory(parsedTime.history),
        "- 相关细节:",
        `  - 正文: ${cleanBody || "无"}`,
        "  - 子项目:",
        ...serializeSubitems(parsedTime.items),
        "- 关联卡片:",
        ...serializeLinkedCardsForSummary(board, parsedTime.body),
      );
    }
  }

  if ((board.archivedCards?.length ?? 0) > 0) {
    summaryLines.push("", "### 状态：归档");

    for (const card of board.archivedCards) {
      const parsedTime = parseTimeManagementSection(card.body);
      const metadata = parseCardMetadata(card.body);
      const completedItems = parsedTime.items.filter((item) => item.completed).length;
      const completionText =
        parsedTime.items.length > 0
          ? `子项目 ${completedItems}/${parsedTime.items.length} 已完成`
          : "无子项目记录";
      const cleanBody = stripMetadataComments(parsedTime.body);

      summaryLines.push(
        "",
        `#### ${sanitizeHeading(card.title, "无标题")}`,
        "",
        `- ID: ${card.id}`,
        "- 当前状态: 归档",
        `- 原状态: ${getColumnTitle(card.originalColumnId)}`,
        `- 归档时间: ${card.archivedAt ?? "未记录"}`,
        `- 完成情况: 卡片已归档；${completionText}`,
        `- 分类: ${metadata.category || "未分类"}`,
        `- 专项文档: ${metadata.detailPath || "无"}`,
        `- 优先级: ${metadata.priority ?? "未设置"}`,
        `- 标签: ${metadata.tags.length > 0 ? metadata.tags.join(", ") : "无"}`,
        "- 时间节点:",
        ...serializeStageHistory(parsedTime.history),
        "- 相关细节:",
        `  - 正文: ${cleanBody || "无"}`,
        "  - 子项目:",
        ...serializeSubitems(parsedTime.items),
        "- 关联卡片:",
        ...serializeLinkedCardsForSummary(board, parsedTime.body),
      );
    }
  }

  return summaryLines.join("\n");
}

function serializeArchive(cards: ArchivedCard[]): string {
  const cardBlocks = cards.map((card) => serializeArchivedCard(card));

  return cardBlocks.length > 0
    ? `## 归档\n\n${cardBlocks.join("\n\n")}`
    : "## 归档";
}

function serializeCard(card: Card): string {
  const title = sanitizeHeading(card.title, "无标题");
  const id = card.id.trim() || generateCardId();
  const body = trimTrailingBlankLines(card.body);
  const header = `### ${title}\n<!-- id: ${id} -->`;

  return body ? `${header}\n\n${body}` : header;
}

function serializeArchivedCard(card: ArchivedCard): string {
  const title = sanitizeHeading(card.title, "无标题");
  const id = card.id.trim() || generateCardId();
  const body = trimTrailingBlankLines(card.body);
  const metadataLines = [
    `<!-- id: ${id} -->`,
    `<!-- column: ${card.originalColumnId} -->`,
  ];

  if (card.archivedAt) {
    metadataLines.push(`<!-- archived_at: ${card.archivedAt} -->`);
  }

  const header = `### ${title}\n${metadataLines.join("\n")}`;

  return body ? `${header}\n\n${body}` : header;
}

function sanitizeHeading(value: string, fallback: string): string {
  return value.replace(/\r?\n/g, " ").trim() || fallback;
}

function trimTrailingBlankLines(value: string): string {
  return value.replace(/\s+$/g, "");
}

function stripMetadataComments(body: string): string {
  return stripCardLinks(stripCardMetadataComments(body))
    .split("\n")
    .filter((line) => !/^<!--\s*(column|archived_at):/i.test(line.trim()))
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

function serializeStageHistory(history: StageHistoryEntry[]): string[] {
  if (history.length === 0) {
    return ["  - 暂无"];
  }

  return history.map(
    (entry) => `  - ${entry.timestamp}: 进入${getStageLabel(entry.stage)}`,
  );
}

function serializeSubitems(
  items: ReturnType<typeof parseTimeManagementSection>["items"],
): string[] {
  if (items.length === 0) {
    return ["    - 暂无"];
  }

  return items.map((item) => {
    const completed = item.completed ? "已完成" : "未完成";
    const completedAt = item.completedAt ? `，完成于 ${item.completedAt}` : "";

    return `    - [${item.completed ? "x" : " "}] ${item.title}（${completed}${completedAt}）`;
  });
}

function getStageLabel(stage: StageHistoryEntry["stage"]): string {
  if (stage === "todo") return "待办";
  if (stage === "doing") return "进行中";
  if (stage === "done") return "已完成";
  return "归档";
}
