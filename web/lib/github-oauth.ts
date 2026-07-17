export type GithubUser = {
  id: number;
  login: string;
  name?: string | null;
  avatar_url?: string | null;
};

export type GithubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
};

export type GithubIdentity = {
  user: GithubUser;
  email: string | null;
  verifiedEmails: string[];
};

export type GithubOAuthStage = "token_exchange" | "identity_fetch" | "email_fetch";

export class GithubOAuthError extends Error {
  constructor(public readonly stage: GithubOAuthStage, message: string) {
    super(message);
    this.name = "GithubOAuthError";
  }
}

export function listVerifiedGithubEmails(emails: GithubEmail[]): string[] {
  const result = emails
    .filter((item) => item.verified && item.email.trim())
    .sort((left, right) => Number(right.primary) - Number(left.primary))
    .map((item) => item.email.trim().toLowerCase());
  return result.filter((email, index) => result.indexOf(email) === index);
}

export function selectVerifiedGithubEmail(emails: GithubEmail[]): string | null {
  return listVerifiedGithubEmails(emails)[0] ?? null;
}

export async function fetchGithubIdentityOrThrow(
  code: string,
  config: { clientId: string; clientSecret: string; redirectUri: string },
  fetchImpl: typeof fetch = fetch
): Promise<GithubIdentity | null> {
  let tokenResponse: Response;
  try {
    tokenResponse = await fetchImpl("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri
      })
    });
  } catch {
    throw new GithubOAuthError("token_exchange", "GitHub token endpoint request failed");
  }
  if (!tokenResponse.ok) throw new GithubOAuthError("token_exchange", "GitHub token endpoint rejected the request");
  const tokenPayload = await tokenResponse.json().catch(() => null) as { access_token?: string } | null;
  if (!tokenPayload?.access_token) throw new GithubOAuthError("token_exchange", "GitHub token response did not include an access token");

  const headers = {
    authorization: `Bearer ${tokenPayload.access_token}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28"
  };
  const [userResult, emailsResult] = await Promise.allSettled([
    fetchImpl("https://api.github.com/user", { headers }),
    fetchImpl("https://api.github.com/user/emails", { headers })
  ]);
  if (userResult.status === "rejected" || !userResult.value.ok) {
    throw new GithubOAuthError("identity_fetch", "GitHub user endpoint request failed");
  }
  if (emailsResult.status === "rejected" || !emailsResult.value.ok) {
    throw new GithubOAuthError("email_fetch", "GitHub email endpoint request failed");
  }
  const user = await userResult.value.json().catch(() => null) as GithubUser | null;
  if (!user?.id || !user.login) throw new GithubOAuthError("identity_fetch", "GitHub user response was invalid");
  const emails = await emailsResult.value.json().catch(() => null) as GithubEmail[] | null;
  if (!Array.isArray(emails)) throw new GithubOAuthError("email_fetch", "GitHub email response was invalid");
  const verifiedEmails = listVerifiedGithubEmails(emails);
  return { user, email: verifiedEmails[0] ?? null, verifiedEmails };
}

export async function fetchGithubIdentity(
  code: string,
  config: { clientId: string; clientSecret: string; redirectUri: string },
  fetchImpl: typeof fetch = fetch
): Promise<GithubIdentity | null> {
  try {
    return await fetchGithubIdentityOrThrow(code, config, fetchImpl);
  } catch {
    return null;
  }
}
