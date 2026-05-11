/**
 * Agentflow logo. Inline SVG so it inherits `currentColor` from its
 * containing element — the logo recolors automatically when the surrounding
 * theme tokens change.
 */
export function Logo({
  size = 32,
  className,
  title = "Agentflow",
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-label={title}
      className={className}
      role="img"
    >
      <rect
        x={1}
        y={1}
        width={30}
        height={30}
        rx={6}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
      />
      <circle cx={10.5} cy={16} r={2.5} fill="currentColor" />
      <circle
        cx={21.5}
        cy={16}
        r={2.5}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
      />
      <path
        d="M13 16 H19"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </svg>
  );
}
