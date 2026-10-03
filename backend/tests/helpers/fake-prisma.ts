// Minimal in-memory Prisma stand-in for the nudge tables. Supports the
// subset of the client API the nudge code uses: equality / in / not / gt /
// gte / lt / lte filters, one-level relation filters, include resolvers,
// unique constraints (P2002), createMany skipDuplicates, groupBy for clicks.

import { Prisma } from "@prisma/client";

type Row = Record<string, any>;

function eq(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function cmp(a: unknown, b: unknown): number {
  const av = a instanceof Date ? a.getTime() : (a as number);
  const bv = b instanceof Date ? b.getTime() : (b as number);
  return av < bv ? -1 : av > bv ? 1 : 0;
}

type RelationResolver = (row: Row) => Row | Row[] | null;

export class FakeTable {
  rows: Row[] = [];
  private nextId = 1;
  constructor(
    public name: string,
    private options: {
      uniques?: string[][];
      relations?: Record<string, RelationResolver>;
      stringId?: boolean;
      /** Column defaults the real schema would apply. */
      defaults?: Row;
    } = {},
  ) {}

  private matches(row: Row, where: Row | undefined): boolean {
    if (!where) return true;
    for (const [key, cond] of Object.entries(where)) {
      if (key === "AND") {
        const list = Array.isArray(cond) ? cond : [cond];
        if (!list.every((w) => this.matches(row, w))) return false;
        continue;
      }
      if (key === "OR") {
        if (!(cond as Row[]).some((w) => this.matches(row, w))) return false;
        continue;
      }
      const relation = this.options.relations?.[key];
      if (relation) {
        const related = relation(row);
        if (related === null) return false;
        if (Array.isArray(related)) {
          const some = (cond as Row).some;
          if (some && !related.some((r) => this.matches(r, some))) return false;
          continue;
        }
        if (!this.matches(related, cond as Row)) return false;
        continue;
      }
      const value = row[key];
      if (cond === null) {
        if (value !== null && value !== undefined) return false;
        continue;
      }
      if (cond instanceof Date || typeof cond !== "object") {
        if (!eq(value, cond)) return false;
        continue;
      }
      const c = cond as Row;
      if ("equals" in c && !eq(value, c.equals)) return false;
      if ("in" in c && !c.in.some((v: unknown) => eq(v, value))) return false;
      if ("notIn" in c && c.notIn.some((v: unknown) => eq(v, value))) return false;
      if ("not" in c) {
        if (c.not === null) {
          if (value === null || value === undefined) return false;
        } else if (eq(value, c.not)) return false;
      }
      if ("gt" in c && !(cmp(value, c.gt) > 0)) return false;
      if ("gte" in c && !(cmp(value, c.gte) >= 0)) return false;
      if ("lt" in c && !(cmp(value, c.lt) < 0)) return false;
      if ("lte" in c && !(cmp(value, c.lte) <= 0)) return false;
      if ("has" in c && !(Array.isArray(value) && value.includes(c.has))) return false;
      if ("contains" in c) {
        const hay = String(value ?? "");
        const needle = String(c.contains);
        const ok = c.mode === "insensitive" ? hay.toLowerCase().includes(needle.toLowerCase()) : hay.includes(needle);
        if (!ok) return false;
      }
    }
    return true;
  }

  private shape(row: Row, args: { select?: Row; include?: Row } = {}): Row {
    let out: Row = { ...row };
    if (args.include) {
      for (const [name, arg] of Object.entries(args.include)) {
        if (!arg) continue;
        if (name === "_count") {
          const counts: Row = {};
          for (const rel of Object.keys((arg as Row).select ?? {})) {
            const related = this.options.relations?.[rel]?.(row);
            counts[rel] = Array.isArray(related) ? related.length : related ? 1 : 0;
          }
          out._count = counts;
          continue;
        }
        const related = this.options.relations?.[name]?.(row) ?? null;
        const sub = typeof arg === "object" ? (arg as Row) : {};
        if (Array.isArray(related)) {
          let list = related.map((r) => (sub.select ? pick(r, sub.select) : { ...r }));
          if (sub.orderBy) list = sortBy(list, sub.orderBy);
          out[name] = list;
        } else {
          out[name] = related ? (sub.select ? pick(related, sub.select) : { ...related }) : null;
        }
      }
    }
    if (args.select) out = pick(out, args.select);
    return out;
  }

  private checkUniques(candidate: Row, ignoreId?: unknown): void {
    for (const unique of this.options.uniques ?? []) {
      if (unique.some((k) => candidate[k] === null || candidate[k] === undefined)) continue;
      const clash = this.rows.find(
        (r) => (ignoreId === undefined || r.id !== ignoreId) && unique.every((k) => eq(r[k], candidate[k])),
      );
      if (clash) {
        throw new Prisma.PrismaClientKnownRequestError(`Unique constraint failed on ${unique.join(",")}`, {
          code: "P2002",
          clientVersion: "test",
        });
      }
    }
  }

  private isDuplicate(candidate: Row): boolean {
    try {
      this.checkUniques(candidate);
      return false;
    } catch {
      return true;
    }
  }

  private fillDefaults(data: Row): Row {
    const row: Row = { ...(this.options.defaults ?? {}), ...data };
    if (row.id === undefined) {
      if (this.options.stringId) throw new Error(`${this.name}.create needs an id`);
      row.id = this.nextId++;
    } else if (typeof row.id === "number") {
      this.nextId = Math.max(this.nextId, row.id + 1);
    }
    if (row.createdAt === undefined) row.createdAt = new Date();
    return row;
  }

  async findMany(args: Row = {}): Promise<Row[]> {
    let list = this.rows.filter((r) => this.matches(r, args.where));
    if (args.orderBy) list = sortBy(list, args.orderBy);
    if (args.skip) list = list.slice(args.skip);
    if (args.take) list = list.slice(0, args.take);
    return list.map((r) => this.shape(r, args));
  }

  async findFirst(args: Row = {}): Promise<Row | null> {
    const [first] = await this.findMany({ ...args, take: 1 });
    return first ?? null;
  }

  async findUnique(args: Row): Promise<Row | null> {
    const where = flattenCompound(args.where);
    const row = this.rows.find((r) => this.matches(r, where));
    return row ? this.shape(row, args) : null;
  }

  async count(args: Row = {}): Promise<number> {
    return this.rows.filter((r) => this.matches(r, args.where)).length;
  }

  async create(args: Row): Promise<Row> {
    const row = this.fillDefaults(args.data);
    this.checkUniques(row);
    this.rows.push(row);
    return this.shape(row, args);
  }

  async createMany(args: Row): Promise<{ count: number }> {
    let count = 0;
    for (const data of args.data as Row[]) {
      const row = this.fillDefaults(data);
      if (this.isDuplicate(row)) {
        if (args.skipDuplicates) continue;
        this.checkUniques(row);
      }
      this.rows.push(row);
      count += 1;
    }
    return { count };
  }

  async update(args: Row): Promise<Row> {
    const where = flattenCompound(args.where);
    const row = this.rows.find((r) => this.matches(r, where));
    if (!row) {
      throw new Prisma.PrismaClientKnownRequestError("Record to update not found", { code: "P2025", clientVersion: "test" });
    }
    Object.assign(row, args.data);
    this.checkUniques(row, row.id);
    return this.shape(row, args);
  }

  async updateMany(args: Row): Promise<{ count: number }> {
    const list = this.rows.filter((r) => this.matches(r, args.where));
    for (const row of list) Object.assign(row, args.data);
    return { count: list.length };
  }

  async upsert(args: Row): Promise<Row> {
    const existing = await this.findUnique({ where: args.where });
    if (existing) return this.update({ where: args.where, data: args.update });
    return this.create({ data: args.create });
  }

  async deleteMany(args: Row = {}): Promise<{ count: number }> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !this.matches(r, args.where));
    return { count: before - this.rows.length };
  }

  async groupBy(args: Row): Promise<Row[]> {
    const fields = args.by as string[];
    const groups = new Map<string, { key: Row; count: number }>();
    for (const row of this.rows.filter((r) => this.matches(r, args.where))) {
      const key = pick(row, Object.fromEntries(fields.map((f) => [f, true])));
      const id = JSON.stringify(fields.map((f) => row[f]));
      const group = groups.get(id) ?? { key, count: 0 };
      group.count += 1;
      groups.set(id, group);
    }
    let out = [...groups.values()].map(({ key, count }) => ({ ...key, _count: { _all: count } }));
    out.sort((a, b) => b._count._all - a._count._all);
    if (args.take) out = out.slice(0, args.take);
    return out;
  }
}

function pick(row: Row, select: Row): Row {
  const out: Row = {};
  for (const [key, on] of Object.entries(select)) if (on) out[key] = row[key];
  return out;
}

function sortBy(list: Row[], orderBy: Row | Row[]): Row[] {
  const orders = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...list].sort((a, b) => {
    for (const order of orders) {
      const [key, dir] = Object.entries(order)[0];
      if (typeof dir === "object") continue;
      const c = cmp(a[key], b[key]);
      if (c !== 0) return dir === "desc" ? -c : c;
    }
    return 0;
  });
}

/** `{ campaignId_userId: { campaignId, userId } }` -> `{ campaignId, userId }` */
function flattenCompound(where: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(where)) {
    if (key.includes("_") && value && typeof value === "object" && !(value instanceof Date) && !("in" in value)) {
      Object.assign(out, value);
    } else out[key] = value;
  }
  return out;
}

export function createFakePrisma() {
  const tables: Record<string, FakeTable> = {};
  const t = (name: string, options?: ConstructorParameters<typeof FakeTable>[1]) => (tables[name] = new FakeTable(name, options));

  t("emailPreference", {
    uniques: [["userId"], ["unsubscribeToken"]],
    defaults: {
      email: null,
      subscribed: true,
      frequency: "weekly",
      pausedUntil: null,
      unsubscribedAt: null,
      unsubscribeReason: null,
      lastSentAt: null,
    },
  });
  t("campaignVariant", {
    uniques: [["campaignId", "key"]],
    defaults: { isHoldout: false, subject: null, intro: null, jobCount: null },
  });
  t("campaign", {
    uniques: [["key"]],
    defaults: { status: "draft", jobCount: 5, createdBy: null, startedAt: null, completedAt: null },
    relations: {
      variants: (row) => tables.campaignVariant.rows.filter((v) => v.campaignId === row.id),
      sends: (row) => tables.nudgeSend.rows.filter((s) => s.campaignId === row.id),
    },
  });
  t("nudgeSend", {
    stringId: true,
    uniques: [["campaignId", "userId"], ["providerMessageId"]],
    defaults: {
      variantId: null,
      providerMessageId: null,
      subject: null,
      error: null,
      sentAt: null,
      deliveredAt: null,
      openedAt: null,
      clickedAt: null,
      bouncedAt: null,
      complainedAt: null,
      unsubscribedAt: null,
    },
    relations: { campaign: (row) => tables.campaign.rows.find((c) => c.id === row.campaignId) ?? null },
  });
  t("nudgeClick", {
    defaults: { jobId: null, url: null },
    relations: { send: (row) => tables.nudgeSend.rows.find((s) => s.id === row.sendId) ?? null },
  });
  t("emailEvent", { uniques: [["providerEventId"]] });
  t("appSetting", { uniques: [["key"]] });
  t("job", {
    uniques: [["sourceUrl"]],
    relations: { recruiter: (row) => tables.recruiter.rows.find((r) => r.id === row.recruiterId) ?? null },
  });
  t("recruiter", { uniques: [["linkedinUrl"]] });
  t("jobApplication", { uniques: [["jobId", "userId"]] });

  const prisma: Row = { ...tables };
  prisma.$transaction = async (arg: unknown) => {
    if (typeof arg === "function") return arg(prisma);
    return Promise.all(arg as Promise<unknown>[]);
  };
  prisma.$reset = () => {
    for (const table of Object.values(tables)) table.rows = [];
  };
  return prisma as typeof prisma & Record<string, FakeTable> & { $reset(): void };
}

/** A tiny Mongo collection fake for the `profiles` collection. */
export function createFakeProfiles(docs: Row[]) {
  const matches = (doc: Row, filter: Row = {}): boolean => {
    for (const [key, cond] of Object.entries(filter)) {
      const value = key.split(".").reduce<any>((acc, part) => acc?.[part], doc);
      if (cond && typeof cond === "object" && !(cond instanceof Date)) {
        if ("$exists" in cond && (value !== undefined) !== cond.$exists) return false;
        if ("$in" in cond && !cond.$in.includes(value)) return false;
        if ("$gte" in cond && !(cmp(value, cond.$gte) >= 0)) return false;
      } else if (!eq(value, cond)) return false;
    }
    return true;
  };
  return {
    docs,
    find(filter: Row = {}) {
      let list = docs.filter((d) => matches(d, filter));
      const cursor = {
        sort(spec: Row) {
          const [key, dir] = Object.entries(spec)[0];
          list = [...list].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (dir === -1 ? -1 : 1));
          return cursor;
        },
        limit(n: number) {
          list = list.slice(0, n);
          return cursor;
        },
        async toArray() {
          return list.map((d) => ({ ...d }));
        },
      };
      return cursor;
    },
    async findOne(filter: Row) {
      return docs.find((d) => matches(d, filter)) ?? null;
    },
    async countDocuments(filter: Row = {}) {
      return docs.filter((d) => matches(d, filter)).length;
    },
  };
}
