import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./config", () => ({
  BACKEND_URL: "https://backend.test",
  API_KEY: "test-api-key",
}));

import { ANONYMOUS_FEED_REVALIDATE_SECONDS, fetchJobs, feedRequestInit } from "./api";
import type { FilterParams } from "./data";

const filters: FilterParams = {
  source: "all",
  roleFamily: "",
  seniority: "",
  remoteMode: "",
  stack: "",
  company: "",
  appliedOnly: false,
};

describe("feedRequestInit", () => {
  it("caches the anonymous feed for 60 seconds", () => {
    const init = feedRequestInit("k");
    expect(ANONYMOUS_FEED_REVALIDATE_SECONDS).toBe(60);
    expect(init.next).toEqual({ revalidate: 60 });
    expect(init.cache).toBeUndefined();
    expect(init.headers).toEqual({ "x-api-key": "k" });
  });

  it("never caches a signed-in request", () => {
    const init = feedRequestInit("k", "user-token");
    expect(init.cache).toBe("no-store");
    expect(init.next).toBeUndefined();
    expect(init.headers).toEqual({ "x-api-key": "k", Authorization: "Bearer user-token" });
  });
});

describe("fetchJobs", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch() {
    const fetchMock = vi.fn(async (..._args: unknown[]) =>
      new Response(JSON.stringify({ jobs: [], count: 0 }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("uses the cached request for anonymous visitors", async () => {
    const fetchMock = stubFetch();
    await fetchJobs("new", filters);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://backend.test/api/posts/recent?sort=new");
    expect(init).toEqual(feedRequestInit("test-api-key"));
  });

  it("uses an uncached request when signed in", async () => {
    const fetchMock = stubFetch();
    await fetchJobs("new", { ...filters, appliedOnly: true }, "user-token");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://backend.test/api/posts/recent?sort=new&applied_only=true");
    expect(init).toEqual(feedRequestInit("test-api-key", "user-token"));
  });
});
