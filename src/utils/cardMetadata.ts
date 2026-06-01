export interface CardMetadata {
  category: string;
  priority: string | null;
  tags: string[];
}

export const CARD_CATEGORY_OPTIONS = [
  { value: "", label: "未分类" },
  { value: "需求", label: "需求" },
  { value: "开发", label: "开发" },
  { value: "问题", label: "问题" },
  { value: "文档", label: "文档" },
  { value: "调研", label: "调研" },
  { value: "会议", label: "会议" },
  { value: "其他", label: "其他" },
] as const;

const METADATA_COMMENT_PATTERN =
  /^<!--\s*(category|priority|tags):\s*(.*?)\s*-->$/i;
const FENCE_PATTERN = /^ {0,3}(```+|~~~+)/;

export function parseCardMetadata(body: string): CardMetadata {
  let category = "";
  let priority: string | null = null;
  let tags: string[] = [];
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
      }
    }

    if (isFenceLine(line)) {
      insideFence = !insideFence;
    }
  }

  return { category, priority, tags };
}

export function serializeCardMetadata(
  metadata: CardMetadata,
  body: string,
): string {
  const metadataLines: string[] = [];
  const cleanPriority = metadata.priority?.trim();
  const cleanTags = metadata.tags.map((tag) => tag.trim()).filter(Boolean);
  const cleanCategory = metadata.category.trim();
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

  if (metadataLines.length === 0) {
    return cleanBody;
  }

  return cleanBody
    ? `${metadataLines.join("\n")}\n\n${cleanBody}`
    : metadataLines.join("\n");
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
