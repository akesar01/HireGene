// Apply the deterministic ingest gates to every existing Job row.
//
//   npx tsx scripts/reclassify-jobs.ts                 # dry run: print keep/delete per job
//   npx tsx scripts/reclassify-jobs.ts --apply         # delete failing rows, fix titles and companies
//   INGEST_ROLE_FAMILIES=engineering,data npx tsx scripts/reclassify-jobs.ts
//
// Uses only stored fields (title, company, roleFamily, authorTitle, rawText,
// postedAt). No LLM calls. Deleting a job also removes its votes and
// applications.

import { prisma } from "../src/lib/prisma.js";
import { allowedRoleFamilies } from "../src/lib/ingest-gates.js";
import { decideJobs, describeDecision } from "../src/lib/reclassify-jobs.js";

const apply = process.argv.includes("--apply");

async function main() {
  const jobs = await prisma.job.findMany({
    orderBy: [{ recruiterId: "asc" }, { postedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      recruiterId: true,
      title: true,
      company: true,
      roleFamily: true,
      authorTitle: true,
      rawText: true,
      postedAt: true,
      _count: { select: { votes: true, applications: true } },
    },
  });
  const byId = new Map(jobs.map((job) => [job.id, job]));

  console.log(
    `${apply ? "APPLY" : "DRY RUN"}: ${jobs.length} jobs, allowed role families: ${[...allowedRoleFamilies()].join(",")}`,
  );

  const decisions = decideJobs(jobs);
  for (const decision of decisions) {
    const job = byId.get(decision.id)!;
    console.log(
      `#${job.id} ${decision.action.padEnd(6)} ${describeDecision(decision, job)} | ` +
        `"${job.title}" @ ${job.company} [${job.roleFamily}] recruiter=${job.recruiterId} ` +
        `posted=${job.postedAt.toISOString().slice(0, 10)} votes=${job._count.votes} applications=${job._count.applications}`,
    );
  }

  const deletions = decisions.filter((d) => d.action === "delete");
  const fixes = decisions.flatMap((d) => (d.action === "keep" && d.fix ? [{ id: d.id, fix: d.fix }] : []));
  const byReason = new Map<string, number>();
  for (const d of deletions) byReason.set(d.reason, (byReason.get(d.reason) ?? 0) + 1);

  console.log("");
  console.log(
    `Summary: keep=${decisions.length - deletions.length} delete=${deletions.length}` +
      ` (${[...byReason.entries()].map(([k, v]) => `${k}=${v}`).join(", ") || "none"})` +
      ` fix=${fixes.length}`,
  );

  if (!apply) {
    if (deletions.length > 0 || fixes.length > 0) {
      console.log("Dry run only. Re-run with --apply to delete and fix.");
    }
    return;
  }

  for (const d of fixes) {
    const job = byId.get(d.id)!;
    const title = d.fix.title ?? job.title;
    const company = d.fix.company ?? job.company;
    await prisma.job.update({
      where: { id: d.id },
      data: { title, company, roleBadge: `${title} @ ${company}` },
    });
  }

  const ids = deletions.map((d) => d.id);
  if (ids.length > 0) {
    const [votes, applications, removed] = await prisma.$transaction([
      prisma.vote.deleteMany({ where: { jobId: { in: ids } } }),
      prisma.jobApplication.deleteMany({ where: { jobId: { in: ids } } }),
      prisma.job.deleteMany({ where: { id: { in: ids } } }),
    ]);
    console.log(
      `Deleted ${removed.count} jobs (${votes.count} votes, ${applications.count} applications), fixed ${fixes.length}.`,
    );
  } else {
    console.log(`Nothing to delete, fixed ${fixes.length}.`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
