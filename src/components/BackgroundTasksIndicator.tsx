import { useNavigate } from "react-router-dom";
import { Activity, X, CheckCircle2, AlertCircle, Loader2, ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBackgroundTasks, type BgTask } from "@/contexts/BackgroundTasksContext";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "header" | "sidebar";
  className?: string;
}

function timeAgo(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h`;
}

function StatusIcon({ status }: { status: BgTask["status"] }) {
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />;
  if (status === "done") return <CheckCircle2 className="h-3.5 w-3.5 text-primary" />;
  if (status === "error") return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
  return <X className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function BackgroundTasksIndicator({ variant = "header", className }: Props) {
  const { tasks, activeCount, cancel, remove, clearFinished } = useBackgroundTasks();
  const navigate = useNavigate();

  // Sorted: running first, then most recent
  const sorted = [...tasks].sort((a, b) => {
    if (a.status === "running" && b.status !== "running") return -1;
    if (b.status === "running" && a.status !== "running") return 1;
    return (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt);
  });

  const finishedCount = tasks.filter((t) => t.status !== "running").length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative h-9 w-9 p-0",
            variant === "sidebar" && "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            className,
          )}
          aria-label="Tarefas em segundo plano"
        >
          <Activity className={cn("h-4 w-4", activeCount > 0 && "text-primary")} />
          {activeCount > 0 && (
            <Badge
              variant="default"
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none"
            >
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-semibold">Tarefas em segundo plano</div>
          {finishedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-muted-foreground"
              onClick={clearFinished}
            >
              <Trash2 className="h-3 w-3" />
              Limpar finalizadas
            </Button>
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            Nenhuma tarefa em andamento.
          </div>
        ) : (
          <ScrollArea className="max-h-[420px]">
            <div className="divide-y">
              {sorted.map((t) => {
                const pct = t.total > 0 ? Math.min(100, Math.round((t.progress / t.total) * 100)) : null;
                return (
                  <div key={t.id} className="px-3 py-2.5 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <StatusIcon status={t.status} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{t.label}</div>
                        {t.message && (
                          <div className="truncate text-[11px] text-muted-foreground">{t.message}</div>
                        )}
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {timeAgo(t.endedAt ?? t.startedAt)}
                      </span>
                    </div>

                    {t.status === "running" && pct !== null && (
                      <div className="space-y-0.5">
                        <Progress value={pct} className="h-1.5" />
                        <div className="text-[10px] text-muted-foreground">
                          {t.progress}/{t.total} ({pct}%)
                        </div>
                      </div>
                    )}
                    {t.status === "running" && pct === null && (
                      <div className="text-[10px] text-muted-foreground">Processando…</div>
                    )}

                    <div className="flex items-center justify-end gap-1 pt-0.5">
                      {t.link && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 px-2 text-xs"
                          onClick={() => navigate(t.link!)}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver
                        </Button>
                      )}
                      {t.status === "running" ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-destructive"
                          onClick={() => cancel(t.id)}
                        >
                          Cancelar
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground"
                          onClick={() => remove(t.id)}
                        >
                          Remover
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
