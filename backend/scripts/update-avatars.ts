import { prisma } from "../src/lib/prisma";
import { readFileSync } from "fs";

const data = JSON.parse(readFileSync("/tmp/apify_dataset.json", "utf-8"));
const updates: Record<string, { avatar?: string; name?: string }> = {};
for (const p of data) {
  const url = p.post_url || "";
  if (!url) continue;
  const avatar = (p.author && p.author.avatar) || p.profile_picture || "";
  const name = (p.author && p.author.name) || p.author_name || "";
  updates[url] = {};
  if (avatar) updates[url].avatar = avatar;
  if (name) updates[url].name = name;
}

async function main() {
  let avatarUpdated = 0;
  let nameUpdated = 0;
  for (const [url, upd] of Object.entries(updates)) {
    if (upd.avatar) {
      const r = await prisma.job.updateMany({ where: { sourceUrl: url, authorAvatar: null }, data: { authorAvatar: upd.avatar } });
      avatarUpdated += r.count;
    }
    if (upd.name) {
      const r = await prisma.job.updateMany({ where: { sourceUrl: url, author: "" }, data: { author: upd.name } });
      nameUpdated += r.count;
    }
  }
  console.log("Avatars updated:", avatarUpdated);
  console.log("Names updated:", nameUpdated);
}

main().then(() => process.exit(0));
