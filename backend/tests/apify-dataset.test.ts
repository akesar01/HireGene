import { describe, expect, it } from "vitest";
import { isOpenApifyStatus, parseApifyDataset } from "../src/lib/apify-parse";

describe("parseApifyDataset", () => {
  it("reads a flat item array from the dataset API", () => {
    const posts = parseApifyDataset([
      { url: "https://linkedin.com/posts/a", text: "hiring" },
      { post_url: "https://linkedin.com/posts/b", content: "we are hiring" },
    ]);
    expect(posts).toHaveLength(2);
    expect(posts[0].url).toContain("/posts/a");
    expect(posts[1].post_url).toContain("/posts/b");
  });

  it("unwraps a single object that contains posts[]", () => {
    const posts = parseApifyDataset({
      posts: [{ url: "https://linkedin.com/posts/c", text: "role" }],
    });
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toContain("/posts/c");
  });

  it("unwraps data.posts", () => {
    const posts = parseApifyDataset({
      data: { posts: [{ url: "https://linkedin.com/posts/d" }] },
    });
    expect(posts).toHaveLength(1);
  });

  it("returns empty for unknown shapes", () => {
    expect(parseApifyDataset(null)).toEqual([]);
    expect(parseApifyDataset({})).toEqual([]);
  });
});

describe("isOpenApifyStatus", () => {
  it("treats RUNNING and READY as in-flight", () => {
    expect(isOpenApifyStatus("RUNNING")).toBe(true);
    expect(isOpenApifyStatus("READY")).toBe(true);
    expect(isOpenApifyStatus("SUCCEEDED")).toBe(false);
    expect(isOpenApifyStatus("FAILED")).toBe(false);
  });
});
