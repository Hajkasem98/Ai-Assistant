export type Role = "user" | "assistant";

export type ApiMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatRequest = {
  question: string;
  messages: ApiMessage[];
  topK: number;
};

export type SourceHit = {
  title?: string | null;
  url?: string | null;
  contentSnippet: string;
};

export type Message = {
  id: string;
  role: Role;
  content: string;
  sources?: SourceHit[];
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};
