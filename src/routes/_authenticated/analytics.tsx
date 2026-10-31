import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { Activity, AlertTriangle, CheckCircle2, Clock, Database, Layers, Play, Upload, Radio } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MAX_DATASET_ROWS, profileColumns, type ColumnProfile, type Row } from "@/lib/dataset-profile";
import { createLiveDataset, runAnomalyDetection } from "@/lib/analytics.functions";
import { C, downloadCsv, downloadPdf, Empty, fmt, Kpi, Panel, ReviewBadge, SourceBadge } from "@/components/analytics/shared";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [
    { title: "Intelligent Evaluation Analytics — Digital Evaluation System" },
    { name: "description", content: "Isolation Forest anomaly detection on evaluation datasets with moderator review and reports." },
    { property: "og:title", content: "Intelligent Evaluation Analytics — Digital Evaluation System" },
    { property: "og:description", content: "Isolation Forest anomaly detection on evaluation datasets with moderator review and reports." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AnalyticsPage,
});

type Dataset = { id: string; name: string; source: string; file_name: string | null; row_count: number; column_count: number; profile: ColumnProfile[]; created_at: string };
type Run = { id: string; dataset_id: string; n_estimators: number; contamination: number; features: string[]; label_column: string | null; record_count: number; anomaly_count: number; metrics: Record<string, unknown>; created_at: string };
type Result = { id: string; run_id: string; row_index: number; record: Row; score: number; is_anomaly: boolean; exam: string | null; subject: string | null; evaluator: string | null; record_date: string | null; review_status: string; review_comment: string | null; script_id: string | null };

function useAnalytics() {
  return useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const [ds, runs, pending] = await Promise.all([
        supabase.from("ml_datasets").select("id, name, source, file_name, row_count, column_count, profile, created_at").order("created_at", { ascending: false }),
        supabase.from("ml_runs").select("*").order("created_at", { ascending: false }),
        supabase.from("ml_results").select("id", { count: "exact", head: true }).eq("is_anomaly", true).eq("review_status", "pending"),
      ]);
      return { datasets: (ds.data ?? []) as unknown as Dataset[], runs: (runs.data ?? []) as unknown as Run[], pending: pending.count ?? 0 };
    },
  });
}

function AnalyticsPage() {
  const { data } = useAnalytics();
  const [tab, setTab] = useState("overview");
  const [runId, setRunId] = useState<string | null>(null);
  const activeRun = data?.runs.find((r) => r.id === runId) ?? data?.runs[0];
  return (
    <div>
      <PageHeader eyebrow="Machine learning · Isolation Forest" title="Intelligent Evaluation Analytics">
        <Link to="/moderate/flags" className="text-sm text-primary hover:underline">Moderator review queue →</Link>
      </PageHeader>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 grid h-auto w-full grid-cols-3 gap-1 sm:flex sm:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="datasets">Datasets</TabsTrigger>
          <TabsTrigger value="model">Model</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        {!data ? <p className="text-muted-foreground">Loading…</p> : (
          <>
            <TabsContent value="overview"><Overview data={data} /></TabsContent>
            <TabsContent value="datasets"><Datasets datasets={data.datasets} /></TabsContent>
            <TabsContent value="model"><ModelConfig datasets={data.datasets} onDone={(id) => { setRunId(id); setTab("results"); }} /></TabsContent>
            <TabsContent value="results"><RunPicker runs={data.runs} datasets={data.datasets} value={activeRun?.id} onChange={setRunId} />{activeRun ? <Results run={activeRun} /> : <Empty>No model runs yet. Configure and run the model first.</Empty>}</TabsContent>
            <TabsContent value="performance"><RunPicker runs={data.runs} datasets={data.datasets} value={activeRun?.id} onChange={setRunId} />{activeRun ? <Performance run={activeRun} /> : <Empty>No model runs yet.</Empty>}</TabsContent>
            <TabsContent value="reports"><Reports data={data} /></TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

function RunPicker({ runs, datasets, value, onChange }: { runs: Run[]; datasets: Dataset[]; value: string | undefined; onChange: (id: string) => void }) {
  if (!runs.length) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <Label htmlFor="run">Model run</Label>
      <select id="run" className="h-10 max-w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        {runs.map((r) => <option key={r.id} value={r.id}>{new Date(r.created_at).toLocaleString()} · {datasets.find((d) => d.id === r.dataset_id)?.name ?? "Dataset"} · {r.anomaly_count}/{r.record_count} flagged</option>)}
      </select>
    </div>
  );
}

/* ---------------- Overview ---------------- */
function Overview({ data }: { data: { datasets: Dataset[]; runs: Run[]; pending: number } }) {
  const records = data.runs.reduce((s, r) => s + r.record_count, 0);
  const anomalies = data.runs.reduce((s, r) => s + r.anomaly_count, 0);
  const trend = [...data.runs].reverse().map((r) => ({ when: new Date(r.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }), anomalies: r.anomaly_count, rate: Math.round((r.anomaly_count / Math.max(1, r.record_count)) * 1000) / 10 }));
  const activity = [
    ...data.datasets.map((d) => ({ at: d.created_at, text: `Dataset added: ${d.name}`, kind: d.source })),
    ...data.runs.map((r) => ({ at: r.created_at, text: `Isolation Forest run: ${r.anomaly_count} of ${r.record_count} records flagged`, kind: "run" })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Datasets analysed" value={new Set(data.runs.map((r) => r.dataset_id)).size} hint={`${data.datasets.length} stored`} icon={Database} />
        <Kpi label="Records processed" value={records.toLocaleString()} icon={Layers} />
        <Kpi label="Anomalies detected" value={anomalies.toLocaleString()} icon={AlertTriangle} tone="danger" />
        <Kpi label="Normal records" value={(records - anomalies).toLocaleString()} icon={CheckCircle2} />
        <Kpi label="Model executions" value={data.runs.length} icon={Activity} tone="gold" />
        <Kpi label="Pending reviews" value={data.pending} hint="Flagged, awaiting moderator" icon={Clock} tone="gold" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel eyebrow="Trend" title="Anomalies per model run">
          {trend.length ? (
            <div className="h-64"><ResponsiveContainer>
              <AreaChart data={trend}><CartesianGrid strokeDasharray="3 3" opacity={0.3} /><XAxis dataKey="when" fontSize={11} /><YAxis fontSize={11} allowDecimals={false} /><Tooltip />
                <Area type="monotone" dataKey="anomalies" stroke={C.danger} fill={C.danger} fillOpacity={0.15} strokeWidth={2} name="Anomalies" />
              </AreaChart>
            </ResponsiveContainer></div>
          ) : <Empty>Run the model to see trends.</Empty>}
        </Panel>
        <Panel eyebrow="Log" title="Recent activity">
          {activity.length ? (
            <ul className="space-y-3 text-sm">{activity.map((a, i) => (
              <li key={i} className="flex gap-3"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${a.kind === "run" ? "bg-gold" : "bg-primary"}`} />
                <div className="min-w-0"><p className="break-words">{a.text}</p><p className="text-xs text-muted-foreground">{new Date(a.at).toLocaleString()}</p></div></li>
            ))}</ul>
          ) : <Empty>No activity yet.</Empty>}
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- Datasets ---------------- */
async function parseFile(file: File): Promise<Row[]> {
  if (/\.csv$/i.test(file.name)) {
    const text = await file.text();
    return Papa.parse<Row>(text, { header: true, skipEmptyLines: true, dynamicTyping: true }).data;
  }
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: null, raw: true }).map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString().slice(0, 10) : v])));
}

function Datasets({ datasets }: { datasets: Dataset[] }) {
  const qc = useQueryClient();
  const liveFn = useServerFn(createLiveDataset);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(datasets[0]?.id ?? null);

  async function upload(file: File) {
    if (!/\.(csv|xlsx|xls)$/i.test(file.name)) { toast.error("Upload a CSV or Excel file"); return; }
    if (file.size > 15 * 1024 * 1024) { toast.error("File must be under 15 MB"); return; }
    setBusy(true);
    try {
      const rows = await parseFile(file);
      if (rows.length < 10) throw new Error("The file needs at least 10 data rows");
      if (rows.length > MAX_DATASET_ROWS) throw new Error(`Maximum ${MAX_DATASET_ROWS.toLocaleString()} rows per dataset`);
      const profile = profileColumns(rows);
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("ml_datasets").insert({
        name: file.name.replace(/\.[^.]+$/, ""), source: "upload", file_name: file.name, row_count: rows.length, column_count: profile.length,
        profile: profile as unknown as Json, rows: rows as unknown as Json, created_by: u.user?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      toast.success(`Uploaded ${rows.length.toLocaleString()} rows`);
      setPreview(data.id);
      qc.invalidateQueries({ queryKey: ["analytics"] });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  async function live() {
    setBusy(true);
    try {
      const r = await liveFn();
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(`Captured ${r.rows} live evaluation records`); setPreview(r.id);
      qc.invalidateQueries({ queryKey: ["analytics"] });
    } finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this dataset and its model runs?")) return;
    const { error } = await supabase.from("ml_datasets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["analytics"] });
  }
  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Panel eyebrow="Uploaded file" title="Upload CSV or Excel">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-border p-6 text-center hover:border-gold">
            <Upload className="h-6 w-6 text-gold" />
            <span className="text-sm font-medium">{busy ? "Processing…" : "Choose a .csv, .xlsx or .xls file"}</span>
            <span className="text-xs text-muted-foreground">Up to {MAX_DATASET_ROWS.toLocaleString()} rows · first sheet is used</span>
            <input type="file" accept=".csv,.xlsx,.xls" className="sr-only" disabled={busy} aria-label="Upload dataset" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
          </label>
        </Panel>
        <Panel eyebrow="Live evaluation data" title="Capture from the system">
          <p className="text-sm text-muted-foreground">Takes a snapshot of every evaluated script: marks percentage, moderation change, question-level spread, evaluator, exam and date.</p>
          <Button className="mt-4" onClick={live} disabled={busy}><Radio className="mr-2 h-4 w-4" />Capture live records</Button>
        </Panel>
      </div>
      <Panel title="Stored datasets">
        {datasets.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Name</th><th>Source</th><th>Rows</th><th>Columns</th><th>Added</th><th /></tr></thead>
            <tbody>{datasets.map((d) => (
              <tr key={d.id} className={`border-t border-border ${preview === d.id ? "bg-gold/5" : ""}`}>
                <td className="py-2"><button className="text-left font-medium text-primary hover:underline" onClick={() => setPreview(d.id)}>{d.name}</button></td>
                <td><SourceBadge source={d.source} /></td><td className="font-mono">{d.row_count.toLocaleString()}</td><td className="font-mono">{d.column_count}</td>
                <td className="text-muted-foreground">{new Date(d.created_at).toLocaleString()}</td>
                <td className="text-right"><button className="text-xs text-destructive hover:underline" onClick={() => remove(d.id)}>Delete</button></td>
              </tr>))}</tbody>
          </table></div>
        ) : <Empty>No datasets yet.</Empty>}
      </Panel>
      {preview && <DatasetPreview id={preview} />}
    </div>
  );
}

function DatasetPreview({ id }: { id: string }) {
  const { data } = useQuery({
    queryKey: ["dataset", id],
    queryFn: async () => (await supabase.from("ml_datasets").select("*").eq("id", id).single()).data,
  });
  if (!data) return null;
  const profile = data.profile as unknown as ColumnProfile[];
  const rows = (data.rows as Row[]).slice(0, 20);
  const missing = profile.reduce((s, c) => s + c.missing, 0);
  return (
    <Panel eyebrow="Preview" title={data.name} action={<SourceBadge source={data.source} />}>
      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-sm bg-muted p-3"><p className="font-mono text-xl">{data.row_count.toLocaleString()}</p><p className="text-xs text-muted-foreground">Rows</p></div>
        <div className="rounded-sm bg-muted p-3"><p className="font-mono text-xl">{data.column_count}</p><p className="text-xs text-muted-foreground">Columns</p></div>
        <div className="rounded-sm bg-muted p-3"><p className="font-mono text-xl">{missing}</p><p className="text-xs text-muted-foreground">Missing values</p></div>
      </div>
      <div className="mb-4 overflow-x-auto"><table className="w-full min-w-[480px] text-sm">
        <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Column</th><th>Type</th><th>Missing</th><th>Unique</th></tr></thead>
        <tbody>{profile.map((c) => <tr key={c.name} className="border-t border-border"><td className="py-1.5 font-mono">{c.name}</td><td>{c.type}</td><td className="font-mono">{c.missing}</td><td className="font-mono">{c.unique}</td></tr>)}</tbody>
      </table></div>
      <p className="mb-2 text-xs text-muted-foreground">First {rows.length} rows</p>
      <div className="max-h-80 overflow-auto rounded-sm border border-border"><table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted"><tr>{profile.map((c) => <th key={c.name} className="whitespace-nowrap px-2 py-1.5 text-left">{c.name}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border">{profile.map((c) => <td key={c.name} className="whitespace-nowrap px-2 py-1 font-mono">{r[c.name] == null ? "—" : String(r[c.name])}</td>)}</tr>)}</tbody>
      </table></div>
    </Panel>
  );
}

/* ---------------- Model configuration ---------------- */
function ModelConfig({ datasets, onDone }: { datasets: Dataset[]; onDone: (runId: string) => void }) {
  const qc = useQueryClient();
  const runFn = useServerFn(runAnomalyDetection);
  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? "");
  const ds = datasets.find((d) => d.id === datasetId);
  const numeric = useMemo(() => (ds?.profile ?? []).filter((c) => c.type === "number" && !/(^|_)id$/i.test(c.name)).map((c) => c.name), [ds]);
  const labelCandidates = (ds?.profile ?? []).filter((c) => c.unique === 2).map((c) => c.name);
  const [features, setFeatures] = useState<string[] | null>(null);
  const chosen = features ?? numeric;
  const [trees, setTrees] = useState(100);
  const [cont, setCont] = useState(5);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  if (!datasets.length) return <Empty>Add a dataset first (Datasets tab).</Empty>;
  async function run() {
    if (!chosen.length) { toast.error("Select at least one numerical feature"); return; }
    setBusy(true);
    try {
      const r = await runFn({ data: { datasetId, nEstimators: trees, contamination: cont / 100, features: chosen.filter((f) => f !== label), labelColumn: label || null } });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success(`Isolation Forest flagged ${r.anomalies} of ${r.records} records`);
      await qc.invalidateQueries({ queryKey: ["analytics"] });
      onDone(r.runId);
    } finally { setBusy(false); }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Panel eyebrow="Algorithm · scikit-learn IsolationForest" title="Model configuration">
        <div className="space-y-5">
          <div className="space-y-1">
            <Label htmlFor="ds">Dataset</Label>
            <select id="ds" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={datasetId} onChange={(e) => { setDatasetId(e.target.value); setFeatures(null); setLabel(""); }}>
              {datasets.map((d) => <option key={d.id} value={d.id}>{d.source === "live" ? "[Live] " : "[Upload] "}{d.name} ({d.row_count} rows)</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><Label>Number of estimators (trees)</Label><span className="font-mono text-sm">{trees}</span></div>
            <Slider min={10} max={500} step={10} value={[trees]} onValueChange={(v) => setTrees(v[0] ?? 100)} aria-label="Number of estimators" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><Label>Contamination (expected anomaly %)</Label><span className="font-mono text-sm">{cont}%</span></div>
            <Slider min={1} max={30} step={1} value={[cont]} onValueChange={(v) => setCont(v[0] ?? 5)} aria-label="Contamination percentage" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="lbl">Validation label column (optional)</Label>
            <select id="lbl" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={label} onChange={(e) => setLabel(e.target.value)}>
              <option value="">None — unsupervised only</option>
              {labelCandidates.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">If your file marks known anomalies (0/1, yes/no), precision, recall and F1 are calculated.</p>
          </div>
          <Button onClick={run} disabled={busy} className="w-full"><Play className="mr-2 h-4 w-4" />{busy ? "Running Isolation Forest…" : "Run anomaly detection"}</Button>
        </div>
      </Panel>
      <Panel title="Numerical features" action={<span className="text-xs text-muted-foreground">{chosen.length} selected</span>}>
        {numeric.length ? (
          <div className="grid gap-2 sm:grid-cols-2">{numeric.map((f) => (
            <label key={f} className="flex items-center gap-2 rounded-sm border border-border p-2 text-sm">
              <Checkbox checked={chosen.includes(f)} disabled={f === label} onCheckedChange={(v) => setFeatures(v ? [...chosen, f] : chosen.filter((x) => x !== f))} />
              <span className="font-mono text-xs">{f}</span>
            </label>))}</div>
        ) : <Empty>This dataset has no numeric columns.</Empty>}
      </Panel>
    </div>
  );
}

/* ---------------- Results ---------------- */
function useRunResults(runId: string) {
  return useQuery({
    queryKey: ["run-results", runId],
    queryFn: async () => {
      const out: Result[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from("ml_results").select("*").eq("run_id", runId).order("score", { ascending: false }).range(from, from + 999);
        out.push(...((data ?? []) as unknown as Result[]));
        if (!data || data.length < 1000) break;
      }
      return out;
    },
  });
}

function Results({ run }: { run: Run }) {
  const { data: results = [] } = useRunResults(run.id);
  const [f, setF] = useState({ exam: "", subject: "", evaluator: "", from: "", to: "", show: "all" });
  const opts = (k: "exam" | "subject" | "evaluator") => Array.from(new Set(results.map((r) => r[k]).filter(Boolean))) as string[];
  const rows = results.filter((r) =>
    (!f.exam || r.exam === f.exam) && (!f.subject || r.subject === f.subject) && (!f.evaluator || r.evaluator === f.evaluator) &&
    (!f.from || (r.record_date ?? "") >= f.from) && (!f.to || (r.record_date ?? "9999") <= f.to) &&
    (f.show === "all" || (f.show === "anomaly" ? r.is_anomaly : !r.is_anomaly)));
  const group = (k: "evaluator" | "subject") => {
    const m = new Map<string, { name: string; total: number; anomalies: number; scoreSum: number }>();
    for (const r of rows) { const n = r[k] ?? "Unknown"; const g = m.get(n) ?? { name: n, total: 0, anomalies: 0, scoreSum: 0 }; g.total++; g.scoreSum += Number(r.score); if (r.is_anomaly) g.anomalies++; m.set(n, g); }
    return [...m.values()].map((g) => ({ ...g, rate: Math.round((g.anomalies / g.total) * 1000) / 10, meanScore: Math.round((g.scoreSum / g.total) * 1000) / 1000 })).sort((a, b) => b.rate - a.rate);
  };
  const byEval = group("evaluator"); const bySubj = group("subject");
  const firstFeat = run.features[0]!;
  const scatter = rows.map((r) => ({ x: Number(r.record[firstFeat] ?? 0), y: Number(r.score), a: r.is_anomaly }));
  const bins = useMemo(() => {
    if (!rows.length) return [];
    const s = rows.map((r) => Number(r.score)); const lo = Math.min(...s), hi = Math.max(...s); const w = (hi - lo) / 12 || 1;
    return Array.from({ length: 12 }, (_, i) => ({ bin: (lo + i * w).toFixed(2), normal: 0, anomaly: 0 })).map((b, i) => {
      for (const r of rows) { const k = Math.min(11, Math.floor((Number(r.score) - lo) / w)); if (k === i) r.is_anomaly ? b.anomaly++ : b.normal++; }
      return b;
    });
  }, [rows]);
  const anomalies = rows.filter((r) => r.is_anomaly).length;
  const sel = "h-10 rounded-md border border-input bg-background px-2 text-sm";
  return (
    <div className="grid gap-6">
      <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-card p-3 shadow-card sm:flex sm:flex-wrap sm:items-end">
        <select className={sel} aria-label="Filter by exam" value={f.exam} onChange={(e) => setF({ ...f, exam: e.target.value })}><option value="">All exams</option>{opts("exam").map((o) => <option key={o}>{o}</option>)}</select>
        <select className={sel} aria-label="Filter by subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })}><option value="">All subjects</option>{opts("subject").map((o) => <option key={o}>{o}</option>)}</select>
        <select className={sel} aria-label="Filter by evaluator" value={f.evaluator} onChange={(e) => setF({ ...f, evaluator: e.target.value })}><option value="">All evaluators</option>{opts("evaluator").map((o) => <option key={o}>{o}</option>)}</select>
        <Input type="date" className="h-10 sm:w-40" aria-label="From date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        <Input type="date" className="h-10 sm:w-40" aria-label="To date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        <select className={sel} aria-label="Show records" value={f.show} onChange={(e) => setF({ ...f, show: e.target.value })}><option value="all">All records</option><option value="anomaly">Anomalies only</option><option value="normal">Normal only</option></select>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Records" value={rows.length} icon={Layers} />
        <Kpi label="Anomalous" value={anomalies} icon={AlertTriangle} tone="danger" />
        <Kpi label="Normal" value={rows.length - anomalies} icon={CheckCircle2} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Normal vs anomalous">
          <div className="h-56"><ResponsiveContainer><PieChart>
            <Pie data={[{ name: "Normal", v: rows.length - anomalies }, { name: "Anomalous", v: anomalies }]} dataKey="v" nameKey="name" innerRadius={50} outerRadius={80}>
              <Cell fill={C.primary} /><Cell fill={C.danger} />
            </Pie><Tooltip /></PieChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="Anomaly score distribution">
          <div className="h-56"><ResponsiveContainer><BarChart data={bins}><XAxis dataKey="bin" fontSize={10} /><YAxis fontSize={10} allowDecimals={false} /><Tooltip />
            <Bar dataKey="normal" stackId="a" fill={C.primary} name="Normal" /><Bar dataKey="anomaly" stackId="a" fill={C.danger} name="Anomalous" /></BarChart></ResponsiveContainer></div>
        </Panel>
        <Panel title={`Score vs ${firstFeat}`}>
          <div className="h-56"><ResponsiveContainer><ScatterChart><CartesianGrid opacity={0.3} /><XAxis dataKey="x" type="number" fontSize={10} name={firstFeat} /><YAxis dataKey="y" type="number" fontSize={10} name="score" domain={["auto", "auto"]} /><ZAxis range={[25, 25]} /><Tooltip />
            <Scatter data={scatter.filter((p) => !p.a)} fill={C.primary} name="Normal" /><Scatter data={scatter.filter((p) => p.a)} fill={C.danger} name="Anomalous" /></ScatterChart></ResponsiveContainer></div>
        </Panel>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <GroupTable title="Evaluator-wise analysis" rows={byEval} />
        <GroupTable title="Subject-wise marking variation" rows={bySubj} />
      </div>
      <Panel title="Records with anomaly scores" action={<span className="text-xs text-muted-foreground">Sorted by score · higher = more unusual</span>}>
        <div className="max-h-[480px] overflow-auto rounded-sm border border-border"><table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-0 bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">#</th><th>Exam</th><th>Subject</th><th>Evaluator</th><th>Date</th>{run.features.slice(0, 3).map((x) => <th key={x}>{x}</th>)}<th>Score</th><th>Result</th><th>Review</th></tr></thead>
          <tbody>{rows.slice(0, 500).map((r) => (
            <tr key={r.id} className={`border-t border-border ${r.is_anomaly ? "bg-destructive/5" : ""}`}>
              <td className="px-3 py-1.5 font-mono text-xs">{r.row_index + 1}</td><td>{r.exam ?? "—"}</td><td>{r.subject ?? "—"}</td><td>{r.evaluator ?? "—"}</td><td className="text-xs">{r.record_date ?? "—"}</td>
              {run.features.slice(0, 3).map((x) => <td key={x} className="font-mono text-xs">{String(r.record[x] ?? "—")}</td>)}
              <td className="font-mono">{Number(r.score).toFixed(3)}</td>
              <td>{r.is_anomaly ? <span className="text-xs font-semibold text-destructive">Anomaly</span> : <span className="text-xs text-muted-foreground">Normal</span>}</td>
              <td>{r.is_anomaly ? <ReviewBadge status={r.review_status} /> : null}</td>
            </tr>))}</tbody>
        </table></div>
        {rows.length > 500 && <p className="mt-2 text-xs text-muted-foreground">Showing top 500 of {rows.length}. Export for all records.</p>}
      </Panel>
    </div>
  );
}

function GroupTable({ title, rows }: { title: string; rows: { name: string; total: number; anomalies: number; rate: number; meanScore: number }[] }) {
  return (
    <Panel title={title}>
      {rows.length && !(rows.length === 1 && rows[0]!.name === "Unknown") ? (
        <>
          <div className="mb-3 h-48"><ResponsiveContainer><BarChart data={rows.slice(0, 10)} layout="vertical" margin={{ left: 20 }}><XAxis type="number" fontSize={10} unit="%" /><YAxis type="category" dataKey="name" fontSize={10} width={110} /><Tooltip />
            <Bar dataKey="rate" name="Anomaly rate %" fill={C.gold} /></BarChart></ResponsiveContainer></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-1.5">Name</th><th>Records</th><th>Flagged</th><th>Rate</th><th>Mean score</th></tr></thead>
            <tbody>{rows.map((g) => <tr key={g.name} className="border-t border-border"><td className="py-1.5">{g.name}</td><td className="font-mono">{g.total}</td><td className="font-mono">{g.anomalies}</td><td className="font-mono">{g.rate}%</td><td className="font-mono">{g.meanScore}</td></tr>)}</tbody></table></div>
        </>
      ) : <Empty>This dataset has no column for this grouping.</Empty>}
    </Panel>
  );
}

/* ---------------- Performance ---------------- */
function Performance({ run }: { run: Run }) {
  const m = run.metrics as {
    mode?: string; confusion_matrix?: { tn: number; fp: number; fn: number; tp: number }; feature_importance?: Record<string, number>; label_warning?: string;
    runtime_ms?: number; precision?: number; recall?: number; f1?: number; labelled_records?: number; anomaly_rate?: number; silhouette?: number;
    threshold?: number; score_mean_anomalous?: number; score_mean_normal?: number;
  };
  const fi = Object.entries(m.feature_importance ?? {}).map(([name, v]) => ({ name, v: Math.round(v * 1000) / 1000 }));
  return (
    <div className="grid gap-6">
      <div className="rounded-md border border-border bg-card p-4 text-sm shadow-card">
        <span className="font-semibold">{m.mode === "supervised_validation" ? "Validated against labelled data" : "Unsupervised analysis (no validation labels)"}</span>
        <span className="text-muted-foreground"> · {run.n_estimators} trees · contamination {(Number(run.contamination) * 100).toFixed(0)}% · features: {run.features.join(", ")} · runtime {m.runtime_ms} ms</span>
        {m.label_warning && <p className="mt-1 text-xs text-destructive">{m.label_warning}</p>}
      </div>
      {m.mode === "supervised_validation" && m.confusion_matrix ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="Precision" value={fmt(m.precision)} icon={CheckCircle2} />
            <Kpi label="Recall" value={fmt(m.recall)} icon={Activity} />
            <Kpi label="F1-score" value={fmt(m.f1)} icon={Layers} tone="gold" />
          </div>
          <Panel title="Confusion matrix" action={<span className="text-xs text-muted-foreground">{m.labelled_records} labelled records</span>}>
            <div className="grid grid-cols-[auto_1fr_1fr] gap-1 text-center text-sm">
              <div /><div className="text-xs text-muted-foreground">Predicted normal</div><div className="text-xs text-muted-foreground">Predicted anomaly</div>
              <div className="self-center pr-2 text-right text-xs text-muted-foreground">Actual normal</div>
              <div className="rounded-sm bg-primary/10 p-4 font-mono text-xl">{m.confusion_matrix.tn}<p className="text-[10px] font-sans text-muted-foreground">True negative</p></div>
              <div className="rounded-sm bg-gold/15 p-4 font-mono text-xl">{m.confusion_matrix.fp}<p className="text-[10px] font-sans text-muted-foreground">False positive</p></div>
              <div className="self-center pr-2 text-right text-xs text-muted-foreground">Actual anomaly</div>
              <div className="rounded-sm bg-gold/15 p-4 font-mono text-xl">{m.confusion_matrix.fn}<p className="text-[10px] font-sans text-muted-foreground">False negative</p></div>
              <div className="rounded-sm bg-destructive/10 p-4 font-mono text-xl">{m.confusion_matrix.tp}<p className="text-[10px] font-sans text-muted-foreground">True positive</p></div>
            </div>
          </Panel>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Anomaly rate" value={`${(Number(m.anomaly_rate) * 100).toFixed(1)}%`} icon={AlertTriangle} tone="danger" />
        <Kpi label="Silhouette" value={fmt(m.silhouette)} hint="Separation of flagged vs normal (−1 to 1)" icon={Layers} />
        <Kpi label="Decision threshold" value={fmt(m.threshold)} icon={Activity} />
        <Kpi label="Score gap" value={fmt(Number(m.score_mean_anomalous) - Number(m.score_mean_normal))} hint="Mean score: anomalous − normal" icon={CheckCircle2} tone="gold" />
      </div>
      <Panel title="Feature contribution" action={<span className="text-xs text-muted-foreground">Standardised mean difference, anomalous vs normal</span>}>
        {fi.length ? <div className="h-64"><ResponsiveContainer><BarChart data={fi} layout="vertical" margin={{ left: 30 }}><XAxis type="number" fontSize={10} /><YAxis type="category" dataKey="name" width={140} fontSize={10} /><Tooltip /><Bar dataKey="v" fill={C.primary} name="Contribution" /></BarChart></ResponsiveContainer></div> : <Empty>Not available.</Empty>}
      </Panel>
    </div>
  );
}

/* ---------------- Reports ---------------- */
function Reports({ data }: { data: { datasets: Dataset[]; runs: Run[] } }) {
  const dsName = (id: string) => data.datasets.find((d) => d.id === id)?.name ?? "Deleted dataset";
  async function exportRun(run: Run, kind: "csv" | "pdf") {
    const { data: res } = await supabase.from("ml_results").select("*").eq("run_id", run.id).eq("is_anomaly", true).order("score", { ascending: false });
    const rows = ((res ?? []) as unknown as Result[]);
    const stamp = run.created_at.slice(0, 10);
    if (kind === "csv") {
      downloadCsv(`anomaly-report-${stamp}.csv`, rows.map((r) => ({ row: r.row_index + 1, exam: r.exam, subject: r.subject, evaluator: r.evaluator, date: r.record_date, score: Number(r.score).toFixed(4), review_status: r.review_status, review_comment: r.review_comment, ...r.record })));
    } else {
      const m = run.metrics as Record<string, number>;
      downloadPdf(`anomaly-report-${stamp}.pdf`, "Intelligent Evaluation Analytics — Anomaly Report",
        [`Dataset: ${dsName(run.dataset_id)} · Run: ${new Date(run.created_at).toLocaleString()}`,
         `Isolation Forest · ${run.n_estimators} trees · contamination ${(Number(run.contamination) * 100).toFixed(0)}% · features: ${run.features.join(", ")}`,
         `Flagged ${run.anomaly_count} of ${run.record_count} records${m["precision"] != null ? ` · precision ${fmt(m["precision"])} · recall ${fmt(m["recall"])} · F1 ${fmt(m["f1"])}` : ""}`],
        ["Row", "Exam", "Subject", "Evaluator", "Date", "Score", "Review", "Comment"],
        rows.map((r) => [r.row_index + 1, r.exam ?? "", r.subject ?? "", r.evaluator ?? "", r.record_date ?? "", Number(r.score).toFixed(3), r.review_status, r.review_comment ?? ""]));
    }
  }
  return (
    <div className="grid gap-6">
      <Panel eyebrow="History" title="Model execution history" action={data.runs.length ? <Button size="sm" variant="outline" onClick={() => downloadCsv("model-runs.csv", data.runs.map((r) => ({ when: r.created_at, dataset: dsName(r.dataset_id), trees: r.n_estimators, contamination: r.contamination, features: r.features.join(" | "), records: r.record_count, anomalies: r.anomaly_count, f1: (r.metrics as Record<string, unknown>)["f1"] ?? "" })))}>Export CSV</Button> : null}>
        {data.runs.length ? (
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">When</th><th>Dataset</th><th>Trees</th><th>Contam.</th><th>Records</th><th>Flagged</th><th>Anomaly report</th></tr></thead>
            <tbody>{data.runs.map((r) => (
              <tr key={r.id} className="border-t border-border"><td className="py-2 text-xs">{new Date(r.created_at).toLocaleString()}</td><td>{dsName(r.dataset_id)}</td><td className="font-mono">{r.n_estimators}</td><td className="font-mono">{(Number(r.contamination) * 100).toFixed(0)}%</td><td className="font-mono">{r.record_count}</td><td className="font-mono">{r.anomaly_count}</td>
                <td className="space-x-2"><button className="text-xs text-primary hover:underline" onClick={() => exportRun(r, "csv")}>CSV</button><button className="text-xs text-primary hover:underline" onClick={() => exportRun(r, "pdf")}>PDF</button></td></tr>))}</tbody>
          </table></div>
        ) : <Empty>No runs yet.</Empty>}
      </Panel>
      <Panel eyebrow="History" title="Dataset history" action={data.datasets.length ? <Button size="sm" variant="outline" onClick={() => downloadCsv("datasets.csv", data.datasets.map((d) => ({ name: d.name, source: d.source, file: d.file_name, rows: d.row_count, columns: d.column_count, added: d.created_at })))}>Export CSV</Button> : null}>
        {data.datasets.length ? (
          <ul className="divide-y divide-border text-sm">{data.datasets.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="font-medium">{d.name}</span><span className="flex items-center gap-3"><SourceBadge source={d.source} /><span className="font-mono text-xs">{d.row_count} rows</span><span className="text-xs text-muted-foreground">{new Date(d.created_at).toLocaleString()}</span></span></li>))}</ul>
        ) : <Empty>No datasets yet.</Empty>}
      </Panel>
    </div>
  );
}
