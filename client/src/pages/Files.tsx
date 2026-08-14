import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { notify } from "@/lib/notify";
import { ArchiveRestore, Download, FileLock2, FileUp, History, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useRef, useState } from "react";

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

function bufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    let chunk = "";
    const end = Math.min(offset + 0x8000, bytes.length);
    for (let index = offset; index < end; index += 1) chunk += String.fromCharCode(bytes[index] ?? 0);
    chunks.push(chunk);
  }
  return btoa(chunks.join(""));
}

export default function FilesPage() {
  const files = trpc.backup.listFiles.useQuery();
  const utils = trpc.useUtils();
  const upload = trpc.backup.upload.useMutation({ onSuccess: async result => { await utils.backup.listFiles.invalidate(); notify.success("Backup protected", `${result.file.displayName} is encrypted and synchronized.`); }, onError: error => notify.error("Backup could not be created", error.message) });
  const inputRef = useRef<HTMLInputElement>(null);
  const [workingFile, setWorkingFile] = useState<string | null>(null);

  const handleFile = async (file?: File) => {
    if (!file) return;
    setWorkingFile(file.name);
    try {
      const dataBase64 = bufferToBase64(await file.arrayBuffer());
      await upload.mutateAsync({ fileName: file.name, logicalPath: file.name, mimeType: file.type || "application/octet-stream", dataBase64 });
    } catch (error) {
      notify.error("Backup could not be created", error instanceof Error ? error.message : "The selected file could not be backed up.");
    } finally { setWorkingFile(null); if (inputRef.current) inputRef.current.value = ""; }
  };

  return <div className="mx-auto w-full max-w-7xl space-y-6"><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-bold tracking-[0.14em] text-[#7291b9] uppercase">Encrypted vault</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-[#1d2939]">Managed files</h1><p className="mt-2 text-sm text-[#748196]">Every upload creates an encrypted, immutable backup version.</p></div><div><input ref={inputRef} onChange={event => handleFile(event.target.files?.[0])} type="file" className="hidden" /><Button onClick={() => inputRef.current?.click()} disabled={upload.isPending}><FileUp className="mr-2 h-4 w-4" />{workingFile ? `Protecting ${workingFile}` : "Add a file"}</Button></div></div><Card className="border-[#e2e8f0] shadow-sm"><CardContent className="p-0">{files.isLoading ? <div className="flex items-center justify-center py-20 text-[#738197]"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading files</div> : files.data?.length ? <div className="divide-y divide-[#edf0f4]">{files.data.map(file => <div key={file.id} className="flex flex-col gap-4 px-5 py-5 md:flex-row md:items-center"><div className="rounded-xl bg-[#eaf3ff] p-3 text-[#215f9f]"><FileLock2 className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate font-medium text-[#26354a]">{file.displayName}</p><p className="mt-1 text-xs text-[#8491a5]">{formatBytes(file.byteSize)} · Last synced {file.lastSyncedAt ? new Date(file.lastSyncedAt).toLocaleString() : "pending"}</p></div><Badge className={file.syncStatus === "synced" ? "bg-[#eaf7ef] text-[#207347] hover:bg-[#eaf7ef]" : file.syncStatus === "error" ? "bg-[#fff0ef] text-[#b63e36] hover:bg-[#fff0ef]" : "bg-[#fff7e8] text-[#986116] hover:bg-[#fff7e8]"}>{file.syncStatus === "synced" ? <ShieldCheck className="mr-1 h-3.5 w-3.5" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}{file.syncStatus}</Badge><VersionDialog fileId={file.id} fileName={file.displayName} /></div>)}</div> : <div className="py-20 text-center"><div className="mx-auto w-fit rounded-2xl bg-[#edf5ff] p-4 text-[#2764a5]"><FileUp className="h-7 w-7" /></div><p className="mt-4 font-medium text-[#405068]">Your vault is ready.</p><p className="mt-1 text-sm text-[#8491a5]">Add a file to create the first encrypted backup.</p><Button className="mt-5" onClick={() => inputRef.current?.click()}>Add a file</Button></div>}</CardContent></Card></div>;
}

function VersionDialog({ fileId, fileName }: { fileId: number; fileName: string }) {
  const [open, setOpen] = useState(false);
  const versions = trpc.backup.listVersions.useQuery({ fileId }, { enabled: open });
  const utils = trpc.useUtils();
  const restore = trpc.backup.restore.useMutation({ onSuccess: async () => { await utils.backup.listFiles.invalidate(); await versions.refetch(); notify.success("Version restored", "The selected historical version is now a new encrypted snapshot."); }, onError: error => notify.error("Restore could not be completed", error.message) });
  const download = trpc.backup.downloadVersion.useMutation({ onError: error => notify.error("Download could not be prepared", error.message) });
  const handleDownload = async (versionId: number) => {
    const payload = await download.mutateAsync({ versionId });
    const binary = atob(payload.dataBase64); const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: payload.mimeType }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = payload.fileName; anchor.click(); URL.revokeObjectURL(url);
    notify.info("Secure download prepared", `${payload.fileName} was decrypted for this download only.`);
  };
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline" className="border-[#d7e0ed]"><History className="mr-2 h-4 w-4" />Versions</Button></DialogTrigger><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Version history</DialogTitle><DialogDescription>{fileName} · Each snapshot remains encrypted in cloud storage.</DialogDescription></DialogHeader><div className="max-h-[52vh] overflow-y-auto divide-y divide-[#edf0f4]">{versions.isLoading ? <div className="py-10 text-center text-sm text-muted-foreground">Loading versions…</div> : versions.data?.map(version => { const localOnly = version.encryptionAlgorithm === "aes-256-gcm-client"; return <div key={version.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"><div className="flex-1"><p className="text-sm font-medium">Version {version.versionNumber} {version.sourceOperation === "restore" && <span className="text-[#5a47b3]">· restored snapshot</span>}</p><p className="mt-1 text-xs text-[#7d8aa0]">{new Date(version.createdAt).toLocaleString()} · {formatBytes(version.byteSize)}</p>{localOnly ? <p className="mt-1.5 text-xs text-[#2463a7]">Local companion version · restore with <span className="font-mono">sync.mjs restore --version {version.id}</span></p> : null}</div>{localOnly ? <span className="text-xs font-medium text-[#607088]">Paired local client required</span> : <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => handleDownload(version.id)} disabled={download.isPending}><Download className="mr-1.5 h-3.5 w-3.5" />Download</Button><Button size="sm" onClick={() => restore.mutate({ versionId: version.id })} disabled={restore.isPending}><ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />Restore</Button></div>}</div>; })}</div></DialogContent></Dialog>;
}
