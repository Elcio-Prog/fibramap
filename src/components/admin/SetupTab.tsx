import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Save, Plus, X } from "lucide-react";

export default function SetupTab() {
  const { toast } = useToast();
  const [fatorAjuste, setFatorAjuste] = useState(100);
  const [capexLastMile, setCapexLastMile] = useState(750);
  const [regraProjetista, setRegraProjetista] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projetistaOptions, setProjetistaOptions] = useState<string[]>([]);
  const [newProjetista, setNewProjetista] = useState("");

  useEffect(() => {
    (async () => {
      const [setupRes, projRes] = await Promise.all([
        supabase.from("configuracoes" as any).select("valor").eq("chave", "setup_precificacao").maybeSingle(),
        supabase.from("configuracoes" as any).select("valor").eq("chave", "projetistas").maybeSingle(),
      ]);
      if (setupRes.data) {
        const val = (setupRes.data as any).valor;
        setFatorAjuste(val?.fator_ajuste ?? 100);
        setCapexLastMile(val?.capex_last_mile ?? 750);
        setRegraProjetista(val?.regra_projetista_ativa ?? false);
      }
      if (projRes.data) {
        const val = (projRes.data as any).valor;
        if (Array.isArray(val)) setProjetistaOptions(val);
      }
      setLoading(false);
    })();
  }, []);

  const addProjetista = async () => {
    const name = newProjetista.trim();
    if (!name || projetistaOptions.includes(name)) return;
    const updated = [...projetistaOptions, name].sort();
    const { error } = await supabase.from("configuracoes" as any).upsert({ chave: "projetistas", valor: updated } as any, { onConflict: "chave" });
    if (!error) { setProjetistaOptions(updated); setNewProjetista(""); }
  };

  const removeProjetista = async (name: string) => {
    const updated = projetistaOptions.filter(p => p !== name);
    await supabase.from("configuracoes" as any).upsert({ chave: "projetistas", valor: updated } as any, { onConflict: "chave" });
    setProjetistaOptions(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("configuracoes" as any)
        .update({
          valor: { 
            fator_ajuste: fatorAjuste, 
            capex_last_mile: capexLastMile,
            regra_projetista_ativa: regraProjetista 
          },
          updated_at: new Date().toISOString(),
        } as any)
        .eq("chave", "setup_precificacao");
      if (error) throw error;
      toast({ title: "Setup salvo com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div>
          <h3 className="text-base font-semibold mb-1">Configurações de Cálculo</h3>
          <p className="text-xs text-muted-foreground">Ajustes aplicados ao valor mínimo calculado pela engine de precificação.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fator-ajuste" className="text-sm font-medium">
            Fator de ajuste de erro (%)
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="fator-ajuste"
              type="number"
              min={0}
              step={1}
              className="w-32"
              value={fatorAjuste}
              onChange={e => {
                const v = Math.max(0, Number(e.target.value) || 0);
                setFatorAjuste(v);
              }}
            />
            <span className="text-xs text-muted-foreground">
              {fatorAjuste === 100
                ? "Sem ajuste"
                : fatorAjuste > 100
                ? `+${fatorAjuste - 100}% de incremento`
                : `${fatorAjuste - 100}% de decremento`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            100% = valor original. 110% = +10% sobre o mínimo. 90% = -10% sobre o mínimo.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="capex-last-mile" className="text-sm font-medium">
            Capex Last Mile (R$)
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="capex-last-mile"
              type="number"
              min={0}
              step={0.01}
              className="w-32"
              value={capexLastMile}
              onChange={e => {
                const v = Math.max(0, Number(e.target.value) || 0);
                setCapexLastMile(v);
              }}
            />
            <span className="text-xs text-muted-foreground">
              Valor base aplicado quando a tecnologia for LAST MILE
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-md border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="regra-projetista" className="text-sm font-medium">Regra do Projetista</Label>
            <p className="text-xs text-muted-foreground">
              Quando ativa, exige validação para links com banda &gt; 500 MB, distância &gt; 2000m ou tecnologia PTP.
            </p>
          </div>
          <Switch
            id="regra-projetista"
            checked={regraProjetista}
            onCheckedChange={setRegraProjetista}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm">
          <Save className="h-4 w-4 mr-1" /> Salvar Setup
        </Button>
      </div>

      {/* Gerenciar Projetistas */}
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div>
          <h3 className="text-base font-semibold mb-1">Gerenciar Projetistas</h3>
          <p className="text-xs text-muted-foreground">Adicione ou remova opções de projetistas disponíveis no formulário de pré viabilidade.</p>
        </div>
        <div className="flex gap-2">
          <Input className="h-9" placeholder="Nome do projetista" value={newProjetista}
            onChange={e => setNewProjetista(e.target.value)}
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addProjetista())} />
          <Button type="button" size="sm" className="gap-1 h-9" onClick={addProjetista}>
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {projetistaOptions.map(p => (
            <Badge key={p} variant="secondary" className="gap-1 text-xs">
              {p}
              <button type="button" onClick={() => removeProjetista(p)} className="ml-0.5 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {projetistaOptions.length === 0 && <span className="text-xs text-muted-foreground">Nenhum projetista cadastrado</span>}
        </div>
      </div>
    </div>
  );
}
