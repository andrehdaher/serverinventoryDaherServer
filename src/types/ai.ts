export interface AISection {
  order: number;
  title: string;
  content: string;
  items: string[];
}

export interface AIStoredEntry {
  title: string;
  rawText: string;
  summary: string;
  sections: AISection[];
  createdAt: string;
}

export interface AIDataSnapshot {
  lastPrompt?: string;
  lastResponse?: AIStoredEntry;
  lastResponseId?: string;
  updatedAt?: string;
  history?: Record<string, AIStoredEntry>;
}
