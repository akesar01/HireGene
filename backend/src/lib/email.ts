// Email provider boundary. Resend today; swap by implementing EmailProvider.
// Without RESEND_API_KEY the DryRunProvider renders and records but never
// calls the network, so development and tests send nothing.

import { Resend } from "resend";

export const EMAIL_BATCH_SIZE = 100;
export const DEFAULT_EMAIL_FROM = "SkipTheBoard Jobs <jobs@mail.skiptheboard.in>";

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export interface BatchSendResult {
  ok: boolean;
  /** Provider message id per input email, in order; null where the provider gave none. */
  ids: (string | null)[];
  error?: string;
  dryRun: boolean;
}

export interface EmailProvider {
  readonly name: string;
  readonly dryRun: boolean;
  sendBatch(emails: OutgoingEmail[]): Promise<BatchSendResult>;
}

export function emailFrom(env: NodeJS.ProcessEnv = process.env): string {
  return env.EMAIL_FROM?.trim() || DEFAULT_EMAIL_FROM;
}

export function emailReplyTo(env: NodeJS.ProcessEnv = process.env): string {
  return env.EMAIL_REPLY_TO?.trim() || "hello@skiptheboard.in";
}

/** RFC 8058 one-click unsubscribe headers. */
export function listUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export class DryRunProvider implements EmailProvider {
  readonly name = "dry-run";
  readonly dryRun = true;

  async sendBatch(emails: OutgoingEmail[]): Promise<BatchSendResult> {
    return { ok: true, ids: emails.map(() => null), dryRun: true };
  }
}

export class ResendProvider implements EmailProvider {
  readonly name = "resend";
  readonly dryRun = false;
  private readonly client: Resend;
  private readonly from: string;
  private readonly replyTo: string;

  constructor(apiKey: string, from: string, replyTo: string) {
    this.client = new Resend(apiKey);
    this.from = from;
    this.replyTo = replyTo;
  }

  async sendBatch(emails: OutgoingEmail[]): Promise<BatchSendResult> {
    if (emails.length === 0) return { ok: true, ids: [], dryRun: false };
    if (emails.length > EMAIL_BATCH_SIZE) {
      return {
        ok: false,
        ids: emails.map(() => null),
        error: `batch of ${emails.length} exceeds ${EMAIL_BATCH_SIZE}`,
        dryRun: false,
      };
    }
    const payload = emails.map((email) => ({
      from: this.from,
      to: email.to,
      replyTo: email.replyTo ?? this.replyTo,
      subject: email.subject,
      html: email.html,
      text: email.text,
      headers: email.headers,
      tags: email.tags,
    }));
    const { data, error } = await this.client.batch.send(payload);
    if (error || !data) {
      return {
        ok: false,
        ids: emails.map(() => null),
        error: error?.message ?? "Resend returned no data",
        dryRun: false,
      };
    }
    const ids = emails.map((_, index) => data.data[index]?.id ?? null);
    return { ok: true, ids, dryRun: false };
  }
}

export function createEmailProvider(env: NodeJS.ProcessEnv = process.env): EmailProvider {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) return new DryRunProvider();
  return new ResendProvider(apiKey, emailFrom(env), emailReplyTo(env));
}
