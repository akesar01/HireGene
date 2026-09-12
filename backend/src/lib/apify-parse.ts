export const OPEN_APIFY_STATUSES = ["RUNNING", "READY"] as const;

export function isOpenApifyStatus(status: string): boolean {
  return (OPEN_APIFY_STATUSES as readonly string[]).includes(status);
}

export interface ApifyPostShape {
  text?: string;
  content?: string;
  url?: string;
  post_url?: string;
  posts?: ApifyPostShape[];
  data?: { posts?: ApifyPostShape[] };
}

/** Apify dataset items are a flat array; some actors wrap posts in one object. */
export function parseApifyDataset<T extends ApifyPostShape>(raw: unknown): T[] {
  if (Array.isArray(raw)) {
    return raw.flatMap((item) => {
      if (item && typeof item === "object" && Array.isArray((item as T).posts)) {
        return ((item as T).posts ?? []) as T[];
      }
      return [item as T];
    });
  }
  if (raw && typeof raw === "object") {
    const obj = raw as ApifyPostShape;
    if (Array.isArray(obj.data?.posts)) return obj.data.posts as T[];
    if (Array.isArray(obj.posts)) return obj.posts as T[];
  }
  return [];
}
