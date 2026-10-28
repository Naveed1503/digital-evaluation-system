import { createFileRoute } from "@tanstack/react-router";
import { MarkingWorkspace } from "@/components/MarkingWorkspace";

export const Route = createFileRoute("/_authenticated/moderate/$scriptId")({
  head: () => ({ meta: [
    { title: 'Moderate script — Digital Evaluation System' },
    { name: "description", content: 'Review evaluated marks and record moderation decisions.' },
    { property: "og:title", content: 'Moderate script — Digital Evaluation System' },
    { property: "og:description", content: 'Review evaluated marks and record moderation decisions.' },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <MarkingWorkspace scriptId={Route.useParams().scriptId} mode="moderate" />,
});
