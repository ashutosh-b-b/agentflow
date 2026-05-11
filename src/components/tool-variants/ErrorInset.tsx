/** Shared error block rendered inside any tool body when the call errored. */
export function ErrorInset({
  title,
  detail,
}: {
  title?: string;
  detail?: string;
}) {
  return (
    <div className="ar-err-inset">
      <div className="ico" aria-hidden>⚠</div>
      <div className="grow">
        {title && <div className="err-title">{title}</div>}
        {detail && <div className="err-detail">{detail}</div>}
      </div>
    </div>
  );
}
