import { Response, Request } from "express";
import { get, push, ref, set, update } from "firebase/database";
import { database } from "../firebaseConfig";
import { AIDataSnapshot, AISection, AIStoredEntry } from "../types/ai";

const NUMBERED_SECTION_REGEX = /(?:^|\s)(\d+)\)\s*([\s\S]*?)(?=(?:\s\d+\)\s)|$)/g;
const BULLET_SPLIT_REGEX = /\s+-\s+/;

const normalizeWhitespace = (value: string): string =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\u200f/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim();

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

const buildStoredEntry = (rawText: string, title?: string): AIStoredEntry => {
  const normalizedText = normalizeWhitespace(rawText);
  const sections = parseSections(normalizedText, title);
  const summary =
    sections[0]?.items[0] ||
    sections[0]?.content ||
    normalizedText.slice(0, 200);

  return {
    title: title?.trim() || "AI Response",
    rawText: normalizedText,
    summary,
    sections,
    createdAt: new Date().toISOString(),
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

export const generateResponse = async (req: Request, res: Response) => {
  console.log("Received request to /generate");
  const rawText = getRequestText(req.body);
  const title =
    typeof req.body?.title === "string" && req.body.title.trim()
      ? req.body.title
      : undefined;

  if (!rawText.trim()) {
    return res.status(400).json({
      error: "A prompt, content, or text field is required.",
    });
  }

  console.log("Received AI text:", rawText);

  try {
    const entry = buildStoredEntry(rawText, title);
    const historyEntryRef = push(ref(database, "ai/history"));
    const entryId = historyEntryRef.key || `ai-${Date.now()}`;

    await set(historyEntryRef, entry);
    await update(ref(database, "ai"), {
      lastPrompt: entry.rawText,
      lastResponse: entry,
      lastResponseId: entryId,
      updatedAt: entry.createdAt,
    });

    console.log("Stored AI entry:", { entryId, entry });

    return res.status(200).json({
      message: "AI response stored successfully!",
      entryId,
      data: entry,
    });
  } catch (error: any) {
    console.error("Error storing prompt in database:", error);
    return res.status(500).json({
      error: "An error occurred while processing the prompt.",
    });
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
