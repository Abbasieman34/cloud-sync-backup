import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Activity as ActivityIcon, CheckCircle2, XCircle } from "lucide-react";

export default function ActivityPage() {
  const activity = trpc.backup.activity.useQuery();
  return <div className="mx-auto w-full max-w-7xl space-y-6"><div><p className="text-xs font-bold tracking-[0.14em] text-[#7291b9] uppercase">Audit trail</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-[#1d2939]">Activity log</h1><p className="mt-2 text-sm text-[#748196]">A timestamped record of every backup, sync, restore, and scheduled operation.</p></div><Card className="border-[#e2e8f0] shadow-sm"><CardContent className="p-0">{activity.data?.length ? <div className="divide-y divide-[#edf0f4]">{activity.data.map(item => <div key={item.id} className="flex gap-4 px-5 py-5"><div className={`mt-0.5 rounded-full p-2 ${item.status === "success" ? "bg-[#eaf7ef] text-[#228052]" : "bg-[#fff0ef] text-[#bd4940]"}`}>{item.status === "success" ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}</div><div className="min-w-0 flex-1"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p className="font-medium text-[#344258]">{item.detail}</p><Badge variant="secondary" className="w-fit capitalize">{item.action}</Badge></div><p className="mt-1.5 text-sm text-[#8090a3]">{item.fileName || "Workspace"} · {new Date(item.createdAt).toLocaleString()}</p></div></div>)}</div> : <div className="py-20 text-center"><ActivityIcon className="mx-auto h-8 w-8 text-[#9ba7b8]" /><p className="mt-4 font-medium text-[#45536a]">No activity has been recorded.</p></div>}</CardContent></Card></div>;
}
