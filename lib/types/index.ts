export interface SearchResults {
  images: string[];
  results: SearchResultItem[];
  query: string;
}

export interface ExaSearchResults {
  results: ExaSearchResultItem[];
}

export interface SerperSearchResults {
  searchParameters: {
    q: string;
    type: string;
    engine: string;
  };
  videos: SerperSearchResultItem[];
}

export interface SearchResultItem {
  title: string;
  url: string;
  content: string;
}

export interface ExaSearchResultItem {
  score: number;
  title: string;
  id: string;
  url: string;
  publishedDate: Date;
  author: string;
}

export interface SerperSearchResultItem {
  title: string;
  link: string;
  snippet: string;
  imageUrl: string;
  duration: string;
  source: string;
  channel: string;
  date: string;
  position: number;
}

export interface Chat extends Record<string, any> {
  id: string;
  title: string;
  createdAt: Date;
  userId: string;
  path: string;
  messages: AIMessage[];
  sharePath?: string;
}

export interface AIMessage {
  role: "user" | "assistant" | "system" | "function" | "data" | "tool";
  content: string;
  id: string;
  name?: string;
  type?:
    | "answer"
    | "related"
    | "skip"
    | "inquiry"
    | "input"
    | "input_related"
    | "tool"
    | "followup"
    | "end";
}
