import { execFileSync } from "node:child_process";

export type PortProcess = { pid: number; command?: string };

export function parseLsofOutput(output: string): PortProcess[] {
  const lines = output.split(/\r?\n/).filter(Boolean);
  const results: PortProcess[] = [];
  let current: Partial<PortProcess> = {};
  for (const line of lines) {
    if (line.startsWith("p")) {
      if (current.pid) results.push(current as PortProcess);
      current = { pid: Number.parseInt(line.slice(1), 10) };
    } else if (line.startsWith("c")) {
      current.command = line.slice(1);
    }
  }
  if (current.pid) results.push(current as PortProcess);
  return results;
}

export function listPortListeners(port: number): PortProcess[] {
  try {
    const out = execFileSync(
      "lsof",
      ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-FpFc"],
      { encoding: "utf-8" },
    );
    return parseLsofOutput(out);
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      throw new Error("lsof not found; required for --force");
    }
    if (status === 1) return []; // no listeners
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export function forceFreePort(port: number): PortProcess[] {
  const listeners = listPortListeners(port);
  for (const proc of listeners) {
    try {
      process.kill(proc.pid, "SIGTERM");
    } catch (err) {
      throw new Error(
        `failed to kill pid ${proc.pid}${proc.command ? ` (${proc.command})` : ""}: ${String(err)}`,
      );
    }
  }
  return listeners;
}
