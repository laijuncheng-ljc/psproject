import type { Board } from "../types/board";
import { parseCardMetadata } from "./cardMetadata";
import { parseTimeManagementSection } from "./timeManagement";

export interface ResourceModel {
  completedCards: number;
  totalCards: number;
  completedSubitems: number;
  totalSubitems: number;
  detailDocuments: number;
  archivedCards: number;
  energy: number;
  land: number;
  territory: number;
  alloy: number;
  dataCores: number;
  digDepth: number;
  nextLandTarget: number;
  nextTerritoryTarget: number;
  achievements: Achievement[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export function calculateResourceModel(board: Board): ResourceModel {
  const activeCards = board.columns.flatMap((column) => column.cards);
  const archivedCards = board.archivedCards ?? [];
  const cards = [...activeCards, ...archivedCards];
  const completedCards =
    board.columns.find((column) => column.id === "done")?.cards.length ?? 0;
  const timeSections = cards.map((card) => parseTimeManagementSection(card.body));
  const completedSubitems = timeSections.reduce(
    (total, section) => total + section.items.filter((item) => item.completed).length,
    0,
  );
  const totalSubitems = timeSections.reduce(
    (total, section) => total + section.items.length,
    0,
  );
  const detailDocuments = cards.filter(
    (card) => parseCardMetadata(card.body).detailPath.trim() !== "",
  ).length;
  const energy = completedCards * 120 + completedSubitems * 20 + archivedCards.length * 30;
  const land = completedCards;
  const territory = Math.floor(completedCards / 3);
  const alloy = completedSubitems * 8;
  const dataCores = detailDocuments;
  const digDepth = completedCards + completedSubitems;

  return {
    completedCards,
    totalCards: activeCards.length + archivedCards.length,
    completedSubitems,
    totalSubitems,
    detailDocuments,
    archivedCards: archivedCards.length,
    energy,
    land,
    territory,
    alloy,
    dataCores,
    digDepth,
    nextLandTarget: completedCards + 1,
    nextTerritoryTarget: (territory + 1) * 3,
    achievements: createAchievements({
      completedCards,
      completedSubitems,
      detailDocuments,
      digDepth,
    }),
  };
}

export function serializeResourcesMarkdown(board: Board): string {
  const model = calculateResourceModel(board);

  return [
    "# 挖坑进度",
    "",
    "这份文件由看板保存时自动生成，给人和大模型快速读取任务推进状态。",
    "",
    "## 当前进度",
    "",
    `- 已挖层数: ${model.digDepth}`,
    `- 已完成卡片: ${model.completedCards}`,
    `- 已完成子项目: ${model.completedSubitems}`,
    "",
    "## 规则",
    "",
    "- 每完成 1 张任务卡片，小人多挖 1 层。",
    "- 每完成 1 个子项目，小人多挖 1 层。",
    "",
    "## 任务统计",
    "",
    `- 当前任务总数: ${model.totalCards}`,
    `- 已完成卡片: ${model.completedCards}`,
    `- 已归档卡片: ${model.archivedCards}`,
    `- 子项目完成度: ${model.completedSubitems}/${model.totalSubitems}`,
    `- 专项文档数: ${model.detailDocuments}`,
    "",
  ].join("\n");
}

export function serializeAchievementsMarkdown(board: Board): string {
  const model = calculateResourceModel(board);
  const unlocked = model.achievements.filter((achievement) => achievement.unlocked);
  const locked = model.achievements.filter((achievement) => !achievement.unlocked);

  return [
    "# 挖坑记录",
    "",
    "这份文件由看板保存时自动生成。",
    "",
    `- 已挖层数: ${model.digDepth}`,
    `- 已触发记录: ${unlocked.length}/${model.achievements.length}`,
    "",
    "## 已触发",
    "",
    ...serializeAchievementList(unlocked),
    "",
    "## 待触发",
    "",
    ...serializeAchievementList(locked),
    "",
  ].join("\n");
}

export function serializeNotesMarkdown(board: Board): string {
  const cleanNotes = board.notes.trim();

  return cleanNotes
    ? `# 项目备注\n\n${cleanNotes}\n`
    : "# 项目备注\n\n暂无项目备注。\n";
}

function createAchievements({
  completedCards,
  completedSubitems,
  detailDocuments,
  digDepth,
}: Pick<
  ResourceModel,
  "completedCards" | "completedSubitems" | "detailDocuments" | "digDepth"
>): Achievement[] {
  return [
    {
      id: "first-shovel",
      title: "第一铲",
      description: "完成 1 张任务卡片，小人开始挖坑。",
      unlocked: completedCards >= 1,
    },
    {
      id: "steady-digging",
      title: "稳定下挖",
      description: "累计挖到 3 层。",
      unlocked: digDepth >= 3,
    },
    {
      id: "deep-pit",
      title: "深坑成型",
      description: "累计挖到 8 层。",
      unlocked: digDepth >= 8,
    },
    {
      id: "project-shaft",
      title: "专项竖井",
      description: "绑定至少 1 份专项文档。",
      unlocked: detailDocuments >= 1,
    },
    {
      id: "card-tunnel",
      title: "任务隧道",
      description: "完成 3 张任务卡片。",
      unlocked: completedCards >= 3,
    },
    {
      id: "subsystem-calibration",
      title: "碎土清理",
      description: "完成 5 个子项目。",
      unlocked: completedSubitems >= 5,
    },
  ];
}

function serializeAchievementList(achievements: Achievement[]): string[] {
  if (achievements.length === 0) {
    return ["暂无。"];
  }

  return achievements.map(
    (achievement) => `- ${achievement.title}: ${achievement.description}`,
  );
}
