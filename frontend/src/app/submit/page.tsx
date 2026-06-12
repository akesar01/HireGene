import Link from "next/link";

export default function SubmitPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <header className="mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-[15px] font-bold text-foreground lowercase">
              hiring feed.
            </h1>
          </Link>
          <p className="mt-1 text-[12px] text-muted">
            ← <Link href="/" className="hover:text-foreground transition-colors">back to feed</Link>
          </p>
        </header>

        <div className="max-w-md">
          <h2 className="text-[14px] font-bold text-foreground">add a job post</h2>
          <p className="mt-1 text-[11px] text-muted">
            paste a linkedin or x post link from an actual hiring manager.
          </p>

          <form className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="url"
                className="block text-[11px] font-semibold text-muted mb-1.5"
              >
                post url
              </label>
              <input
                id="url"
                type="url"
                required
                placeholder="https://linkedin.com/posts/..."
                className="w-full rounded border border-border bg-white px-3 py-2 text-[12px] text-foreground placeholder:text-muted-light focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
              />
            </div>

            <div>
              <label
                htmlFor="source"
                className="block text-[11px] font-semibold text-muted mb-1.5"
              >
                source
              </label>
              <select
                id="source"
                className="w-full rounded border border-border bg-white px-3 py-2 text-[12px] text-foreground focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
              >
                <option value="linkedin">linkedin</option>
                <option value="x">x (twitter)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="note"
                className="block text-[11px] font-semibold text-muted mb-1.5"
              >
                note (optional)
              </label>
              <textarea
                id="note"
                rows={3}
                placeholder="any context you want to add..."
                className="w-full rounded border border-border bg-white px-3 py-2 text-[12px] text-foreground placeholder:text-muted-light focus:border-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20 resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded bg-foreground px-4 py-2 text-[12px] font-semibold text-background hover:bg-foreground/90 transition-colors"
            >
              submit post
            </button>
          </form>

          <p className="mt-4 text-[10px] text-muted-light">
            submissions are reviewed before going live.
          </p>
        </div>
      </div>
    </div>
  );
}
