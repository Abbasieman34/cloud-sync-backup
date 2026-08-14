import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowUpRight, CheckCircle2, DatabaseBackup, Files, HardDrive, ShieldCheck } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Link } from "wouter";

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export default function Home() {
  const { user } = useAuth();
  const dashboard = trpc.backup.dashboard.useQuery();
  const activity = trpc.backup.activity.useQuery();
  const metrics = dashboard.data;
  const backupHistory = (activity.data ?? []).filter(item => item.action === "backup").reduce<{ date: string; backups: number }[]>((history, item) => {
    const date = new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const last = history[history.length - 1];
    if (last?.date === date) last.backups += 1;
    else history.push({ date, backups: 1 });
    return history;
  }, []).reverse();
  const cards = [
    { label: "Protected storage", value: formatBytes(metrics?.storageBytes ?? 0), note: "Encrypted at rest", icon: HardDrive, tone: "bg-[#e8f2ff] text-[#205a9d]" },
    { label: "Managed files", value: String(metrics?.fileCount ?? 0), note: `${metrics?.versionCount ?? 0} immutable versions`, icon: Files, tone: "bg-[#edf7f1] text-[#23734d]" },
    { label: "Sync health", value: `${metrics?.syncedCount ?? 0} synced`, note: `${metrics?.errorCount ?? 0} requiring attention`, icon: CheckCircle2, tone: "bg-[#f1efff] text-[#5a47b3]" },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7">
      <section className="vault-grid relative overflow-hidden rounded-[28px] bg-[#14213d] px-6 py-7 text-white shadow-[0_20px_60px_rgba(20,33,61,0.16)] md:px-9 md:py-9">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#4b9cff]/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl"><div className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.13em] text-[#a8c8ef] uppercase"><ShieldCheck className="h-4 w-4" /> Secure workspace</div><h1 className="text-3xl font-semibold tracking-[-0.035em] md:text-4xl">Good to see you, {user?.name?.split(" ")[0] || "there"}.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#bfd0e9]">Your web-managed files are encrypted before storage, versioned on every backup, and tracked in a complete operational trail.</p></div>
          <Link href="/files"><Button className="bg-white text-[#17376a] hover:bg-[#eef5ff]">Manage files <ArrowUpRight className="ml-2 h-4 w-4" /></Button></Link>
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3">{cards.map(card => <Card key={card.label} className="border-[#e2e8f0] bg-white shadow-sm"><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-medium text-[#66758b]">{card.label}</p><p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#1d2939]">{card.value}</p><p className="mt-2 text-xs text-[#8a97a9]">{card.note}</p></div><div className={`rounded-xl p-2.5 ${card.tone}`}><card.icon className="h-5 w-5" /></div></div></CardContent></Card>)}</section>
      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]"><Card className="border-[#e2e8f0] shadow-sm"><CardContent className="p-6"><div><h2 className="font-semibold text-[#1d2939]">Backup history</h2><p className="mt-1 text-sm text-[#7c8aa0]">Encrypted snapshot operations over time.</p></div>{backupHistory.length ? <div className="mt-6 h-48"><ResponsiveContainer width="100%" height="100%"><AreaChart data={backupHistory} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}><defs><linearGradient id="backupGlow" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2d72ba" stopOpacity={0.28} /><stop offset="100%" stopColor="#2d72ba" stopOpacity={0.02} /></linearGradient></defs><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: "#8090a3", fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(20, 33, 61, 0.08)" }} /><Area type="monotone" dataKey="backups" stroke="#2467ae" strokeWidth={2.5} fill="url(#backupGlow)" /></AreaChart></ResponsiveContainer></div> : <div className="mt-6 flex h-48 items-center justify-center rounded-2xl border border-dashed border-[#dce5f0] bg-[#fbfcfe] text-center"><p className="text-sm text-[#8795a8]">The history chart will populate after your first backup.</p></div>}</CardContent></Card><Card className="border-[#e2e8f0] bg-[#fbfcfe] shadow-sm"><CardContent className="p-6"><div className="flex h-full flex-col"><div className="w-fit rounded-2xl bg-[#e9f3ff] p-3 text-[#245d9f]"><DatabaseBackup className="h-5 w-5" /></div><h2 className="mt-5 font-semibold text-[#1d2939]">Backup discipline</h2><p className="mt-2 text-sm leading-6 text-[#718096]">Version history is retained as encrypted snapshots. Restore any earlier version without overwriting its audit history.</p><div className="mt-6 space-y-3 text-sm"><div className="flex items-center gap-3 text-[#52637a]"><CheckCircle2 className="h-4 w-4 text-[#258355]" /> AES-256-GCM encryption</div><div className="flex items-center gap-3 text-[#52637a]"><CheckCircle2 className="h-4 w-4 text-[#258355]" /> Per-file immutable versions</div><div className="flex items-center gap-3 text-[#52637a]"><CheckCircle2 className="h-4 w-4 text-[#258355]" /> Timestamped audit trail</div></div><Link href="/schedules" className="mt-auto pt-7"><Button variant="outline" className="w-full border-[#cfdae8] bg-white">Configure schedules</Button></Link></div></CardContent></Card></section>
      <section><Card className="border-[#e2e8f0] shadow-sm"><CardContent className="p-0"><div className="flex items-center justify-between px-6 py-5"><div><h2 className="font-semibold text-[#1d2939]">Recent operations</h2><p className="mt-1 text-sm text-[#7c8aa0]">A live view of backup, sync, restore, and schedule activity.</p></div><Link href="/activity" className="text-sm font-medium text-[#2363ad] hover:text-[#174b88]">View activity</Link></div><div className="border-t border-[#edf0f4]">{activity.isLoading ? <p className="px-6 py-8 text-sm text-muted-foreground">Loading activity…</p> : activity.data?.length ? activity.data.slice(0, 5).map(item => <div key={item.id} className="flex items-center gap-4 border-b border-[#f0f2f5] px-6 py-4 last:border-0"><div className={`rounded-full p-2 ${item.status === "success" ? "bg-[#eef8f2] text-[#238754]" : "bg-[#fff1f0] text-[#c8453d]"}`}><Activity className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#324054]">{item.detail}</p><p className="mt-1 text-xs text-[#8996a9]">{item.fileName || "Workspace"} · {new Date(item.createdAt).toLocaleString()}</p></div><Badge variant="secondary" className="capitalize">{item.action}</Badge></div>) : <div className="px-6 py-10 text-center"><DatabaseBackup className="mx-auto h-7 w-7 text-[#9ba7b8]" /><p className="mt-3 text-sm font-medium text-[#56667c]">No operations recorded yet</p><p className="mt-1 text-xs text-[#8b98aa]">Upload your first file to create an encrypted backup.</p></div>}</div></CardContent></Card></section>
    </div>
  );
}
