export interface AISection {
  order: number;
  title: string;
  content: string;
  items: string[];
}

export type AIJsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: AIJsonValue }
  | AIJsonValue[];

export interface AIStoredEntry {
  title: string;
  rawText: string;
  summary: string;
  sections: AISection[];
  createdAt: string;
  payload?: AIJsonValue;
}

export interface AIDataSnapshot {
  lastPrompt?: string;
  lastResponse?: AIStoredEntry;
  lastResponseId?: string;
  updatedAt?: string;
  history?: Record<string, AIStoredEntry>;
}
