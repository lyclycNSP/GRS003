import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type RidingSignalPayload = {
  messageId: string;
  idempotencyKey: string;
  timestamp: string;
  raceId: string;
  registrationId: string;
  raceProjectId: string;
  caConnectionId: string;
  caSessionId: string;
  progressPercent?: number;
  tokens?: number;
};

export type RidingSignalAttestation = {
  source: string;
  signingKeyId: string;
  signature: string;
  signedAt: string;
};

type ConnectorKey = { keyId: string; secret: string };

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function configuredKeys(): Record<string, ConnectorKey> {
  const raw = process.env.CA_CONNECTOR_KEYS;
  if (raw) {
    const parsed = JSON.parse(raw) as Record<string, ConnectorKey>;
    return parsed;
  }
  if (process.env.NODE_ENV === "production") return {};
  return {
    "github-oauth-demo-connector": {
      keyId: "local-key-github-oauth-demo-connector",
      secret: "local-development-only-secret-change-me"
    },
    "codex-demo": {
      keyId: "local-key-codex-demo",
      secret: "local-development-only-secret-change-me"
    },
    "e2e-connector": {
      keyId: "local-key-e2e-connector",
      secret: "local-development-only-secret-change-me"
    }
  };
}

export function getConnectorSigningKey(connectorId: string): ConnectorKey | null {
  return configuredKeys()[connectorId] ?? null;
}

function signingContent(payload: RidingSignalPayload, attestation: Omit<RidingSignalAttestation, "signature">) {
  return stableJson({ payload, attestation });
}

export function createRidingSignalAttestation(
  connectorId: string,
  payload: RidingSignalPayload,
  source = "registered_ca_connector"
): RidingSignalAttestation {
  const key = getConnectorSigningKey(connectorId);
  if (!key) throw new Error(`No signing key configured for connector ${connectorId}`);
  const unsigned = { source, signingKeyId: key.keyId, signedAt: new Date().toISOString() };
  const signature = createHmac("sha256", key.secret).update(signingContent(payload, unsigned)).digest("base64url");
  return { ...unsigned, signature };
}

export function verifyRidingSignalAttestation(
  connectorId: string,
  expectedSigningKeyId: string,
  payload: RidingSignalPayload,
  attestation?: RidingSignalAttestation
) {
  if (!attestation) return { ok: false as const, message: "缺少CA connector认证声明，信号已隔离。" };
  if (!['ocr_desktop_app', 'registered_ca_connector'].includes(attestation.source)) {
    return { ok: false as const, message: "CA信号来源未获授权，信号已隔离。" };
  }
  const key = getConnectorSigningKey(connectorId);
  if (!key || key.keyId !== expectedSigningKeyId || attestation.signingKeyId !== expectedSigningKeyId) {
    return { ok: false as const, message: "CA信号签名密钥未登记或不匹配，信号已隔离。" };
  }
  const signedAt = Date.parse(attestation.signedAt);
  const timestamp = Date.parse(payload.timestamp);
  const now = Date.now();
  if (!Number.isFinite(signedAt) || !Number.isFinite(timestamp) || Math.abs(now - signedAt) > 5 * 60 * 1000 || Math.abs(signedAt - timestamp) > 60 * 1000) {
    return { ok: false as const, message: "CA信号超出签名时间窗，疑似重放，信号已隔离。" };
  }
  const unsigned = { source: attestation.source, signingKeyId: attestation.signingKeyId, signedAt: attestation.signedAt };
  const expected = createHmac("sha256", key.secret).update(signingContent(payload, unsigned)).digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(attestation.signature, "base64url");
  } catch {
    return { ok: false as const, message: "CA信号签名格式无效，信号已隔离。" };
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false as const, message: "CA信号HMAC校验失败，疑似伪造或篡改，信号已隔离。" };
  }
  return {
    ok: true as const,
    payloadHash: createHash("sha256").update(stableJson(payload)).digest("hex"),
    signedAt: new Date(signedAt)
  };
}
