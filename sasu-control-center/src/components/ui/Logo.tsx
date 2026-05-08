import { clsx } from "clsx";

type LogoProps = {
  className?: string;
  /** Show the wordmark next to the mark. Default: true */
  withWordmark?: boolean;
  /** Pixel size of the square mark. Default: 28 */
  size?: number;
  /** Hero variant: stacked layout (mark on top, big wordmark + tagline below). */
  hero?: boolean;
  /** Optional tagline shown under the wordmark in hero mode. */
  tagline?: string;
};

/**
 * DigitPro brand mark — Apple-flavored monogram.
 * - default: inline horizontal layout (mark + small wordmark)
 * - hero: vertical layout with the mark XXL + bold display wordmark
 */
export function Logo({
  className,
  withWordmark = true,
  size = 28,
  hero = false,
  tagline
}: LogoProps) {
  if (hero) {
    return (
      <div
        className={clsx(
          "flex flex-col items-center gap-5 text-center",
          className
        )}
      >
        <Mark size={96} hero />
        <div className="space-y-1">
          <div className="font-display text-5xl font-semibold tracking-apple-tight text-ink-900 sm:text-6xl">
            DigitPro
          </div>
          <div className="text-sm font-medium uppercase tracking-[0.18em] text-ink-500">
            Consulting Monitoring
          </div>
        </div>
        {tagline ? (
          <p className="max-w-xs text-balance text-base leading-relaxed text-ink-600">
            {tagline}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={clsx("inline-flex items-center gap-2.5", className)}>
      <Mark size={size} />
      {withWordmark && (
        <div className="flex items-baseline gap-1.5 leading-none">
          <span className="font-display text-[15px] font-semibold tracking-apple-tight text-ink-900">
            DigitPro
          </span>
          <span className="text-[12px] font-normal text-ink-500">Monitoring</span>
        </div>
      )}
    </div>
  );
}

function Mark({ size = 28, hero = false }: { size?: number; hero?: boolean }) {
  return (
    <div
      className={clsx(
        "relative inline-block",
        hero && "drop-shadow-[0_8px_24px_rgba(0,113,227,0.18)]"
      )}
    >
      {hero ? (
        <span
          aria-hidden
          className="absolute inset-[-12%] -z-10 rounded-[28%] bg-[radial-gradient(circle_at_30%_20%,rgba(0,113,227,0.14),transparent_60%)] blur-md"
        />
      ) : null}
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="DigitPro"
        role="img"
      >
        <defs>
          <linearGradient
            id={hero ? "dp-bg-hero" : "dp-bg"}
            x1="0"
            y1="0"
            x2="40"
            y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#1D1D1F" />
            <stop offset="100%" stopColor="#000000" />
          </linearGradient>
          <linearGradient
            id={hero ? "dp-shine-hero" : "dp-shine"}
            x1="0"
            y1="0"
            x2="0"
            y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
            <stop offset="60%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="36"
          height="36"
          rx="9"
          fill={`url(#${hero ? "dp-bg-hero" : "dp-bg"})`}
        />
        <rect
          x="2"
          y="2"
          width="36"
          height="36"
          rx="9"
          fill={`url(#${hero ? "dp-shine-hero" : "dp-shine"})`}
        />
        {/* mini bars */}
        <rect x="10" y="22" width="3.5" height="9" rx="1" fill="#FFFFFF" />
        <rect x="16" y="17" width="3.5" height="14" rx="1" fill="#FFFFFF" />
        <rect x="22" y="12" width="3.5" height="19" rx="1" fill="#FFFFFF" />
        {/* trend line */}
        <path
          d="M11.75 19 L17.75 14 L23.75 9.5 L29 7.5"
          stroke="#FFFFFF"
          strokeOpacity="0.55"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* blue accent peak */}
        <circle cx="30" cy="9" r="2.5" fill="#0071E3" />
        <circle cx="30" cy="9" r="1.1" fill="#FFFFFF" fillOpacity="0.92" />
      </svg>
    </div>
  );
}
