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
    nextLandTarget: completedCards + 1,
    nextTerritoryTarget: (territory + 1) * 3,
    achievements: createAchievements({
      completedCards,
      completedSubitems,
      detailDocuments,
      energy,
    }),
  };
}

export function serializeResourcesMarkdown(board: Board): string {
  const model = calculateResourceModel(board);

  return [
    "# 资源进度",
    "",
    "这份文件由看板保存时自动生成，给人和大模型快速读取项目成长状态。",
    "",
    "## 当前资源",
    "",
    `- 能量: ${model.energy}`,
    `- 土地: ${model.land}`,
    `- 领地: ${model.territory}`,
    `- 机械合金: ${model.alloy}`,
    `- 数据核心: ${model.dataCores}`,
    "",
    "## 规则",
    "",
    "- 每完成 1 张任务卡片，获得 120 能量和 1 块土地。",
    "- 每完成 3 张任务卡片，自动合成为 1 个领地。",
    "- 每完成 1 个子项目，获得 20 能量和 8 机械合金。",
    "- 每绑定 1 个专项文档，获得 1 个数据核心。",
    "- 每归档 1 张卡片，获得 30 能量。",
    "",
    "## 下一目标",
    "",
    `- 下一块土地: 完成 ${model.nextLandTarget} 张任务卡片。`,
    `- 下一块领地: 完成 ${model.nextTerritoryTarget} 张任务卡片。`,
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
    "# 成就记录",
    "",
    "这份文件由看板保存时自动生成。",
    "",
    `- 已解锁: ${unlocked.length}/${model.achievements.length}`,
    "",
    "## 已解锁",
    "",
    ...serializeAchievementList(unlocked),
    "",
    "## 未解锁",
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
  energy,
}: Pick<
  ResourceModel,
  "completedCards" | "completedSubitems" | "detailDocuments" | "energy"
>): Achievement[] {
  return [
    {
      id: "first-power-cell",
      title: "第一枚能量核心",
      description: "完成 1 张任务卡片。",
      unlocked: completedCards >= 1,
    },
    {
      id: "territory-node",
      title: "领地节点",
      description: "完成 3 张任务卡片，合成第一块领地。",
      unlocked: completedCards >= 3,
    },
    {
      id: "mechanical-grid",
      title: "机械地网",
      description: "完成 5 张任务卡片。",
      unlocked: completedCards >= 5,
    },
    {
      id: "data-core-online",
      title: "数据核心上线",
      description: "绑定至少 1 份专项文档。",
      unlocked: detailDocuments >= 1,
    },
    {
      id: "subsystem-calibration",
      title: "子系统校准",
      description: "完成 5 个子项目。",
      unlocked: completedSubitems >= 5,
    },
    {
      id: "reactor-overdrive",
      title: "反应堆过载",
      description: "累积 600 能量。",
      unlocked: energy >= 600,
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
