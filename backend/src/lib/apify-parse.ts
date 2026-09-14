export const OPEN_APIFY_STATUSES = ["RUNNING", "READY"] as const;

export function isOpenApifyStatus(status: string): boolean {
  return (OPEN_APIFY_STATUSES as readonly string[]).includes(status);
}

export interface ApifyPostShape {
  type?: string;
  text?: string;
  content?: string;
  url?: string;
  post_url?: string;
  share_url?: string;
  posts?: ApifyPostShape[];
  data?: { posts?: ApifyPostShape[] };
}

export function isApifyPostRow(item: ApifyPostShape | null | undefined): boolean {
  if (!item || typeof item !== "object") return false;
  if (item.type && item.type !== "post") return false;
  const url = item.url ?? item.post_url ?? item.share_url ?? "";
  const text = item.text ?? item.content ?? "";
  return url.length > 0 || text.trim().length > 0;
}

/** Apify dataset items are a flat array; some actors wrap posts in one object. */
export function parseApifyDataset<T extends ApifyPostShape>(raw: unknown): T[] {
  let items: T[] = [];
  if (Array.isArray(raw)) {
    items = raw.flatMap((item) => {
      if (item && typeof item === "object" && Array.isArray((item as T).posts)) {
        return ((item as T).posts ?? []) as T[];
      }
      return [item as T];
    });
  } else if (raw && typeof raw === "object") {
    const obj = raw as ApifyPostShape;
    if (Array.isArray(obj.data?.posts)) items = obj.data.posts as T[];
    else if (Array.isArray(obj.posts)) items = obj.posts as T[];
  }
  return items.filter((item) => isApifyPostRow(item));
}
