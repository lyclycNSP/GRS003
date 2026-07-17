"use client";

import { useState } from "react";

export function CopyInviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return <button type="button" onClick={async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
  }}>{copied ? "已复制" : "复制邀请码"}</button>;
}
