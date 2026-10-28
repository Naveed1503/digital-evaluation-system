import { createFileRoute } from "@tanstack/react-router";
import { ScriptQueue } from "@/components/ScriptQueue";

export const Route = createFileRoute("/_authenticated/moderate/")({
  head: () => ({ meta: [
    { title: 'Moderation — Digital Evaluation System' },
    { name: "description", content: 'Access your assigned scripts for moderation review.' },
    { property: "og:title", content: 'Moderation — Digital Evaluation System' },
    { property: "og:description", content: 'Access your assigned scripts for moderation review.' },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <ScriptQueue mode="moderate" />,
});
