import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import ImportWizard from "@/components/lm/ImportWizard";
import ManualEntryForm from "@/components/lm/ManualEntryForm";
import RadiusSearch from "@/components/lm/RadiusSearch";
import { useComprasLM } from "@/hooks/useComprasLM";
import { geocodeAddress } from "@/lib/geo-utils";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Plus, Search, Database, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function BaseLMPage() {
  const { data: compras, refetch } = useComprasLM();
  const [regeocoding, setRegeocoding] = useState(false);
  const [regeoProgress, setRegeoProgress] = useState({ done: 0, total: 0 });

  const total = compras?.length || 0;
  const geocoded = compras?.filter(c => c.geocoding_status === "done").length || 0;
  const failed = compras?.filter(c => c.geocoding_status === "failed").length || 0;
  const pending = compras?.filter(c => c.geocoding_status === "pending").length || 0;

  const handleReGeocode = async () => {
    if (!compras) return;
    const items = compras.filter(c => c.geocoding_status === "failed" || c.geocoding_status === "pending");
    if (items.length === 0) {
      toast.info("Nenhum registro pendente para geocodificar");
      return;
    }
    setRegeocoding(true);
    setRegeoProgress({ done: 0, total: items.length });
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const result = await geocodeAddress(item.endereco, item.cidade, item.uf);
        if (result) {
          await supabase
            .from("lm_contracts")
            .update({ lat: result.lat, lng: result.lng, geocoding_status: "done" } as any)
            .eq("id", item.id);
          successCount++;
        } else {
          await supabase
            .from("lm_contracts")
            .update({ geocoding_status: "failed" } as any)
            .eq("id", item.id);
          failCount++;
        }
      } catch {
        failCount++;
      }
      setRegeoProgress({ done: i + 1, total: items.length });
      // Rate limit between items (nominatimSearch already waits internally for fallbacks)
      await new Promise(r => setTimeout(r, 1100));
    }

    setRegeocoding(false);
    refetch();
    toast.success(`Geocodificação concluída: ${successCount} sucesso, ${failCount} falhas`);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6" /> Base LM
          </h1>
          <p className="text-sm text-muted-foreground">
            {total} registros · {geocoded} geocodificados · {failed > 0 ? <span className="text-destructive font-medium">{failed} falhos</span> : `${failed} falhos`} · {pending} pendentes
          </p>
        </div>
        {(failed > 0 || pending > 0) && (
          <Button
            onClick={handleReGeocode}
            disabled={regeocoding}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            {regeocoding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {regeoProgress.done}/{regeoProgress.total}
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Re-geocodificar ({failed + pending})
              </>
            )}
          </Button>
        )}
      </div>

      <Tabs defaultValue="import">
        <TabsList>
          <TabsTrigger value="import" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Importar
          </TabsTrigger>
          <TabsTrigger value="complement" className="gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Complemento
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Cadastro
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-1.5">
            <Search className="h-3.5 w-3.5" /> Busca Raio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <ImportWizard />
        </TabsContent>

        <TabsContent value="complement">
          <ImportWizard isComplement />
        </TabsContent>

        <TabsContent value="manual">
          <ManualEntryForm />
        </TabsContent>

        <TabsContent value="search">
          <RadiusSearch />
        </TabsContent>
      </Tabs>
    </div>
  );
}
