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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Plus, Trash2, ShieldCheck, Info } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type ApprovalLevel = {
  level: number;
  label: string;
  roi_increment: number;
  value_limit: number; // <= threshold for this level
  responsible_email: string;
};

type ApprovalCriteria = "roi" | "valor";

type ApprovalConfig = {
  levels: ApprovalLevel[];
  criteria: ApprovalCriteria;
};

type GlobalRules = {
  capex_limit: number;
  monthly_ticket_limit: number;
};


// ── Defaults ───────────────────────────────────────────────────────────────────

// Reservado: nível "Diretoria" é sempre o último e não pode ser removido.
const DIRETORIA_LEVEL = 999;
const DIRETORIA_LABEL = "Diretoria";

const makeDiretoria = (email = ""): ApprovalLevel => ({
  level: DIRETORIA_LEVEL,
  label: DIRETORIA_LABEL,
  roi_increment: 0,
  value_limit: 0,
  responsible_email: email,
});

const DEFAULT_STANDARD: ApprovalConfig = {
  criteria: "roi",
  levels: [
    { level: 0, label: "Sistema", roi_increment: 0, value_limit: 0, responsible_email: "" },
    { level: 1, label: "Nível 1", roi_increment: 1, value_limit: 5000, responsible_email: "" },
    { level: 2, label: "Nível 2", roi_increment: 2, value_limit: 10000, responsible_email: "" },
    makeDiretoria(),
  ],
};

const DEFAULT_EQUIPMENT: ApprovalConfig = {
  criteria: "roi",
  levels: [
    { level: 0, label: "Sistema", roi_increment: 0, value_limit: 0, responsible_email: "" },
    { level: 1, label: "Nível 1", roi_increment: 1, value_limit: 5000, responsible_email: "" },
    makeDiretoria(),
  ],
};

const DEFAULT_GLOBAL: GlobalRules = {
  capex_limit: 30000,
  monthly_ticket_limit: 5000,
};

/** Garante que o nível Diretoria exista e seja o ÚLTIMO da lista. Preserva email se já existir. */
const ensureDiretoria = (config: ApprovalConfig): ApprovalConfig => {
  const existing = config.levels.find(
    (l) => l.level === DIRETORIA_LEVEL || l.label?.toLowerCase() === DIRETORIA_LABEL.toLowerCase()
  );
  const others = config.levels.filter(
    (l) => l.level !== DIRETORIA_LEVEL && l.label?.toLowerCase() !== DIRETORIA_LABEL.toLowerCase()
  );
  const diretoria: ApprovalLevel = existing
    ? { ...existing, level: DIRETORIA_LEVEL, label: DIRETORIA_LABEL }
    : makeDiretoria();
  return { ...config, levels: [...others, diretoria] };
};

const getDiretoriaEmail = (config: ApprovalConfig): string =>
  config.levels.find((l) => l.level === DIRETORIA_LEVEL)?.responsible_email ?? "";

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
    const manual = levels.filter((l) => l.level > 0 && l.level !== DIRETORIA_LEVEL);
    const maxLevel = manual.length > 0 ? Math.max(...manual.map((l) => l.level)) : 0;
    const newLevel: ApprovalLevel = {
      level: maxLevel + 1,
      label: `Nível ${maxLevel + 1}`,
      roi_increment: maxLevel + 1,
      value_limit: 0,
      responsible_email: "",
    };
    // Insere ANTES do Diretoria (que deve permanecer como último)
    const others = levels.filter((l) => l.level !== DIRETORIA_LEVEL);
    const diretoria = levels.find((l) => l.level === DIRETORIA_LEVEL);
    onChange({
      ...config,
      levels: diretoria ? [...others, newLevel, diretoria] : [...others, newLevel],
    });
  };

  const removeLevel = (idx: number) => {
    if (levels[idx].level === 0 || levels[idx].level === DIRETORIA_LEVEL) return;
    onChange({ ...config, levels: levels.filter((_, i) => i !== idx) });
  };

  const criteriaLabel = config.criteria === "valor" ? "Valor" : "ROI";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <Label className="text-sm text-muted-foreground whitespace-nowrap">Fator da Regra:</Label>
        <Select
          value={config.criteria}
          onValueChange={(v: ApprovalCriteria) => onChange({ ...config, criteria: v })}
        >
          <SelectTrigger className="w-[140px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="roi">ROI</SelectItem>
            <SelectItem value="valor">Valor</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Nível</TableHead>
              <TableHead className="w-[180px]">Incremento {criteriaLabel}</TableHead>
              <TableHead className="w-[180px]">Valor (≤)</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {levels.filter((l) => l.level > 0).map((lvl) => {
              const realIdx = levels.findIndex((l) => l.level === lvl.level);
              const isDiretoria = lvl.level === DIRETORIA_LEVEL;
              return (
                <TableRow key={lvl.level} className={isDiretoria ? "bg-muted/40" : undefined}>
                  <TableCell className="font-medium">
                    {isDiretoria ? (
                      <Badge className="bg-primary/10 text-primary border-primary/20">{lvl.label}</Badge>
                    ) : (
                      lvl.label
                    )}
                  </TableCell>

                  <TableCell>
                    {isDiretoria ? (
                      <span className="text-xs text-muted-foreground italic">Fallback final</span>
                    ) : (
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
                    )}
                  </TableCell>

                  <TableCell>
                    {isDiretoria ? (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground font-medium">≤</span>
                        <Input
                          type="number"
                          step="1000"
                          min="0"
                          className="w-28"
                          value={lvl.value_limit ?? ""}
                          onChange={(e) =>
                            updateLevel(realIdx, {
                              value_limit: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1.5 max-w-xs">
                      {(lvl.responsible_email || "").split(",").map((email, emailIdx, arr) => (
                        <div key={emailIdx} className="flex items-center gap-1">
                          <Input
                            type="email"
                            placeholder="email@empresa.com.br"
                            className={`flex-1 ${
                              email.trim() && !isValidEmail(email.trim())
                                ? "border-destructive"
                                : ""
                            }`}
                            value={email.trim()}
                            onChange={(e) => {
                              const emails = (lvl.responsible_email || "").split(",").map((em) => em.trim());
                              emails[emailIdx] = e.target.value;
                              updateLevel(realIdx, { responsible_email: emails.join(",") });
                            }}
                          />
                          {arr.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => {
                                const emails = (lvl.responsible_email || "").split(",").map((em) => em.trim()).filter((_, i) => i !== emailIdx);
                                updateLevel(realIdx, { responsible_email: emails.join(",") });
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground gap-1 px-1"
                        onClick={() => {
                          const current = lvl.responsible_email || "";
                          updateLevel(realIdx, { responsible_email: current ? current + "," : "" });
                        }}
                      >
                        <Plus className="h-3 w-3" /> Adicionar e-mail
                      </Button>
                    </div>
                  </TableCell>

                  <TableCell>
                    {!isDiretoria && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLevel(realIdx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
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

  // ── Load ────────────────────────────────────────────────────────────────────
  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("chave, valor")
        .in("chave", [
          "approval_config_standard",
          "approval_config_equipment",
          "approval_global_rules",
        ]);

      if (error) throw error;

      for (const row of data || []) {
        const val = row.valor as any;
        if (row.chave === "approval_config_standard" && val?.levels) setStandard(ensureDiretoria(val));
        if (row.chave === "approval_config_equipment" && val?.levels) setEquipment(ensureDiretoria(val));
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
            onChange={(c) => setStandard(ensureDiretoria(c))}
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
            <Badge className="bg-primary/10 text-primary border-primary/20">Switch</Badge>
            <Badge className="bg-primary/10 text-primary border-primary/20">Backup</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LevelTable
            config={equipment}
            onChange={(c) => setEquipment(ensureDiretoria(c))}
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
          {/* Email Diretoria — fonte única (puxado dos níveis configurados) */}
          <div className="rounded-md border bg-muted/30 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20">Diretoria</Badge>
              <span className="text-xs text-muted-foreground">
                Responsável final — usado em todas as regras globais de exceção
              </span>
            </div>
            <div className="text-sm font-medium">
              {getDiretoriaEmail(standard) || getDiretoriaEmail(equipment) || (
                <span className="italic text-destructive">
                  Nenhum email configurado para Diretoria. Defina-o nas tabelas acima.
                </span>
              )}
            </div>
          </div>

          <Separator />

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
              requerem aprovação da <strong className="text-foreground">Diretoria</strong>.
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
              {formatCurrency(globalRules.monthly_ticket_limit)} sempre requerem aprovação da{" "}
              <strong className="text-foreground">Diretoria</strong>.
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
