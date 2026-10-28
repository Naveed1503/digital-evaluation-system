import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Landmark,
  ArrowRight,
  ShieldCheck,
  FileStack,
  PenLine,
  Stamp,
  GraduationCap,
  Lock,
  Users,
  BarChart3,
  FileCheck2,
  EyeOff,
  History,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import heroVisual from "@/assets/hero-visual.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Digital Evaluation System — Secure On-Screen Valuation" },
      { name: "description", content: "Digital answer-script access, evaluator allocation, online marking, moderation and result declaration." },
      { property: "og:title", content: "Digital Evaluation System" },
      { property: "og:description", content: "Secure, transparent and timely examination evaluation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const STATS = [
  ["100%", "Anonymous scripts"],
  ["5-stage", "Digital pipeline"],
  ["Every action", "Audit logged"],
  ["Role-based", "Secure access"],
];

const FEATURES = [
  {
    icon: FileStack,
    title: "Digital script intake",
    desc: "Scanned answer scripts are uploaded once, assigned anonymous codes, and stored in a private vault — never exposed by name.",
  },
  {
    icon: Users,
    title: "Smart allocation",
    desc: "One click distributes scripts evenly across evaluators and moderators. Reassignment takes seconds, with full history.",
  },
  {
    icon: PenLine,
    title: "On-screen valuation",
    desc: "Question-wise marking with validated limits, per-question remarks, draft saving and automatic totals.",
  },
  {
    icon: Stamp,
    title: "Moderation with accountability",
    desc: "Every mark change demands a reason and is recorded in a permanent revision trail — who, when, old value, new value.",
  },
  {
    icon: BarChart3,
    title: "Instant tabulation",
    desc: "Totals, percentages, grades, pass rates and grade distribution compute themselves. Export to CSV in one click.",
  },
  {
    icon: GraduationCap,
    title: "Student result portal",
    desc: "Students see only their own published results — marks, grade and verdict — nothing else, ever.",
  },
];

const STEPS = [
  ["I", "Script intake", "Scanned scripts uploaded and anonymised."],
  ["II", "Allocation", "Automatic distribution to examiners."],
  ["III", "Valuation", "Question-wise marking with auto-totals."],
  ["IV", "Moderation", "Second review with reason tracking."],
  ["V", "Declaration", "Results graded and published."],
];

const TRUST = [
  { icon: EyeOff, text: "Evaluators never see student identities — only anonymous script codes." },
  { icon: Lock, text: "Scripts live in a private store, reachable only by the assigned examiner." },
  { icon: History, text: "Every assignment, mark, change and publication is written to the audit trail." },
  { icon: FileCheck2, text: "Mark limits are validated server-side; nothing out of range can be submitted." },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Nav ─────────────────────────────── */}
      <nav className="fixed inset-x-0 top-0 z-50 glass-dark border-b border-primary-foreground/10">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:flex sm:justify-between sm:px-6 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gold/15 ring-1 ring-gold/40">
              <Landmark className="h-4.5 w-4.5 text-gold" />
            </div>
            <div>
              <p className="font-serif text-sm leading-tight text-primary-foreground sm:text-[15px]">Digital Evaluation System</p>
              <p className="hidden text-[10px] uppercase tracking-[0.18em] text-primary-foreground/50 sm:block">Office of the Controller</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="hidden text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground sm:inline-flex">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm" variant="gold">
              <Link to="/auth">Enter portal</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────── */}
      <header className="relative overflow-hidden bg-seal pt-28 sm:pt-32 text-primary-foreground">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(oklch(0.76 0.12 82 / 0.12) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pb-12 sm:gap-14 sm:px-6 sm:pb-24 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[10px] sm:px-4 sm:text-xs font-medium tracking-wide text-gold">
              <ShieldCheck className="h-3.5 w-3.5" />
              Confidential · Anonymised · Fully audited
            </div>
            <h1 className="mt-6 animate-fade-up text-3xl leading-[1.2] sm:text-5xl sm:leading-[1.12] [animation-delay:80ms] lg:text-6xl">
              Examination evaluation,{" "}
              <span className="text-gradient-gold">reimagined</span> for the digital era.
            </h1>
            <p className="mt-6 max-w-xl animate-fade-up text-base sm:text-lg leading-relaxed text-primary-foreground/70 [animation-delay:160ms]">
              From script intake to result declaration — one secure platform for distribution,
              on-screen marking, moderation and tabulation. Faster results, zero paper, complete accountability.
            </p>
            <div className="mt-7 grid animate-fade-up gap-3 sm:mt-9 sm:flex sm:flex-wrap sm:items-center sm:gap-4 [animation-delay:240ms]">
              <Button asChild size="lg" variant="gold">
                <Link to="/auth">
                  Enter the portal
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/25 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                <a href="#process">See how it works</a>
              </Button>
            </div>
          </div>
          <div className="relative animate-fade-up [animation-delay:200ms]">
            <div className="absolute -inset-6 rounded-3xl bg-gold/15 blur-3xl" />
            <div className="animate-float relative overflow-hidden rounded-2xl border border-primary-foreground/15 shadow-lift">
              <img
                src={heroVisual}
                alt="Secure digital evaluation platform visual"
                width={1600}
                height={912}
                className="h-auto w-full"
              />
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-primary-foreground/10" />
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative border-t border-primary-foreground/10">
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-primary-foreground/10 md:grid-cols-4">
            {STATS.map(([v, l]) => (
              <div key={l} className="px-3 py-5 text-center sm:px-6 sm:py-7">
                <p className="font-serif text-xl text-gold sm:text-2xl">{v}</p>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-primary-foreground/55 sm:text-xs">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── Features ────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow text-gold">Capabilities</p>
          <h2 className="mt-3 text-2xl leading-tight sm:text-4xl">Everything the examination cell needs, in one place</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Built for controllers, evaluators, moderators and students — each with exactly the access they need.
          </p>
        </div>
        <div className="mt-8 grid sm:mt-14 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card-hover group rounded-xl border bg-card p-7 shadow-card">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/5 ring-1 ring-primary/10 transition-colors group-hover:bg-gold/10 group-hover:ring-gold/30">
                <Icon className="h-5 w-5 text-primary transition-colors group-hover:text-gold" />
              </div>
              <p className="mt-5 font-serif text-lg">{title}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Process ─────────────────────────── */}
      <section id="process" className="border-y border-border bg-secondary/40 py-12 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow text-gold">The process</p>
              <h2 className="mt-3 text-2xl sm:text-4xl">Five stages, fully digital</h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              A script moves through a controlled pipeline. Its status is visible to the Controller at every step.
            </p>
          </div>
          <ol className="mt-8 grid sm:mt-14 gap-5 md:grid-cols-5">
            {STEPS.map(([n, t, d], i) => (
              <li key={n} className="card-hover relative rounded-xl border bg-card p-6 shadow-card">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-serif text-sm text-primary-foreground">
                    {n}
                  </span>
                  {i < STEPS.length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 max-md:hidden" />
                  )}
                </div>
                <p className="mt-4 font-semibold">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Trust / security ────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-24">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="eyebrow text-gold">Confidentiality by design</p>
            <h2 className="mt-3 text-2xl leading-tight sm:text-4xl">Security isn't a feature. It's the foundation.</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Examination work demands absolute trust. The system enforces it structurally — not by policy, but by design.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link to="/auth">
                Access the portal
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <ul className="space-y-4">
            {TRUST.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-4 rounded-xl border bg-card p-5 shadow-card">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gold/10 ring-1 ring-gold/25">
                  <Icon className="h-5 w-5 text-gold" />
                </div>
                <p className="pt-1.5 text-sm leading-relaxed text-foreground/85">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── CTA banner ──────────────────────── */}
      <section className="relative overflow-hidden bg-seal py-12 sm:py-20 text-center text-primary-foreground">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(oklch(0.76 0.12 82 / 0.12) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-6">
          <CheckCircle2 className="mx-auto h-10 w-10 text-gold" />
          <h2 className="mt-6 text-2xl leading-tight sm:text-4xl">Ready to declare results on time, every time?</h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/70">
            Sign in with your institutional account. Staff roles are assigned by the Controller of Examinations.
          </p>
          <Button asChild size="lg" variant="gold" className="mt-8">
            <Link to="/auth">
              Enter the portal
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────── */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/5 ring-1 ring-primary/15">
              <Landmark className="h-4 w-4 text-primary" />
            </div>
            <p className="font-serif text-sm">Digital Evaluation System</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Confidential examination system · All access is logged and audited
          </p>
        </div>
      </footer>
    </div>
  );
}
