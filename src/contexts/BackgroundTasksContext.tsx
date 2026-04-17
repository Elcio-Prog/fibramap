import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from "react";
import { toast } from "sonner";

export type BgTaskType = "ws-single" | "ws-batch" | "geogrid";
export type BgTaskStatus = "running" | "done" | "error" | "cancelled";

export interface BgTask {
  id: string;
  type: BgTaskType;
  label: string;
  status: BgTaskStatus;
  progress: number; // 0..total
  total: number;
  message?: string;
  link?: string;          // route the user can navigate to to see the result
  startedAt: number;
  endedAt?: number;
  cancel?: () => void;    // optional cancel handler
}

interface StartArgs {
  type: BgTaskType;
  label: string;
  total?: number;
  link?: string;
  cancel?: () => void;
}

interface BackgroundTasksContextValue {
  tasks: BgTask[];
  activeCount: number;
  start: (args: StartArgs) => string; // returns task id
  update: (id: string, patch: Partial<Pick<BgTask, "progress" | "total" | "message" | "label" | "link">>) => void;
  complete: (id: string, opts?: { message?: string; link?: string; silent?: boolean }) => void;
  fail: (id: string, message: string) => void;
  cancel: (id: string) => void;
  remove: (id: string) => void;
  clearFinished: () => void;
}

const Ctx = createContext<BackgroundTasksContextValue | null>(null);

const TYPE_LABELS: Record<BgTaskType, string> = {
  "ws-single": "Busca unitária",
  "ws-batch": "Busca em lote",
  geogrid: "GeoGrid – Portas livres",
};

export function BackgroundTasksProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<BgTask[]>([]);
  const tasksRef = useRef<BgTask[]>([]);
  tasksRef.current = tasks;

  const setTask = useCallback((id: string, updater: (t: BgTask) => BgTask) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? updater(t) : t)));
  }, []);

  const remove = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setTasks((prev) => prev.filter((t) => t.status === "running"));
  }, []);

  const cancel = useCallback((id: string) => {
    const t = tasksRef.current.find((x) => x.id === id);
    if (!t) return;
    try { t.cancel?.(); } catch {}
    setTasks((prev) =>
      prev.map((x) => (x.id === id ? { ...x, status: "cancelled", endedAt: Date.now() } : x))
    );
  }, []);

  const start = useCallback(
    ({ type, label, total = 0, link, cancel: cancelFn }: StartArgs) => {
      const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      // One-per-type rule: cancel any other running task of same type.
      const stale = tasksRef.current.filter((t) => t.type === type && t.status === "running");
      stale.forEach((t) => {
        try { t.cancel?.(); } catch {}
      });
      setTasks((prev) =>
        prev
          .map((t) =>
            t.type === type && t.status === "running"
              ? { ...t, status: "cancelled" as BgTaskStatus, endedAt: Date.now() }
              : t,
          )
          .concat({
            id,
            type,
            label: label || TYPE_LABELS[type],
            status: "running",
            progress: 0,
            total,
            link,
            startedAt: Date.now(),
            cancel: cancelFn,
          }),
      );
      return id;
    },
    [],
  );

  const update = useCallback<BackgroundTasksContextValue["update"]>(
    (id, patch) => {
      setTask(id, (t) => ({ ...t, ...patch }));
    },
    [setTask],
  );

  const complete = useCallback<BackgroundTasksContextValue["complete"]>(
    (id, opts) => {
      const t = tasksRef.current.find((x) => x.id === id);
      if (!t || t.status !== "running") return;
      setTask(id, (t) => ({
        ...t,
        status: "done",
        endedAt: Date.now(),
        message: opts?.message ?? t.message,
        link: opts?.link ?? t.link,
        progress: t.total > 0 ? t.total : t.progress,
      }));
      if (!opts?.silent) {
        toast.success(`${t.label} concluída`, {
          description: opts?.message,
          action: opts?.link
            ? { label: "Ver", onClick: () => { window.location.assign(opts!.link!); } }
            : t.link
              ? { label: "Ver", onClick: () => { window.location.assign(t.link!); } }
              : undefined,
        });
      }
    },
    [setTask],
  );

  const fail = useCallback<BackgroundTasksContextValue["fail"]>(
    (id, message) => {
      const t = tasksRef.current.find((x) => x.id === id);
      if (!t) return;
      setTask(id, (t) => ({ ...t, status: "error", endedAt: Date.now(), message }));
      toast.error(`${t.label} falhou`, { description: message });
    },
    [setTask],
  );

  const value = useMemo<BackgroundTasksContextValue>(
    () => ({
      tasks,
      activeCount: tasks.filter((t) => t.status === "running").length,
      start,
      update,
      complete,
      fail,
      cancel,
      remove,
      clearFinished,
    }),
    [tasks, start, update, complete, fail, cancel, remove, clearFinished],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBackgroundTasks() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBackgroundTasks must be used within BackgroundTasksProvider");
  return ctx;
}
