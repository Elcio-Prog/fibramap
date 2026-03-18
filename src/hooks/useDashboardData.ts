import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, subMonths, subDays, startOfDay, endOfDay, format } from "date-fns";

export type PeriodFilter = "today" | "7d" | "30d" | "custom" | "total";

export interface DateRange {
  from: Date;
  to: Date;
}

export function getDateRange(period: PeriodFilter, custom?: DateRange): DateRange {
  const now = new Date();
  switch (period) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "7d":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case "30d":
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case "total":
      return { from: new Date("2020-01-01"), to: endOfDay(now) };
    case "custom":
      return custom || { from: startOfMonth(now), to: endOfDay(now) };
    default:
      return { from: startOfMonth(now), to: endOfDay(now) };
  }
}

function getPreviousRange(range: DateRange): DateRange {
  const durationMs = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - durationMs),
    to: new Date(range.from.getTime() - 1),
  };
}

// Fetch all processed feasibility items for a date range (admin-only view)
async function fetchSentItems(from: Date, to: Date) {
  const { data, error } = await supabase
    .from("ws_feasibility_items")
    .select("id, batch_id, data_envio, created_at, result_provider, cidade_a, uf_a, lat_a, lng_a, endereco_a, is_viable, id_lote, processing_status")
    .in("processing_status", ["viable", "not_viable"])
    .gte("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) throw error;
  return data || [];
}

async function fetchLogs(from: Date, to: Date) {
  const { data, error } = await supabase
    .from("logs_envio_sharepoint")
    .select("id, usuario_email, quantidade_itens, data_envio, status, id_lote")
    .gte("data_envio", from.toISOString())
    .lte("data_envio", to.toISOString())
    .order("data_envio", { ascending: true });
  if (error) throw error;
  return (data || []) as any[];
}

export function useDashboardKPIs(period: PeriodFilter, customRange?: DateRange) {
  const range = getDateRange(period, customRange);
  const prevRange = getPreviousRange(range);

  return useQuery({
    queryKey: ["dashboard-kpis", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const [items, prevItems, logs, prevLogs] = await Promise.all([
        fetchSentItems(range.from, range.to),
        fetchSentItems(prevRange.from, prevRange.to),
        fetchLogs(range.from, range.to),
        fetchLogs(prevRange.from, prevRange.to),
      ]);

      // 1. Total viabilidades
      const totalCurrent = items.length;
      const totalPrev = prevItems.length;
      const totalVariation = totalPrev > 0 ? ((totalCurrent - totalPrev) / totalPrev) * 100 : null;

      // 2. Top solicitante
      const emailCounts: Record<string, number> = {};
      logs.forEach((l: any) => {
        emailCounts[l.usuario_email] = (emailCounts[l.usuario_email] || 0) + l.quantidade_itens;
      });
      const topSolicitante = Object.entries(emailCounts).sort((a, b) => b[1] - a[1])[0];

      // 3. Lote vs unitário
      const loteLogs = logs.filter((l: any) => l.quantidade_itens > 1);
      const unitarioLogs = logs.filter((l: any) => l.quantidade_itens === 1);
      const loteItems = loteLogs.reduce((s: number, l: any) => s + l.quantidade_itens, 0);
      const unitarioItems = unitarioLogs.reduce((s: number, l: any) => s + l.quantidade_itens, 0);
      const totalItems = loteItems + unitarioItems;
      const lotePct = totalItems > 0 ? (loteItems / totalItems) * 100 : 0;

      // 4. Comparativo (current vs prev)
      const compVariation = totalVariation;

      // 5. Top provedor aprovado
      const providerCounts: Record<string, number> = {};
      items.filter((i: any) => i.is_viable === true).forEach((i: any) => {
        const p = i.result_provider || "Sem provedor";
        providerCounts[p] = (providerCounts[p] || 0) + 1;
      });
      const topProvider = Object.entries(providerCounts).sort((a, b) => b[1] - a[1])[0];

      // 6. Top cidade
      const cityCounts: Record<string, number> = {};
      items.forEach((i: any) => {
        const city = i.cidade_a || "Não informada";
        cityCounts[city] = (cityCounts[city] || 0) + 1;
      });
      const topCity = Object.entries(cityCounts).sort((a, b) => b[1] - a[1])[0];

      return {
        total: { current: totalCurrent, prev: totalPrev, variation: totalVariation },
        topSolicitante: topSolicitante ? { email: topSolicitante[0], count: topSolicitante[1] } : null,
        loteVsUnitario: { lotePct, loteItems, unitarioItems },
        comparativo: { current: totalCurrent, prev: totalPrev, variation: compVariation },
        topProvider: topProvider ? { name: topProvider[0], count: topProvider[1] } : null,
        topCity: topCity ? { name: topCity[0], count: topCity[1] } : null,
        range,
        items,
        logs,
      };
    },
  });
}

// Detailed data hooks for drill-downs
export function useDrilldownItems(period: PeriodFilter, customRange?: DateRange) {
  const range = getDateRange(period, customRange);
  return useQuery({
    queryKey: ["drilldown-items", range.from.toISOString(), range.to.toISOString()],
    queryFn: () => fetchSentItems(range.from, range.to),
  });
}

export function useDrilldownLogs(period: PeriodFilter, customRange?: DateRange) {
  const range = getDateRange(period, customRange);
  return useQuery({
    queryKey: ["drilldown-logs", range.from.toISOString(), range.to.toISOString()],
    queryFn: () => fetchLogs(range.from, range.to),
  });
}

// For comparativo: last 6 months data
export function useComparativoData() {
  return useQuery({
    queryKey: ["comparativo-6months"],
    queryFn: async () => {
      const now = new Date();
      const sixMonthsAgo = startOfMonth(subMonths(now, 5));
      const items = await fetchSentItems(sixMonthsAgo, endOfDay(now));
      const months: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const m = subMonths(now, i);
        months[format(startOfMonth(m), "yyyy-MM")] = 0;
      }
      items.forEach((item: any) => {
        const key = format(new Date(item.data_envio), "yyyy-MM");
        if (key in months) months[key]++;
      });
      return Object.entries(months).map(([month, total]) => ({ month, total }));
    },
  });
}
