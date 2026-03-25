import { useState } from "react";
import { useConfig, FieldMappingEntry } from "@/hooks/useConfig";
import { useBulkExport } from "@/hooks/useBulkExport";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Save, TestTube, Eye, EyeOff, RotateCcw } from "lucide-react";
import IntegracoesTab from "@/components/admin/IntegracoesTab";

const DEFAULT_MAPPING: FieldMappingEntry[] = [
  { colunaApp: "Designação", campoJson: "protocolo", tipo: "string" },
  { colunaApp: "Cliente", campoJson: "nomeCliente", tipo: "string" },
  { colunaApp: "CNPJ", campoJson: "cnpj", tipo: "string" },
  { colunaApp: "Endereço", campoJson: "endereco", tipo: "string" },
  { colunaApp: "Cidade", campoJson: "cidade", tipo: "string" },
  { colunaApp: "Geo", campoJson: "coordenadas", tipo: "string" },
  { colunaApp: "Viável", campoJson: "status", tipo: "string" },
  { colunaApp: "Melhor Etapa", campoJson: "melhorEtapa", tipo: "string" },
  { colunaApp: "Provedor", campoJson: "provedor", tipo: "string" },
  { colunaApp: "Produto", campoJson: "produto", tipo: "string" },
  { colunaApp: "Tecnologia", campoJson: "tecnologia", tipo: "string" },
  { colunaApp: "Tecnologia (Meio Físico)", campoJson: "tecnologiaMeioFisico", tipo: "string" },
  { colunaApp: "Coordenadas", campoJson: "coordenadasCompletas", tipo: "string" },
  { colunaApp: "Vel.", campoJson: "velocidade", tipo: "string" },
  { colunaApp: "Distância", campoJson: "distancia", tipo: "number" },
  { colunaApp: "Vigência", campoJson: "vigencia", tipo: "string" },
  { colunaApp: "Taxa Inst.", campoJson: "taxaInstalacao", tipo: "number" },
  { colunaApp: "Vlr Venda", campoJson: "valorVendido", tipo: "number" },
  { colunaApp: "Bloco IP", campoJson: "blocoIp", tipo: "string" },
  { colunaApp: "Tipo Sol.", campoJson: "tipoSolicitacao", tipo: "string" },
  { colunaApp: "Cód. Smark", campoJson: "codigoSmark", tipo: "string" },
  { colunaApp: "Obs. Usuário", campoJson: "observacoes", tipo: "string" },
  { colunaApp: "Obs. Sistema", campoJson: "observacoesSistema", tipo: "string" },
];

export default function SettingsPage() {
  const { webhook, fieldMapping, saveConfig, isLoading } = useConfig();
  const { testWebhook } = useBulkExport();
  const { toast } = useToast();

  // Webhook tab state
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [testing, setTesting] = useState(false);
  const [webhookLoaded, setWebhookLoaded] = useState(false);

  // Mapping tab state
  const [mappingJson, setMappingJson] = useState("");
  const [jsonValid, setJsonValid] = useState(true);
  const [jsonError, setJsonError] = useState("");
  const [savingMapping, setSavingMapping] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [mappingLoaded, setMappingLoaded] = useState(false);

  // Load initial values when config loads
  if (!isLoading && !webhookLoaded) {
    setUrl(webhook.url || "");
    setToken(webhook.token || "");
    setWebhookLoaded(true);
  }
  if (!isLoading && !mappingLoaded) {
    setMappingJson(JSON.stringify(fieldMapping.length > 0 ? fieldMapping : DEFAULT_MAPPING, null, 2));
    setMappingLoaded(true);
  }

  const handleSaveWebhook = async () => {
    setSavingWebhook(true);
    try {
      await saveConfig.mutateAsync({ chave: "webhook", valor: { url: url.trim(), token: token.trim() } });
      toast({ title: "Configurações de Webhook salvas!" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleTestWebhook = async () => {
    setTesting(true);
    const result = await testWebhook();
    setTesting(false);
    if (result.ok) {
      toast({ title: `Webhook respondeu com sucesso (${result.code})` });
    } else {
      toast({ title: "Falha no teste", description: result.error || `HTTP ${result.code}`, variant: "destructive" });
    }
  };

  const validateMapping = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) { setJsonError("Deve ser um array"); return false; }
      for (let i = 0; i < parsed.length; i++) {
        const item = parsed[i];
        if (!item.colunaApp || !item.campoJson || !item.tipo) {
          setJsonError(`Item ${i + 1}: campos obrigatórios: colunaApp, campoJson, tipo`);
          return false;
        }
        if (item.tipo !== "string" && item.tipo !== "number") {
          setJsonError(`Item ${i + 1}: tipo deve ser "string" ou "number"`);
          return false;
        }
      }
      setJsonError("");
      return true;
    } catch (e: any) {
      setJsonError(e.message);
      return false;
    }
  };

  const handleMappingChange = (value: string) => {
    setMappingJson(value);
    setJsonValid(validateMapping(value));
  };

  const handleSaveMapping = async () => {
    if (!jsonValid) return;
    setSavingMapping(true);
    try {
      const parsed = JSON.parse(mappingJson);
      await saveConfig.mutateAsync({ chave: "field_mapping", valor: parsed });
      toast({ title: "Mapeamento salvo!" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSavingMapping(false);
    }
  };

  const handleRestore = async () => {
    setRestoreOpen(false);
    const json = JSON.stringify(DEFAULT_MAPPING, null, 2);
    setMappingJson(json);
    setJsonValid(true);
    setJsonError("");
    setSavingMapping(true);
    try {
      await saveConfig.mutateAsync({ chave: "field_mapping", valor: DEFAULT_MAPPING });
      toast({ title: "Mapeamento restaurado ao padrão!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSavingMapping(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Tabs defaultValue="webhook">
        <TabsList>
          <TabsTrigger value="webhook">Webhook</TabsTrigger>
          <TabsTrigger value="mapping">Mapeamento de Campos</TabsTrigger>
        </TabsList>

        <TabsContent value="webhook" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuração do Webhook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL do Webhook</Label>
                <Input
                  type="url"
                  placeholder="https://prod-xx.westus.logic.azure.com/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Token de Autenticação (opcional)</Label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder="Bearer token..."
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="gap-2" onClick={handleSaveWebhook} disabled={savingWebhook}>
                  {savingWebhook ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Configurações
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleTestWebhook} disabled={testing || !url.trim()}>
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                  Testar Webhook
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mapping" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Mapeamento de Campos
                {jsonValid ? (
                  <Badge className="bg-primary/10 text-primary border-primary/20">JSON válido</Badge>
                ) : (
                  <Badge variant="destructive">JSON inválido</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                className="font-mono text-xs min-h-[400px] resize-y"
                value={mappingJson}
                onChange={(e) => handleMappingChange(e.target.value)}
                spellCheck={false}
              />
              {jsonError && (
                <p className="text-xs text-destructive">{jsonError}</p>
              )}
              <div className="flex gap-2">
                <Button className="gap-2" onClick={handleSaveMapping} disabled={!jsonValid || savingMapping}>
                  {savingMapping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Mapeamento
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => setRestoreOpen(true)}>
                  <RotateCcw className="h-4 w-4" /> Restaurar Padrão
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar Mapeamento Padrão</DialogTitle>
            <DialogDescription>
              Isso substituirá o mapeamento atual pelo padrão original. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreOpen(false)}>Cancelar</Button>
            <Button onClick={handleRestore}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
