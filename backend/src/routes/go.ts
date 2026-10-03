// Click redirect for email links: /go/<sendId>/<jobId> logs the click when
// that job was in that send, then 302s to the job's original post. Unknown
// jobs fall back to the feed.

import { Hono } from "hono";
import { prisma } from "../lib/prisma.js";
import { frontendUrl } from "../lib/site-urls.js";

const go = new Hono();

go.get("/:sendId/:jobId", async (c) => {
  const sendId = c.req.param("sendId");
  const jobId = Number(c.req.param("jobId"));
  const fallback = `${frontendUrl()}/?utm_source=nudge&utm_medium=email`;
  if (!sendId || !Number.isInteger(jobId) || jobId <= 0) return c.redirect(fallback, 302);

  const [send, job] = await Promise.all([
    prisma.nudgeSend.findUnique({ where: { id: sendId }, select: { id: true, clickedAt: true, jobIds: true } }),
    prisma.job.findUnique({ where: { id: jobId }, select: { sourceUrl: true } }),
  ]);

  if (send && send.jobIds.includes(jobId)) {
    const now = new Date();
    await prisma.$transaction([
      prisma.nudgeClick.create({ data: { sendId: send.id, jobId, source: "redirect", url: c.req.url.slice(0, 2000) } }),
      prisma.nudgeSend.update({ where: { id: send.id }, data: { clickedAt: send.clickedAt ?? now } }),
    ]);
  }

  const target = job?.sourceUrl && /^https?:\/\//i.test(job.sourceUrl) ? job.sourceUrl : fallback;
  c.header("Cache-Control", "no-store");
  return c.redirect(target, 302);
});

export default go;
