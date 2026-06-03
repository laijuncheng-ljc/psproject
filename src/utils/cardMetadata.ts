export interface CardMetadata {
  category: string;
  priority: string | null;
  tags: string[];
  detailPath: string;
}

export type CardCategoryTone = "long-term" | "focused" | "urgent" | "custom" | "none";

export const CARD_CATEGORY_OPTIONS = [
  { value: "", label: "未分类" },
  { value: "长期", label: "长期" },
  { value: "专项", label: "专项" },
  { value: "紧急", label: "紧急" },
  { value: "其他", label: "其他" },
] as const;

export const CARD_CATEGORY_GROUPS: Array<{
  value: string;
  label: string;
  tone: CardCategoryTone;
}> = [
  { value: "紧急", label: "紧急", tone: "urgent" },
  { value: "专项", label: "专项", tone: "focused" },
  { value: "长期", label: "长期", tone: "long-term" },
];

const METADATA_COMMENT_PATTERN =
  /^<!--\s*(category|priority|tags|detail|detail_path|detail-file|detail_file):\s*(.*?)\s*-->$/i;
const FENCE_PATTERN = /^ {0,3}(```+|~~~+)/;

export function parseCardMetadata(body: string): CardMetadata {
  let category = "";
  let priority: string | null = null;
  let tags: string[] = [];
  let detailPath = "";
  let insideFence = false;

  for (const line of body.split("\n")) {
    const metadataMatch = !insideFence
      ? METADATA_COMMENT_PATTERN.exec(line.trim())
      : null;

    if (metadataMatch) {
      const key = metadataMatch[1].toLowerCase();
      const value = metadataMatch[2].trim();

      if (key === "category") {
        category = value;
      } else if (key === "priority") {
        priority = value || null;
      } else if (key === "tags") {
        tags = parseTags(value);
      } else if (
        key === "detail" ||
        key === "detail_path" ||
        key === "detail-file" ||
        key === "detail_file"
      ) {
        detailPath = value;
      }
    }

    if (isFenceLine(line)) {
      insideFence = !insideFence;
    }
  }

  return { category, priority, tags, detailPath };
}

export function serializeCardMetadata(
  metadata: CardMetadata,
  body: string,
): string {
  const metadataLines: string[] = [];
  const cleanPriority = metadata.priority?.trim();
  const cleanTags = metadata.tags.map((tag) => tag.trim()).filter(Boolean);
  const cleanCategory = metadata.category.trim();
  const cleanDetailPath = metadata.detailPath.trim();
  const cleanBody = stripCardMetadataComments(body);

  if (cleanCategory) {
    metadataLines.push(`<!-- category: ${cleanCategory} -->`);
  }

  if (cleanPriority) {
    metadataLines.push(`<!-- priority: ${cleanPriority} -->`);
  }

  if (cleanTags.length > 0) {
    metadataLines.push(`<!-- tags: ${cleanTags.join(", ")} -->`);
  }

  if (cleanDetailPath) {
    metadataLines.push(`<!-- detail: ${cleanDetailPath} -->`);
  }

  if (metadataLines.length === 0) {
    return cleanBody;
  }

  return cleanBody
    ? `${metadataLines.join("\n")}\n\n${cleanBody}`
    : metadataLines.join("\n");
}

export function updateCardCategory(body: string, category: string): string {
  return serializeCardMetadata({ ...parseCardMetadata(body), category }, body);
}

export function stripCardMetadataComments(body: string): string {
  let insideFence = false;
  const lines: string[] = [];

  for (const line of body.split("\n")) {
    const isMetadataLine =
      !insideFence && METADATA_COMMENT_PATTERN.test(line.trim());

    if (!isMetadataLine) {
      lines.push(line);
    }

    if (isFenceLine(line)) {
      insideFence = !insideFence;
    }
  }

  return trimBlankEdges(lines).join("\n");
}

export function getCategoryTone(category: string): CardCategoryTone {
  if (category === "长期") return "long-term";
  if (category === "专项") return "focused";
  if (category === "紧急") return "urgent";
  if (category.trim()) return "custom";
  return "none";
}

export function getCategoryLabel(category: string): string {
  return category.trim() || "未分类";
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function trimBlankEdges(lines: string[]): string[] {
  let start = 0;
  let end = lines.length;

  while (start < end && lines[start].trim() === "") {
    start += 1;
  }

  while (end > start && lines[end - 1].trim() === "") {
    end -= 1;
  }

  return lines.slice(start, end);
}

function isFenceLine(line: string): boolean {
  return FENCE_PATTERN.test(line);
}
