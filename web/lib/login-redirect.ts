export const LOGIN_ERROR_MESSAGES = {
  oauth_not_configured: "GitHub 登录尚未配置。请联系管理员，或在本地开发环境使用 Debug Login。",
  invalid_oauth_callback: "登录校验已失效或不完整，请重新发起登录。",
  oauth_denied: "GitHub 未授权本次登录，请确认授权后重试。",
  github_token_exchange_failed: "GitHub 登录凭据交换失败，请稍后重试。",
  github_identity_failed: "暂时无法读取 GitHub 身份，请稍后重试。",
  github_email_fetch_failed: "暂时无法读取 GitHub 已验证邮箱，请稍后重试。",
  verified_github_email_required: "请先在 GitHub 验证至少一个邮箱，然后重新登录。",
  auth_account_conflict: "该 GitHub 身份与现有账号数据冲突，请联系管理员处理。",
  auth_persistence_failed: "登录状态暂时无法保存，请稍后重试。",
  debug_login_disabled: "Debug Login 当前未启用。",
  debug_user_invalid: "所选 Debug 账号不存在。",
  debug_role_unavailable: "该 Debug 账号没有可用的目标角色资格。"
} as const;

export const GENERIC_LOGIN_ERROR_MESSAGE = "登录暂时未能完成，请重新尝试。";

export type LoginErrorCode = keyof typeof LOGIN_ERROR_MESSAGES;

const CONTROL_OR_BACKSLASH = /[\\\u0000-\u001f\u007f]/;
const HOSTNAME_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export type RequestOriginSource = {
  headers: { get(name: string): string | null };
  nextUrl: { origin: string; protocol: string };
};

function firstForwardedValue(value: string | null): string | null {
  const first = value?.split(",", 1)[0]?.trim();
  return first || null;
}

function validPort(port: string | undefined): boolean {
  if (port === undefined) return true;
  if (!/^\d{1,5}$/.test(port)) return false;
  const numericPort = Number(port);
  return numericPort >= 1 && numericPort <= 65_535;
}

function validIpv4(hostname: string): boolean {
  const segments = hostname.split(".");
  return segments.length === 4 && segments.every((segment) => {
    if (!/^\d{1,3}$/.test(segment)) return false;
    if (segment.length > 1 && segment.startsWith("0")) return false;
    return Number(segment) <= 255;
  });
}

function validHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 253) return false;
  if (/^[\d.]+$/.test(hostname)) return validIpv4(hostname);
  const normalized = hostname.endsWith(".") ? hostname.slice(0, -1) : hostname;
  return Boolean(normalized) && normalized.split(".").every((label) => HOSTNAME_LABEL.test(label));
}

function validHost(host: string): boolean {
  if (!host || host.length > 320 || CONTROL_OR_BACKSLASH.test(host) || /[\s@/?#]/.test(host)) return false;

  let hostname: string;
  let port: string | undefined;
  if (host.startsWith("[")) {
    const bracketedIpv6 = /^\[([0-9a-f:.]+)\](?::(\d{1,5}))?$/i.exec(host);
    if (!bracketedIpv6 || !bracketedIpv6[1].includes(":")) return false;
    hostname = `[${bracketedIpv6[1]}]`;
    port = bracketedIpv6[2];
  } else {
    const hostnameAndPort = /^([^:]+)(?::(\d{1,5}))?$/.exec(host);
    if (!hostnameAndPort) return false;
    hostname = hostnameAndPort[1];
    port = hostnameAndPort[2];
    if (!validHostname(hostname)) return false;
  }
  if (!validPort(port)) return false;

  try {
    const parsed = new URL(`http://${host}`);
    return parsed.hostname === hostname.toLowerCase() || parsed.hostname === hostname;
  } catch {
    return false;
  }
}

export function resolveRequestOrigin(request: RequestOriginSource): string {
  const forwardedHost = firstForwardedValue(request.headers.get("x-forwarded-host"));
  const requestHost = request.headers.get("host")?.trim() || null;
  const host = forwardedHost ?? requestHost;
  const forwardedProto = firstForwardedValue(request.headers.get("x-forwarded-proto"));
  const protocol = (forwardedProto ?? request.nextUrl.protocol).replace(/:$/, "").toLowerCase();
  if ((protocol !== "http" && protocol !== "https") || !host || !validHost(host)) {
    return request.nextUrl.origin;
  }
  return `${protocol}://${host}`;
}

export function sanitizeInternalNext(
  value: string | null | undefined,
  fallback = "/console"
): string {
  if (!value || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || CONTROL_OR_BACKSLASH.test(value)) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://ary.invalid");
    if (parsed.origin !== "https://ary.invalid" || !parsed.pathname.startsWith("/")) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function buildLoginPath(next?: string | null, error?: LoginErrorCode): string {
  const params = new URLSearchParams();
  params.set("next", sanitizeInternalNext(next));
  if (error) params.set("error", error);
  return `/login?${params.toString()}`;
}

export function isLoginErrorCode(value: string | null | undefined): value is LoginErrorCode {
  return Boolean(value && Object.prototype.hasOwnProperty.call(LOGIN_ERROR_MESSAGES, value));
}

export function resolveLoginErrorMessage(value: string | null | undefined): string | null {
  if (!value) return null;
  return isLoginErrorCode(value) ? LOGIN_ERROR_MESSAGES[value] : GENERIC_LOGIN_ERROR_MESSAGE;
}
