import { Response, Request } from "express";
import { get, push, ref, set, update } from "firebase/database";
import { database } from "../firebaseConfig";
import {
  AIDataSnapshot,
  AIJsonValue,
  AISection,
  AIStoredEntry,
} from "../types/ai";

const NUMBERED_SECTION_REGEX = /(?:^|\s)(\d+)\)\s*([\s\S]*?)(?=(?:\s\d+\)\s)|$)/g;
const BULLET_SPLIT_REGEX = /\s+-\s+/;
const JSON_WRAPPER_KEYS = new Set([
  "title",
  "prompt",
  "content",
  "text",
  "payload",
  "data",
  "result",
]);

const normalizeWhitespace = (value: string): string =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\u200f/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isJsonValue = (value: unknown): value is AIJsonValue => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }

  if (isPlainObject(value)) {
    return Object.values(value).every(isJsonValue);
  }

  return false;
};

const extractItems = (content: string): string[] =>
  content
    .split(BULLET_SPLIT_REGEX)
    .map((item) => item.trim())
    .filter(Boolean);

const createSection = (order: number, sectionText: string): AISection => {
  const cleanedText = normalizeWhitespace(sectionText);
  const dividerIndex = cleanedText.indexOf(" - ");

  if (dividerIndex === -1) {
    return {
      order,
      title: `Section ${order}`,
      content: cleanedText,
      items: extractItems(cleanedText),
    };
  }

  const title = cleanedText.slice(0, dividerIndex).trim();
  const content = cleanedText.slice(dividerIndex + 3).trim();

  return {
    order,
    title: title || `Section ${order}`,
    content,
    items: extractItems(content),
  };
};

const parseSections = (rawText: string, fallbackTitle?: string): AISection[] => {
  const normalizedText = normalizeWhitespace(rawText);
  const sections: AISection[] = [];
  let match: RegExpExecArray | null;

  NUMBERED_SECTION_REGEX.lastIndex = 0;

  while ((match = NUMBERED_SECTION_REGEX.exec(normalizedText)) !== null) {
    const order = Number(match[1]);
    const sectionText = match[2]?.trim();

    if (!sectionText) {
      continue;
    }

    sections.push(createSection(order, sectionText));
  }

  if (sections.length > 0) {
    return sections;
  }

  return [
    {
      order: 1,
      title: fallbackTitle?.trim() || "AI Response",
      content: normalizedText,
      items: extractItems(normalizedText),
    },
  ];
};

const buildPayloadSummary = (payload: AIJsonValue): string => {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return "JSON array (0 items)";
    }

    const firstItem = payload[0];

    if (isPlainObject(firstItem)) {
      const type = typeof firstItem.type === "string" ? firstItem.type : "JSON array";
      const date =
        typeof firstItem.date === "string" ? ` - ${firstItem.date}` : "";

      return `${type}${date} (${payload.length} item${payload.length === 1 ? "" : "s"})`;
    }

    return `JSON array (${payload.length} items)`;
  }

  if (isPlainObject(payload)) {
    const type = typeof payload.type === "string" ? payload.type : "JSON object";
    const date = typeof payload.date === "string" ? ` - ${payload.date}` : "";

    return `${type}${date}`;
  }

  return String(payload);
};

const buildStoredEntry = (
  input: string | AIJsonValue,
  title?: string
): AIStoredEntry => {
  const payload = typeof input === "string" ? undefined : input;
  const rawText =
    typeof input === "string" ? input : JSON.stringify(input, null, 2);
  const normalizedText = normalizeWhitespace(rawText);
  const sections = parseSections(normalizedText, title);
  const summary =
    payload !== undefined
      ? buildPayloadSummary(payload)
      : sections[0]?.items[0] ||
        sections[0]?.content ||
        normalizedText.slice(0, 200);

  return {
    title: title?.trim() || "AI Response",
    rawText: normalizedText,
    summary,
    sections,
    createdAt: new Date().toISOString(),
    ...(payload !== undefined ? { payload } : {}),
  };
};

const getRequestText = (body: Request["body"]): string => {
  if (typeof body?.prompt === "string" && body.prompt.trim()) {
    return body.prompt;
  }

  if (typeof body?.content === "string" && body.content.trim()) {
    return body.content;
  }

  if (typeof body?.text === "string" && body.text.trim()) {
    return body.text;
  }

  return "";
};

const getRequestPayload = (body: Request["body"]): AIJsonValue | undefined => {
  if (isPlainObject(body)) {
    const payloadCandidates = [body.payload, body.data, body.result];

    for (const candidate of payloadCandidates) {
      if (isJsonValue(candidate)) {
        return candidate;
      }
    }

    const hasBusinessKeys = Object.keys(body).some(
      (key) => !JSON_WRAPPER_KEYS.has(key)
    );

    if (hasBusinessKeys && isJsonValue(body)) {
      return body;
    }

    return undefined;
  }

  if (Array.isArray(body) && isJsonValue(body)) {
    return body;
  }

  return undefined;
};

const getRequestTitle = (body: Request["body"]): string | undefined => {
  if (
    isPlainObject(body) &&
    typeof body.title === "string" &&
    body.title.trim()
  ) {
    return body.title.trim();
  }

  return undefined;
};


// حفظ snapshot يومي
export const saveSnapshot = async (req: Request, res: Response) => {
  try {
    console.log("Received snapshot save request with body:", req.body.prompt);
    const data = req.body.prompt;

    if (!data || !data.date) {
      return res.status(400).json({ error: "Missing snapshot data or date" });
    }

    const snapshotRef = ref(database, `analytics/snapshots/${data.date}`);

    await set(snapshotRef, {
      ...data,
      createdAt: new Date().toISOString(),
    });

    res.json({ message: "Snapshot saved successfully" });
  } catch (error: any) {
    console.error("Error saving snapshot:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getLatestResponse = async (req: Request, res: Response) => {
  console.log("Received request to /latest");

  try {
    const snapshot = await get(ref(database, "ai"));

    if (!snapshot.exists()) {
      return res.status(404).json({ error: "No AI data found." });
    }

    const aiData = snapshot.val() as AIDataSnapshot;

    if (aiData.lastResponse) {
      return res.status(200).json({
        entryId: aiData.lastResponseId || null,
        updatedAt: aiData.updatedAt || aiData.lastResponse.createdAt,
        data: aiData.lastResponse,
      });
    }

    if (typeof aiData.lastPrompt === "string" && aiData.lastPrompt.trim()) {
      const fallbackEntry = buildStoredEntry(aiData.lastPrompt);

      return res.status(200).json({
        entryId: aiData.lastResponseId || null,
        updatedAt: aiData.updatedAt || fallbackEntry.createdAt,
        data: fallbackEntry,
      });
    }

    return res.status(404).json({ error: "No AI response found." });
  } catch (error: any) {
    console.error("Error fetching latest AI response:", error);
    return res.status(500).json({
      error: "An error occurred while fetching the AI response.",
    });
  }
};

export const allData = async (req: Request, res: Response) => {
  const dbRef = ref(database);
  try {
    const snapshot = await get(dbRef);

    if (snapshot.exists()) {
      const data = snapshot.val() as Record<string, unknown>;
      const { users, ...allDataExceptUsers } = data;

      return res.status(200).json(allDataExceptUsers);
    } else {
      return res.status(404).json({ error: "No data found." });
    }
  } catch (error) {
    console.error("Error fetching all data except users:", error);
    return res.status(500).json({
      error: "An error occurred while fetching the data.",
    });
  }
};
