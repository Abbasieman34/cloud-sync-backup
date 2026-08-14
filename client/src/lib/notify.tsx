import { CheckCircle2, Info, ShieldAlert, X, XCircle } from "lucide-react";
import { toast } from "sonner";

type NotificationTone = "success" | "error" | "info" | "warning";

type NotificationOptions = {
  title: string;
  message?: string;
};

const toneConfig: Record<NotificationTone, { icon: typeof CheckCircle2; iconClass: string; railClass: string }> = {
  success: { icon: CheckCircle2, iconClass: "bg-[#eaf8ef] text-[#218152]", railClass: "bg-[#2e9361]" },
  error: { icon: XCircle, iconClass: "bg-[#fff0ef] text-[#c8463e]", railClass: "bg-[#d3534b]" },
  info: { icon: Info, iconClass: "bg-[#e9f3ff] text-[#2366aa]", railClass: "bg-[#2d72ba]" },
  warning: { icon: ShieldAlert, iconClass: "bg-[#fff7e8] text-[#a2691a]", railClass: "bg-[#d79935]" },
};

function show(tone: NotificationTone, options: NotificationOptions) {
  const config = toneConfig[tone];
  const Icon = config.icon;
  toast.custom(id => (
    <div className="relative flex w-[360px] items-start gap-3 overflow-hidden rounded-2xl border border-[#dce4ef] bg-white p-4 shadow-[0_16px_42px_rgba(20,33,61,0.16)]">
      <div className={`absolute inset-y-0 left-0 w-1 ${config.railClass}`} />
      <div className={`ml-1 rounded-xl p-2 ${config.iconClass}`}><Icon className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1 pr-3"><p className="text-sm font-semibold text-[#27364b]">{options.title}</p>{options.message ? <p className="mt-1 text-xs leading-5 text-[#718096]">{options.message}</p> : null}</div>
      <button onClick={() => toast.dismiss(id)} className="rounded-md p-1 text-[#96a2b2] transition-colors hover:bg-[#f2f5f8] hover:text-[#46576c]" aria-label="Dismiss notification"><X className="h-4 w-4" /></button>
    </div>
  ), { duration: tone === "error" ? 7000 : 4500 });
}

export const notify = {
  success: (title: string, message?: string) => show("success", { title, message }),
  error: (title: string, message?: string) => show("error", { title, message }),
  info: (title: string, message?: string) => show("info", { title, message }),
  warning: (title: string, message?: string) => show("warning", { title, message }),
};
