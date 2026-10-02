// Verified email addresses live in Clerk, not in the resume profile.
// The address parsed from a resume is never mailed.

import { createClerkClient } from "@clerk/backend";

export interface ClerkUserInfo {
  userId: string;
  email: string | null;
  firstName: string | null;
}

const CLERK_PAGE = 100;

export async function fetchClerkUsers(
  userIds: string[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<Map<string, ClerkUserInfo>> {
  const result = new Map<string, ClerkUserInfo>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return result;

  const secretKey = env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.warn("[Clerk] CLERK_SECRET_KEY not set; no recipient emails available");
    return result;
  }

  const client = createClerkClient({ secretKey });
  for (let i = 0; i < unique.length; i += CLERK_PAGE) {
    const page = unique.slice(i, i + CLERK_PAGE);
    const { data } = await client.users.getUserList({ userId: page, limit: CLERK_PAGE });
    for (const user of data) {
      const primary =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ?? user.emailAddresses[0];
      result.set(user.id, {
        userId: user.id,
        email: primary?.emailAddress ?? null,
        firstName: user.firstName ?? null,
      });
    }
  }
  return result;
}
