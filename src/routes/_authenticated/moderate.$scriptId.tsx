import { createFileRoute } from "@tanstack/react-router";
import { MarkingWorkspace } from "@/components/MarkingWorkspace";

export const Route = createFileRoute("/_authenticated/moderate/$scriptId")({
  head: () => ({ meta: [{ title: "Moderate script — DES" }] }),
  component: () => <MarkingWorkspace scriptId={Route.useParams().scriptId} mode="moderate" />,
});
