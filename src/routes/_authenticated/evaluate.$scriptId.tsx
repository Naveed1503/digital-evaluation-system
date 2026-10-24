import { createFileRoute } from "@tanstack/react-router";
import { MarkingWorkspace } from "@/components/MarkingWorkspace";

export const Route = createFileRoute("/_authenticated/evaluate/$scriptId")({
  head: () => ({ meta: [{ title: "Evaluate script — DES" }] }),
  component: () => <MarkingWorkspace scriptId={Route.useParams().scriptId} mode="evaluate" />,
});
