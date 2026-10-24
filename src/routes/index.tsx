import { createFileRoute, Link } from "@tanstack/react-router";
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
  ["I", "Script intake", "Scanned answer scripts are uploaded and given anonymous codes."],
  ["II", "Allocation", "Scripts are distributed to evaluators and moderators automatically."],
  ["III", "Online valuation", "Question-wise marking with validated limits and auto-totals."],
  ["IV", "Moderation", "A second examiner reviews and confirms or adjusts marks."],
  ["V", "Declaration", "Results are tabulated, graded and published to students."],
];

function Index() {
  return (
    <div className="min-h-screen">
      <header className="bg-seal text-primary-foreground">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
          <p className="font-serif text-lg">Digital Evaluation System</p>
          <Button asChild variant="secondary" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
        <div className="mx-auto max-w-6xl px-8 pb-24 pt-16">
          <p className="eyebrow text-gold">Office of the Controller of Examinations</p>
          <h1 className="mt-4 max-w-3xl text-5xl leading-tight">
            Every answer script, evaluated with care, accuracy and confidentiality.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-primary-foreground/80">
            One secure place for script distribution, on-screen marking, moderation and result declaration.
          </p>
          <div className="mt-10">
            <Button asChild size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Link to="/auth">Enter the portal</Link>
            </Button>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-8 py-20">
        <p className="eyebrow text-gold">The process</p>
        <h2 className="mt-2 text-3xl">Five stages, fully digital</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-5">
          {STEPS.map(([n, t, d]) => (
            <li key={n} className="border-t-2 border-primary pt-4">
              <span className="font-serif text-2xl text-gold">{n}</span>
              <p className="mt-2 font-semibold">{t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </li>
          ))}
        </ol>
      </section>
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Confidential examination system · Access is logged
      </footer>
    </div>
  );
}
