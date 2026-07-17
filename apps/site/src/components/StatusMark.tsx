type Props = { kind: "auth" | "preview" | "freshness"; value: string };

const icons = { auth: "◇", preview: "↗", freshness: "◷" };
const labels = { auth: "인증", preview: "미리보기", freshness: "갱신" };

export function StatusMark({ kind, value }: Props) {
  return <span class={`status status-${kind}`}><span aria-hidden="true">{icons[kind]}</span> {labels[kind]}: {value}</span>;
}
