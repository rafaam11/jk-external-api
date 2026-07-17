import { useState } from "preact/hooks";

export default function CopyCode({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return <div class="code-block"><div><span>{label}</span><button onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? "복사됨" : "코드 복사"}</button></div><pre><code>{code}</code></pre></div>;
}
