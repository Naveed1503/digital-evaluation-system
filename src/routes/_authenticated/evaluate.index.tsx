import { createFileRoute } from "@tanstack/react-router";
import { ScriptQueue } from "@/components/ScriptQueue";

export const Route = createFileRoute("/_authenticated/evaluate/")({
  head: () => ({ meta: [
    { title: 'My valuation — Digital Evaluation System' },
    { name: "description", content: 'Access your assigned answer scripts for secure online valuation.' },
    { property: "og:title", content: 'My valuation — Digital Evaluation System' },
    { property: "og:description", content: 'Access your assigned answer scripts for secure online valuation.' },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <ScriptQueue mode="evaluate" />,
});
