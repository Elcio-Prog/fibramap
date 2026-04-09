import React, { useState, useMemo, useRef } from "react";
import { Check, ChevronsUpDown, ScrollText, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { PreViabilidade } from "@/hooks/usePreViabilidades";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PreViabilidade[];
}

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return "R$ 0,00";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

export default function RoiGlobalReportDialog({ open, onOpenChange, data }: Props) {
  const [openCombobox, setOpenCombobox] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();
  const reportRef = React.useRef<HTMLDivElement>(null);

  const guardachuvaIds = useMemo(() => {
    const ids = new Set<string>();
    data.forEach((item) => {
      if (item.id_guardachuva && item.id_guardachuva.trim() !== "") {
        ids.add(item.id_guardachuva.trim());
      }
    });
    return Array.from(ids).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    if (!selectedId) return [];
    return data.filter(
      (item) => item.id_guardachuva?.toLowerCase() === selectedId.toLowerCase()
    );
  }, [data, selectedId]);

  const totals = useMemo(() => {
    return filteredData.reduce(
      (acc, item) => {
        const dp = item.dados_precificacao || {};
        acc.capex += dp.valorCapex || 0;
        acc.valorLm += dp.media_mensalidade_lm || 0;
        acc.ticketMensal += item.ticket_mensal || 0;
        acc.taxaInstalacao += dp.taxaInstalacao || 0;
        return acc;
      },
      { capex: 0, valorLm: 0, ticketMensal: 0, taxaInstalacao: 0 }
    );
  }, [filteredData]);

  const getBandaModelo = (item: PreViabilidade) => {
    const p = item.produto_nt || (item.dados_precificacao && item.dados_precificacao.produto);
    const dp = item.dados_precificacao || {};
    if (p === "Conectividade") return dp.banda ? `${dp.banda} MB` : "-";
    if (p === "Firewall") return dp.modeloFirewall || "-";
    if (p === "Switch") return dp.modeloSwitch || "-";
    if (p === "Wifi") return dp.modeloWifi || "-";
    if (p === "VOZ") return dp.equipamentoVoz1 || "-";
    if (p === "Backup") return dp.qtdBackupTB ? `${dp.qtdBackupTB} TB` : "-";
    return "-";
  };

  const getQuantidade = (item: PreViabilidade) => {
    const p = item.produto_nt || (item.dados_precificacao && item.dados_precificacao.produto);
    const dp = item.dados_precificacao || {};
    if (p === "Conectividade") return "-";
    if (p === "VOZ") return dp.qtdEquipamentoVoz1 || "-";
    return dp.qtdEquipamentos || "-";
  };

  const handleExportExcel = () => {
    if (filteredData.length === 0) return;

    try {
      setIsExporting(true);

      const excelData = filteredData.map(item => {
        const dp = item.dados_precificacao || {};
        return {
          "Id": item.id.slice(0, 8) + "...",
          "Produto": item.produto_nt || dp.produto || "-",
          "Banda/Modelo": getBandaModelo(item),
          "Qtde": getQuantidade(item),
          "Capex": dp.valorCapex || 0,
          "Valor LM": dp.media_mensalidade_lm || 0,
          "Valor Mensal (Ticket)": item.ticket_mensal || 0,
          "Finder": "-",
          "Taxa Instalação": dp.taxaInstalacao || 0,
          "Camp. Com.": dp.campanha_comercial_meses || 0,
          "ROI Global": item.roi_global ? (item.roi_global * 100).toFixed(2) + "%" : "-"
        };
      });

      excelData.push({
        "Id": "Totais Gerais:",
        "Produto": "",
        "Banda/Modelo": "",
        "Qtde": "",
        "Capex": totals.capex,
        "Valor LM": totals.valorLm,
        "Valor Mensal (Ticket)": totals.ticketMensal,
        "Finder": "",
        "Taxa Instalação": totals.taxaInstalacao,
        "Camp. Com.": "",
        "ROI Global": ""
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório ROI");
      XLSX.writeFile(workbook, `relatorio-roi-global-${selectedId}.xlsx`);
      
      toast({
        title: "Sucesso",
        description: "Relatório exportado com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
      toast({
        title: "Erro",
        description: "Não foi possível exportar o relatório.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            Relatório de ROI Global
          </DialogTitle>
          <DialogDescription>
            Selecione ou digite um Id Guarda Chuva para agrupar e visualizar o relatório unificado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="flex-col flex gap-1.5 w-[350px]">
              <label className="text-sm font-medium">Buscar por ID Guarda Chuva</label>
              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openCombobox}
                    className="w-full justify-between"
                  >
                    {selectedId || "Selecione ou digite um ID..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar ou digitar ID..." />
                    <CommandList>
                      <CommandEmpty>Nenhum Id Guarda Chuva encontrado.</CommandEmpty>
                      <CommandGroup>
                        {guardachuvaIds.map((id) => (
                          <CommandItem
                            key={id}
                            value={id}
                            onSelect={(currentValue) => {
                              setSelectedId(currentValue === selectedId ? "" : currentValue);
                              setOpenCombobox(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedId === id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {id}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {filteredData.length > 0 ? (
            <div className="rounded-md border flex-1 overflow-auto bg-white px-4 pb-4" ref={reportRef}>
              <div className="mb-4 pt-4">
                <h2 className="text-lg font-bold">Relatório Consolidado - ID: {selectedId}</h2>
                <p className="text-sm text-muted-foreground">Data de geração: {new Date().toLocaleDateString("pt-BR")}</p>
              </div>
              <Table>
                <TableHeader className="bg-muted break-normal sticky top-0 z-10 shadow-sm">
                  <TableRow className="h-14">
                    <TableHead className="whitespace-nowrap">Id</TableHead>
                    <TableHead className="whitespace-nowrap">Produto</TableHead>
                    <TableHead className="whitespace-nowrap">Banda/Modelo</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Qtde</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Capex</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Valor LM</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Valor Mensal (Ticket)</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Finder</TableHead>
                    <TableHead className="whitespace-nowrap text-right">Taxa Instalação</TableHead>
                    <TableHead className="whitespace-nowrap text-center">Camp. Com.</TableHead>
                    <TableHead className="whitespace-nowrap text-center">ROI Global</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => {
                    const dp = item.dados_precificacao || {};
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.id.slice(0, 8)}...</TableCell>
                        <TableCell>{item.produto_nt || dp.produto || "-"}</TableCell>
                        <TableCell>{getBandaModelo(item)}</TableCell>
                        <TableCell className="text-center">{getQuantidade(item)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(dp.valorCapex)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(dp.media_mensalidade_lm)}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.ticket_mensal)}</TableCell>
                        <TableCell className="text-center">-</TableCell>
                        <TableCell className="text-right">{formatCurrency(dp.taxaInstalacao)}</TableCell>
                        <TableCell className="text-center">
                          {dp.campanha_comercial_meses || 0}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.roi_global ? (
                            <span
                              className={cn(
                                "font-semibold",
                                item.roi_global > 0 ? "text-green-600" : "text-destructive"
                              )}
                            >
                              {item.roi_global.toLocaleString("pt-BR", {
                                style: "percent",
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter className="bg-muted/50 font-bold">
                  <TableRow>
                    <TableCell colSpan={4} className="text-right">
                      Totais Gerais:
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.capex)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.valorLm)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.ticketMensal)}</TableCell>
                    <TableCell colSpan={1}></TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.taxaInstalacao)}</TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          ) : (
            <div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed text-muted-foreground p-8">
              {selectedId ? (
                <span>Nenhum registro encontrado para o Id Guarda Chuva "{selectedId}"</span>
              ) : (
                <span>Selecione um Id Guarda Chuva acima para exibir o relatório</span>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4 gap-2">
          {filteredData.length > 0 && (
            <Button 
              onClick={handleExportExcel} 
              disabled={isExporting}
              className="gap-2"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isExporting ? "Exportando..." : "Exportar Excel"}
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
