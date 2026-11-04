// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import AuthorAvatar, { AVATAR_SIZE } from "./AuthorAvatar";

const src = "https://media.licdn.com/dms/image/v2/abc/profile-displayphoto-shrink_800_800/0/1?e=1&v=beta&t=sig";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("AuthorAvatar", () => {
  let container: HTMLDivElement | null = null;
  afterEach(() => {
    container?.remove();
    container = null;
  });

  it("renders a sized, lazy, async-decoded image", () => {
    const html = renderToStaticMarkup(<AuthorAvatar src={src} name="Asha Rao" />);
    const img = new DOMParser().parseFromString(html, "text/html").querySelector("img")!;
    expect(img.getAttribute("width")).toBe(String(AVATAR_SIZE));
    expect(img.getAttribute("height")).toBe(String(AVATAR_SIZE));
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("decoding")).toBe("async");
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(img.getAttribute("src")).toBe(src);
    expect(img.getAttribute("alt")).toBe("Asha Rao");
  });

  it("shows the initial when there is no avatar", () => {
    const html = renderToStaticMarkup(<AuthorAvatar src={null} name="Asha Rao" />);
    expect(html).not.toContain("<img");
    expect(html).toContain(">A</div>");
  });

  it("falls back to the initial when the image fails to load", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => root.render(<AuthorAvatar src={src} name="Asha Rao" />));

    const img = container.querySelector("img")!;
    expect(img).not.toBeNull();
    await act(async () => {
      img.dispatchEvent(new Event("error"));
    });

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("A");
    await act(async () => root.unmount());
  });
});
