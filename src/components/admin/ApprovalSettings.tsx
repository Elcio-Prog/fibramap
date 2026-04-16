import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, Plus, Trash2, ShieldCheck, Info } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type ApprovalLevel = {
  level: number;
  label: string;
  roi_increment: number; // 0 for Sistema (base from vigencia_vs_roi), +N for others
  responsible_email: string;
};

type ApprovalConfig = {
  levels: ApprovalLevel[];
};

type GlobalRules = {
  capex_limit: number;
  monthly_ticket_limit: number;
};

type VigenciaRoi = {
  meses: string;
  roi: number;
};

// ── Defaults ───────────────────────────────────────────────────────────────────

const DEFAULT_STANDARD: ApprovalConfig = {
  levels: [
    { level: 0, label: "Sistema", roi_increment: 0, responsible_email: "" },
    { level: 1, label: "Nível 1", roi_increment: 1, responsible_email: "" },
    { level: 2, label: "Nível 2", roi_increment: 2, responsible_email: "" },
  ],
};

const DEFAULT_EQUIPMENT: ApprovalConfig = {
  levels: [
    { level: 0, label: "Sistema", roi_increment: 0, responsible_email: "" },
    { level: 1, label: "Nível 1", roi_increment: 1, responsible_email: "" },
  ],
};

const DEFAULT_GLOBAL: GlobalRules = {
  capex_limit: 30000,
  monthly_ticket_limit: 5000,
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const isValidEmail = (email: string) =>
  !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const formatCurrency = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ── Sub: Level Table ───────────────────────────────────────────────────────────

function LevelTable({
  config,
  onChange,
}: {
  config: ApprovalConfig;
  onChange: (c: ApprovalConfig) => void;
}) {
  const { levels } = config;

  const updateLevel = (idx: number, patch: Partial<ApprovalLevel>) => {
    const next = levels.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    onChange({ ...config, levels: next });
  };

  const addLevel = () => {
    const maxLevel = Math.max(...levels.map((l) => l.level));
    const newLevel: ApprovalLevel = {
      level: maxLevel + 1,
      label: `Nível ${maxLevel + 1}`,
      roi_increment: maxLevel + 1,
      responsible_email: "",
    };
    onChange({ ...config, levels: [...levels, newLevel] });
  };

  const removeLevel = (idx: number) => {
    if (levels[idx].level === 0) return;
    onChange({ ...config, levels: levels.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">Nível</TableHead>
              <TableHead className="w-[220px]">Incremento ROI</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {levels.filter((l) => l.level > 0).map((lvl, idx) => {
              const realIdx = levels.findIndex((l) => l.level === lvl.level);
              return (
                <TableRow key={lvl.level}>
                  <TableCell className="font-medium">{lvl.label}</TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground font-medium">+</span>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        className="w-20"
                        value={lvl.roi_increment ?? ""}
                        onChange={(e) =>
                          updateLevel(realIdx, {
                            roi_increment: parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </TableCell>

                  <TableCell>
                    <Input
                      type="email"
                      placeholder="email@empresa.com.br"
                      className={`max-w-xs ${
                        lvl.responsible_email && !isValidEmail(lvl.responsible_email)
                          ? "border-destructive"
                          : ""
                      }`}
                      value={lvl.responsible_email}
                      onChange={(e) =>
                        updateLevel(realIdx, { responsible_email: e.target.value })
                      }
                    />
                  </TableCell>

                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeLevel(realIdx)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Button variant="outline" size="sm" className="gap-1" onClick={addLevel}>
        <Plus className="h-4 w-4" /> Adicionar Nível
      </Button>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ApprovalSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [standard, setStandard] = useState<ApprovalConfig>(DEFAULT_STANDARD);
  const [equipment, setEquipment] = useState<ApprovalConfig>(DEFAULT_EQUIPMENT);
  const [globalRules, setGlobalRules] = useState<GlobalRules>(DEFAULT_GLOBAL);

  const [roiStandard, setRoiStandard] = useState<VigenciaRoi[]>([]);
  const [roiEquipment, setRoiEquipment] = useState<VigenciaRoi[]>([]);

  // ── Load ────────────────────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, roiRes] = await Promise.all([
        supabase
          .from("configuracoes")
          .select("chave, valor")
          .in("chave", [
            "approval_config_standard",
            "approval_config_equipment",
            "approval_global_rules",
          ]),
        supabase.from("vigencia_vs_roi").select("meses, roi").order("meses"),
      ]);

      if (configRes.error) throw configRes.error;
      if (roiRes.error) throw roiRes.error;

      // Split vigencia_vs_roi into standard vs equipment
      const stdRoi: VigenciaRoi[] = [];
      const eqRoi: VigenciaRoi[] = [];
      for (const r of roiRes.data || []) {
        const m = String(r.meses).trim();
        if (m.toLowerCase().includes("equipamento")) {
          eqRoi.push({ meses: m.replace(/\s*equipamento\s*/i, "").trim(), roi: Number(r.roi) });
        } else {
          stdRoi.push({ meses: m, roi: Number(r.roi) });
        }
      }
      setRoiStandard(stdRoi);
      setRoiEquipment(eqRoi);

      for (const row of configRes.data || []) {
        const val = row.valor as any;
        if (row.chave === "approval_config_standard" && val?.levels) setStandard(val);
        if (row.chave === "approval_config_equipment" && val?.levels) setEquipment(val);
        if (row.chave === "approval_global_rules" && val?.capex_limit != null)
          setGlobalRules(val);
      }
    } catch (e: any) {
      toast({
        title: "Erro ao carregar configurações de aprovação",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const allLevels = [...standard.levels, ...equipment.levels];
    const invalidEmail = allLevels.find(
      (l) => l.level > 0 && l.responsible_email && !isValidEmail(l.responsible_email)
    );
    if (invalidEmail) {
      toast({
        title: "E-mail inválido",
        description: `Verifique o e-mail do ${invalidEmail.label}`,
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const upsert = async (chave: string, valor: any) => {
        const { data: existing } = await supabase
          .from("configuracoes")
          .select("id")
          .eq("chave", chave)
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("configuracoes")
            .update({ valor, updated_at: new Date().toISOString() })
            .eq("chave", chave);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("configuracoes")
            .insert({ chave, valor });
          if (error) throw error;
        }
      };

      await Promise.all([
        upsert("approval_config_standard", standard),
        upsert("approval_config_equipment", equipment),
        upsert("approval_global_rules", globalRules),
      ]);

      toast({ title: "Configurações de aprovação salvas!" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bloco 1 — Padrão */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Níveis de Aprovação — Serviços Gerais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LevelTable
            config={standard}
            onChange={setStandard}
            roiReference={roiStandard}
            refTitle="Serviços Gerais"
          />
        </CardContent>
      </Card>

      {/* Bloco 2 — Equipamentos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Níveis de Aprovação — Equipamentos
            <Badge className="bg-primary/10 text-primary border-primary/20 ml-1">Firewall</Badge>
            <Badge className="bg-primary/10 text-primary border-primary/20">Wi-Fi</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LevelTable
            config={equipment}
            onChange={setEquipment}
            roiReference={roiEquipment}
            refTitle="Equipamentos"
          />
        </CardContent>
      </Card>

      {/* Bloco 3 — Regras Globais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Regras Globais de Exceção
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Limite de CAPEX</Label>
            <Input
              type="number"
              step="1000"
              className="w-48"
              value={globalRules.capex_limit}
              onChange={(e) =>
                setGlobalRules({ ...globalRules, capex_limit: parseFloat(e.target.value) || 0 })
              }
            />
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              Vendas com CAPEX acima de {formatCurrency(globalRules.capex_limit)} sempre
              requerem aprovação Nível 5.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Limite de Ticket Mensal</Label>
            <Input
              type="number"
              step="500"
              className="w-48"
              value={globalRules.monthly_ticket_limit}
              onChange={(e) =>
                setGlobalRules({
                  ...globalRules,
                  monthly_ticket_limit: parseFloat(e.target.value) || 0,
                })
              }
            />
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              Contratos novos ou vendas na base com Ticket Mensal igual ou acima de{" "}
              {formatCurrency(globalRules.monthly_ticket_limit)} sempre requerem aprovação
              Nível 5.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button className="gap-2" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Configurações de Aprovação
        </Button>
      </div>
    </div>
  );
}
