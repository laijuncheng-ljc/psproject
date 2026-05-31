export interface OpenedMarkdownFile {
  name: string;
  handle: FileSystemFileHandle;
  content: string;
}

const UNSUPPORTED_MESSAGE =
  "当前浏览器不支持本地文件读写。请使用 Chrome 或 Edge 桌面版。";
const BLOCKED_CONTEXT_MESSAGE =
  "当前浏览器阻止了本地文件访问。请在 Chrome 或 Edge 桌面版中打开 http://127.0.0.1:5173/ 后再选择 .md 文件；Codex 内置浏览器通常不能写回本地文件。";

export function supportsLocalMarkdownFiles(): boolean {
  return typeof window !== "undefined" && "showOpenFilePicker" in window;
}

export async function openMarkdownFile(): Promise<OpenedMarkdownFile> {
  if (!window.showOpenFilePicker) {
    throw new Error(UNSUPPORTED_MESSAGE);
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [
        {
          description: "Markdown files",
          accept: {
            "text/markdown": [".md", ".markdown"],
            "text/plain": [".md"],
          },
        },
      ],
    });

    const file = await handle.getFile();
    const content = await file.text();

    return {
      name: file.name || handle.name,
      handle,
      content,
    };
  } catch (error) {
    if (isAbortError(error)) {
      throw error;
    }

    if (isBlockedFileAccessError(error)) {
      throw new Error(BLOCKED_CONTEXT_MESSAGE, { cause: error });
    }

    throw error;
  }
}

export async function saveMarkdownFile(
  handle: FileSystemFileHandle,
  content: string,
): Promise<void> {
  try {
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (error) {
    if (isBlockedFileAccessError(error)) {
      throw new Error(BLOCKED_CONTEXT_MESSAGE, { cause: error });
    }

    throw error;
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isBlockedFileAccessError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "NotAllowedError" || error.name === "SecurityError";
  }

  if (error instanceof Error) {
    return /not allowed by the user agent|platform in the current context/i.test(
      error.message,
    );
  }

  return false;
}

export { BLOCKED_CONTEXT_MESSAGE, UNSUPPORTED_MESSAGE };
