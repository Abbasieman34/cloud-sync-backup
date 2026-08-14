import type { Request, Response } from "express";
import { z } from "zod";
import { downloadCompanionVersion, syncCompanionFile } from "./companionService";

const syncInput = z.object({
  deviceToken: z.string().min(40), fileName: z.string().trim().min(1).max(255), logicalPath: z.string().trim().min(1).max(512),
  mimeType: z.string().trim().min(1).max(255), plaintextByteSize: z.number().int().positive(), checksum: z.string().length(64),
  ciphertextBase64: z.string().min(1), initializationVector: z.string().min(1), authenticationTag: z.string().min(1),
});
const downloadInput = z.object({ deviceToken: z.string().min(40), versionId: z.number().int().positive() });

function sendError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : "Companion request failed.";
  const status = error instanceof z.ZodError ? 400 : /not paired|not available|invalid/i.test(message) ? 403 : 500;
  return res.status(status).json({ error: message });
}

export async function companionSyncHandler(req: Request, res: Response) {
  try { return res.json(await syncCompanionFile(syncInput.parse(req.body))); }
  catch (error) { return sendError(res, error); }
}

export async function companionDownloadHandler(req: Request, res: Response) {
  try { return res.json(await downloadCompanionVersion(downloadInput.parse(req.body))); }
  catch (error) { return sendError(res, error); }
}
