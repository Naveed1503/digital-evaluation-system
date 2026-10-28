import { createFileRoute } from "@tanstack/react-router";
import { MarkingWorkspace } from "@/components/MarkingWorkspace";

export const Route = createFileRoute("/_authenticated/evaluate/$scriptId")({
  head: () => ({ meta: [
    { title: 'Evaluate script — Digital Evaluation System' },
    { name: "description", content: 'Review an anonymous answer script and enter question-wise marks.' },
    { property: "og:title", content: 'Evaluate script — Digital Evaluation System' },
    { property: "og:description", content: 'Review an anonymous answer script and enter question-wise marks.' },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <MarkingWorkspace scriptId={Route.useParams().scriptId} mode="evaluate" />,
});
