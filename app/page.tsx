import Link from 'next/link'

export default function Home() {
  return (
    <div
      className="flex flex-col flex-1"
      style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
    >
      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          {/* Logo lockup */}
          <Link href="/" className="flex items-center gap-2.5 no-underline">
            {/* Brand mark — sun on horizon */}
            <svg
              width="28"
              height="20"
              viewBox="0 0 28 20"
              fill="none"
              aria-hidden="true"
            >
              {/* Horizon line */}
              <line
                x1="2"
                y1="14"
                x2="26"
                y2="14"
                stroke="var(--text)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* Gap in horizon (nomad passes through) */}
              <line
                x1="11"
                y1="14"
                x2="17"
                y2="14"
                stroke="var(--bg)"
                strokeWidth="2"
              />
              {/* Sun half-circle */}
              <path
                d="M10 14 A4 4 0 0 1 18 14"
                fill="var(--accent)"
                stroke="none"
              />
              {/* Sun dot */}
              <circle cx="14" cy="10" r="1.5" fill="var(--primary)" />
            </svg>
            <span
              className="text-display-sm"
              style={{ letterSpacing: "-0.035em" }}
            >
              JobNomad<span style={{ color: "var(--accent)" }}>.</span>
            </span>
          </Link>

          {/* Actions */}
          <nav className="flex items-center gap-2">
            <Link
              href="/auth/login"
              className="text-label-md px-3 py-1.5 rounded-md transition-colors"
              style={{ color: "var(--text-soft)" }}
            >
              Sign in
            </Link>
            <Link
              href="/auth/login"
              className="text-label-md px-4 py-1.5 rounded-md transition-colors"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--surface)",
                borderRadius: "var(--radius-md)",
              }}
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <main className="flex flex-col flex-1">
        <section
          className="flex flex-col items-center text-center px-6 pt-20 pb-16"
          style={{ backgroundColor: "var(--bg)" }}
        >
          {/* Eyebrow */}
          <p
            className="text-overline mb-4"
            style={{ color: "var(--primary)" }}
          >
            Direction &middot; Sable lumineux
          </p>

          {/* Display headline */}
          <h1 className="text-display-2xl max-w-3xl mb-6">
            Remote jobs for a{" "}
            <em style={{ color: "var(--primary)", fontStyle: "italic" }}>
              calm,
            </em>{" "}
            focused workday.
          </h1>

          {/* Sub */}
          <p
            className="text-body-xl max-w-xl mb-10"
            style={{ color: "var(--text-soft)" }}
          >
            JobNomad matches your skills and timezone to real remote roles —
            no noise, no spray-and-pray.
          </p>

          {/* CTA */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/login"
              className="text-label-md inline-flex items-center gap-2 px-6 py-3 transition-colors"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--surface)",
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              Start for free
            </Link>
            <Link
              href="/jobs"
              className="text-label-md inline-flex items-center gap-2 px-6 py-3 border transition-colors"
              style={{
                borderColor: "var(--border-strong)",
                color: "var(--text)",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--surface)",
              }}
            >
              Browse jobs
            </Link>
          </div>
        </section>

        {/* ── Sample job cards ─────────────────────────────────────────── */}
        <section
          className="flex-1 px-6 py-16"
          style={{ backgroundColor: "var(--bg-tint)" }}
        >
          <div className="mx-auto max-w-4xl">
            <h2
              className="text-display-lg mb-2"
              style={{ color: "var(--text)" }}
            >
              Today&apos;s real remote.
            </h2>
            <p
              className="text-body-lg mb-10"
              style={{ color: "var(--text-soft)" }}
            >
              Positions updated every hour. Match score updates when you complete
              your profile.
            </p>

            {/* Card list */}
            <ul className="flex flex-col gap-3 list-none p-0 m-0">
              {SAMPLE_JOBS.map((job) => (
                <li key={job.id}>
                  <article
                    className="flex items-start justify-between gap-4 p-5 border transition-shadow"
                    style={{
                      backgroundColor: "var(--surface)",
                      borderColor: "var(--border)",
                      borderRadius: "var(--radius-lg)",
                      boxShadow: "var(--shadow-xs)",
                    }}
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      {/* Company overline */}
                      <p
                        className="text-overline"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {job.company}
                      </p>
                      {/* Job title */}
                      <h3
                        className="text-display-sm"
                        style={{ color: "var(--text)" }}
                      >
                        {job.title}
                      </h3>
                      {/* Meta */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        <span
                          className="text-mono-sm"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {job.tz} &middot; {job.type} &middot; {job.posted}
                        </span>
                      </div>
                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {job.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-label-sm px-2 py-0.5"
                            style={{
                              backgroundColor: "var(--primary-soft)",
                              color: "var(--primary)",
                              borderRadius: "var(--radius-sm)",
                            }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Match score badge */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <ScoreBadge score={job.score} />
                      <span
                        className="text-label-md"
                        style={{ color: "var(--text-soft)" }}
                      >
                        {job.salary}
                      </span>
                    </div>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer
        className="border-t px-6 py-8"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--surface)",
        }}
      >
        <div
          className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-4"
        >
          <span
            className="text-caption"
            style={{ color: "var(--text-muted)" }}
          >
            &copy; {new Date().getFullYear()} jobnomad.app &middot; Foundations
            v0.1
          </span>
          <nav className="flex gap-5">
            {["Privacy", "Terms", "Status"].map((item) => (
              <Link
                key={item}
                href={`/${item.toLowerCase()}`}
                className="text-caption transition-colors"
                style={{ color: "var(--text-muted)" }}
              >
                {item}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* ── Score badge ─────────────────────────────────────────────────────────── */
function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 85
      ? "var(--score-high)"
      : score >= 60
        ? "var(--score-mid)"
        : "var(--score-low)";

  const bgVar =
    score >= 85
      ? "var(--primary-soft)"
      : score >= 60
        ? "var(--accent-soft)"
        : "var(--danger-soft)";

  return (
    <span
      className="text-label-sm px-2 py-0.5 tabular-nums"
      style={{
        backgroundColor: bgVar,
        color: color,
        borderRadius: "var(--radius-sm)",
        fontVariantNumeric: "tabular-nums",
      }}
      title={
        score >= 85 ? "Strong fit — apply" : score >= 60 ? "Read and decide" : "Skip"
      }
    >
      {score}
    </span>
  );
}

/* ── Sample data (replace with real DB query) ────────────────────────────── */
const SAMPLE_JOBS = [
  {
    id: 1,
    company: "Async-First Co.",
    title: "Senior Full-Stack Engineer",
    tz: "UTC±4",
    type: "contractor",
    posted: "2h ago",
    salary: "$120–150k",
    score: 92,
    tags: ["TypeScript", "Next.js", "Postgres"],
  },
  {
    id: 2,
    company: "Remote Platform Inc.",
    title: "Product Designer",
    tz: "UTC±6",
    type: "full-time",
    posted: "5h ago",
    salary: "$90–110k",
    score: 74,
    tags: ["Figma", "Design systems", "B2B"],
  },
  {
    id: 3,
    company: "Distributed Labs",
    title: "DevOps Engineer",
    tz: "UTC±8",
    type: "contract",
    posted: "14h ago",
    salary: "$100–130k",
    score: 41,
    tags: ["Kubernetes", "AWS", "Terraform"],
  },
] as const;
