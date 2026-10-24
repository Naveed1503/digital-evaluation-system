import { createFileRoute } from "@tanstack/react-router";
import { ScriptQueue } from "@/components/ScriptQueue";

export const Route = createFileRoute("/_authenticated/evaluate/")({
  head: () => ({ meta: [{ title: "My valuation — DES" }] }),
  component: () => <ScriptQueue mode="evaluate" />,
});
