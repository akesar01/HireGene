export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/** Groq shut down llama-3.3-70b-versatile for free/dev on 2026-08-16. */
export const DEFAULT_GROQ_MODELS = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.6-27b",
] as const;

export function groqApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = env.GROQ_API_KEY?.trim();
  return key || undefined;
}

export function groqModelCandidates(env: NodeJS.ProcessEnv = process.env): string[] {
  const preferred = env.GROQ_MODEL?.trim();
  const models = preferred
    ? [preferred, ...DEFAULT_GROQ_MODELS]
    : [...DEFAULT_GROQ_MODELS];
  return [...new Set(models.filter(Boolean))];
}

export function isGroqModelUnavailable(status: number, body: string): boolean {
  if (status !== 404) return false;
  return body.includes("model_not_found") || /does not exist/i.test(body);
}

export interface GroqChatParams {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
  logPrefix?: string;
}

export async function groqChatContent(
  params: GroqChatParams,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  const apiKey = groqApiKey(env);
  if (!apiKey) return null;

  const prefix = params.logPrefix ?? "[Groq]";
  const models = groqModelCandidates(env);
  let lastError = "";

  for (const model of models) {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: params.messages,
        temperature: params.temperature ?? 0,
        max_tokens: params.max_tokens ?? 500,
        ...(params.response_format ? { response_format: params.response_format } : {}),
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      return typeof content === "string" && content.length > 0 ? content : null;
    }

    const body = await res.text();
    lastError = `${res.status} ${body}`;
    if (isGroqModelUnavailable(res.status, body)) {
      console.error(`${prefix} model ${model} unavailable, trying next`);
      continue;
    }
    console.error(`${prefix} Groq API error: ${lastError}`);
    return null;
  }

  if (lastError) {
    console.error(`${prefix} Groq API error: ${lastError}`);
  }
  return null;
}
