/// <reference lib="webworker" />
import {
  runOptimizer,
  type OptimizerInput,
  type TopResult,
  type ProgressMsg,
} from "../lib/optimizer";

export type WorkerInbound = OptimizerInput;
export type WorkerOutbound =
  | ({ type: "progress" } & ProgressMsg)
  | { type: "done"; result: TopResult[] }
  | { type: "error"; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<WorkerInbound>) => {
  try {
    const result = runOptimizer(e.data, (p) => {
      ctx.postMessage({ type: "progress", ...p } satisfies WorkerOutbound);
    });
    ctx.postMessage({ type: "done", result } satisfies WorkerOutbound);
  } catch (err) {
    ctx.postMessage({ type: "error", error: (err as Error).message } satisfies WorkerOutbound);
  }
};
