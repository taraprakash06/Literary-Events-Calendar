export function LiteraryCalendarLogo({
  className,
  "aria-hidden": ariaHidden = true,
}: {
  className?: string;
  "aria-hidden"?: boolean;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden={ariaHidden}
      focusable="false"
    >
      <rect
        x="5"
        y="9"
        width="22"
        height="19"
        rx="2"
        ry="2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 9V6.5M16 9V6.5M22 9V6.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M5 14h22M5 19h22M13 14v14"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        opacity={0.85}
      />
      <path
        d="M11 23l9-11 2.2 2.2-9 11-2.8.6.6-2.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M20 12l2 2"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
      <path
        d="M11 23l2-2"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}
