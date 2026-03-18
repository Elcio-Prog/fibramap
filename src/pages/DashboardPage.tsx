import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Users, Layers, GitCompare, Building2, MapPin, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useDashboardKPIs, PeriodFilter, DateRange } from "@/hooks/useDashboardData";

function VariationBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">N/A</span>;
  const isPositive = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isPositive ? "text-accent" : "text-destructive"}`}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

interface KpiCardProps {
  title: string;
  value: string;
  subtitle?: string;
  variation?: number | null;
  icon: React.ElementType;
  onClick: () => void;
}

function KpiCard({ title, value, subtitle, variation, icon: Icon, onClick }: KpiCardProps) {
  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2 min-w-0 flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight truncate">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
            {variation !== undefined && (
              <div className="pt-1">
                <VariationBadge value={variation ?? null} />
                <span className="text-[10px] text-muted-foreground ml-1">vs período anterior</span>
              </div>
            )}
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodFilter>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const customRange: DateRange | undefined =
    period === "custom" && customFrom && customTo
      ? { from: new Date(customFrom), to: new Date(customTo + "T23:59:59") }
      : undefined;

  const { data, isLoading } = useDashboardKPIs(period, customRange);

  const periodParam = period === "custom" && customFrom && customTo
    ? `period=custom&from=${customFrom}&to=${customTo}`
    : `period=${period}`;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold">Dashboard de Viabilidades</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {period === "custom" && (
            <>
              <Input type="date" className="h-8 w-[140px] text-xs" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <Input type="date" className="h-8 w-[140px] text-xs" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            title="Total de Viabilidades Enviadas"
            value={String(data?.total.current ?? 0)}
            variation={data?.total.variation}
            icon={BarChart3}
            onClick={() => navigate(`/dashboard/volume?${periodParam}`)}
          />
          <KpiCard
            title="Maior Solicitante"
            value={data?.topSolicitante?.email?.split("@")[0] ?? "—"}
            subtitle={data?.topSolicitante ? `${data.topSolicitante.count} viabilidades` : undefined}
            icon={Users}
            onClick={() => navigate(`/dashboard/solicitantes?${periodParam}`)}
          />
          <KpiCard
            title="Lote vs. Busca Unitária"
            value={`${data?.loteVsUnitario.lotePct.toFixed(0) ?? 0}% em lote`}
            subtitle={`${data?.loteVsUnitario.loteItems ?? 0} lote · ${data?.loteVsUnitario.unitarioItems ?? 0} unitário`}
            icon={Layers}
            onClick={() => navigate(`/dashboard/lote-unitario?${periodParam}`)}
          />
          <KpiCard
            title="Comparativo Mensal"
            value={String(data?.comparativo.current ?? 0)}
            subtitle={`Período anterior: ${data?.comparativo.prev ?? 0}`}
            variation={data?.comparativo.variation}
            icon={GitCompare}
            onClick={() => navigate(`/dashboard/comparativo?${periodParam}`)}
          />
          <KpiCard
            title="Provedor com mais aprovadas"
            value={data?.topProvider?.name ?? "—"}
            subtitle={data?.topProvider ? `${data.topProvider.count} aprovadas` : undefined}
            icon={Building2}
            onClick={() => navigate(`/dashboard/provedores?${periodParam}`)}
          />
          <KpiCard
            title="Região com mais consultas"
            value={data?.topCity?.name ?? "—"}
            subtitle={data?.topCity ? `${data.topCity.count} consultas` : undefined}
            icon={MapPin}
            onClick={() => navigate(`/dashboard/regioes?${periodParam}`)}
          />
        </div>
      )}
    </div>
  );
}
