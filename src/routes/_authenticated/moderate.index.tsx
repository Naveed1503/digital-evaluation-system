import { createFileRoute } from "@tanstack/react-router";
import { ScriptQueue } from "@/components/ScriptQueue";

export const Route = createFileRoute("/_authenticated/moderate/")({
  head: () => ({ meta: [{ title: "Moderation — DES" }] }),
  component: () => <ScriptQueue mode="moderate" />,
});
