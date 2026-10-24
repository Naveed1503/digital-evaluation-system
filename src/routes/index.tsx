import { createFileRoute, Link } from "@tanstack/react-router";
import { Landmark, ArrowRight, ShieldCheck, FileStack, PenLine, Stamp, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const STEPS = [
  { n: "I", t: "Script intake", d: "Scanned answer scripts are uploaded and given anonymous codes.", icon: FileStack },
  { n: "II", t: "Allocation", d: "Scripts are distributed to evaluators and moderators automatically.", icon: ShieldCheck },
  { n: "III", t: "Online valuation", d: "Question-wise marking with validated limits and auto-totals.", icon: PenLine },
  { n: "IV", t: "Moderation", d: "A second examiner reviews and confirms or adjusts marks.", icon: Stamp },
  { n: "V", t: "Declaration", d: "Results are tabulated, graded and published to students.", icon: GraduationCap },
];

function Index() {
  return (
    <div className="min-h-screen">
      <header className="relative overflow-hidden bg-seal text-primary-foreground">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(oklch(0.76 0.12 82 / 0.14) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <div className="relative mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gold/15 ring-1 ring-gold/40">
              <Landmark className="h-4.5 w-4.5 text-gold" />
            </div>
            <p className="font-serif text-lg">Digital Evaluation System</p>
          </div>
          <Button asChild variant="outline" size="sm" className="border-primary-foreground/25 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
        <div className="relative mx-auto max-w-6xl px-8 pb-28 pt-20">
          <p className="eyebrow animate-fade-up text-gold">Office of the Controller of Examinations</p>
          <h1 className="mt-5 max-w-3xl animate-fade-up text-5xl leading-[1.15] [animation-delay:80ms]">
            Every answer script, evaluated with care, accuracy and confidentiality.
          </h1>
          <p className="mt-6 max-w-2xl animate-fade-up text-lg leading-relaxed text-primary-foreground/75 [animation-delay:160ms]">
            One secure place for script distribution, on-screen marking, moderation and result declaration.
          </p>
          <div className="mt-10 flex animate-fade-up items-center gap-4 [animation-delay:240ms]">
            <Button asChild size="lg" variant="gold">
              <Link to="/auth">
                Enter the portal
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <p className="text-xs text-primary-foreground/50">Access is restricted and every action is logged.</p>
          </div>
        </div>
        <div className="gold-line relative" />
      </header>

      <section className="mx-auto max-w-6xl px-8 py-20">
        <p className="eyebrow text-gold">The process</p>
        <h2 className="mt-2 text-3xl">Five stages, fully digital</h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-5">
          {STEPS.map(({ n, t, d, icon: Icon }) => (
            <li
              key={n}
              className="card-hover group rounded-lg border bg-card p-5 shadow-card"
            >
              <div className="flex items-center justify-between">
                <span className="font-serif text-2xl text-gold">{n}</span>
                <Icon className="h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-gold" />
              </div>
              <p className="mt-4 font-semibold">{t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 text-xs text-muted-foreground">
          <p>Confidential examination system · Access is logged</p>
          <p className="font-serif">Digital Evaluation System</p>
        </div>
      </footer>
    </div>
  );
}
