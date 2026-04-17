import React, { useState, useMemo, useRef } from "react";
import { Check, ChevronsUpDown, ScrollText, Download, Loader2, CheckCircle2, XCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { PreViabilidade, getRoiIndicators } from "@/hooks/usePreViabilidades";
import SolicitarAprovacaoDialog from "@/components/pre-viabilidade/SolicitarAprovacaoDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
        acc.custosMateriais += dp.custosMateriaisAdicionais || 0;
        acc.valorLm += dp.media_mensalidade_lm || 0;
        acc.ticketMensal += item.ticket_mensal || 0;
        acc.taxaInstalacao += dp.taxaInstalacao || 0;
        acc.opex += dp.valorOpex || 0;
        acc.campanha += dp.campanha_comercial_meses || 0;
        acc.finder += (item.ticket_mensal || 0) * ((dp.usou_finder2 || 0) / 100);
        acc.valorMinimo += item.valor_minimo || 0;
        return acc;
      },
      {
        capex: 0,
        custosMateriais: 0,
        valorLm: 0,
        valorMinimo: 0,
        ticketMensal: 0,
        taxaInstalacao: 0,
        opex: 0,
        campanha: 0,
        finder: 0
      }
    );
  }, [filteredData]);

  const despesasFixas = (totals.capex + totals.custosMateriais + totals.finder + totals.campanha) - totals.taxaInstalacao;
  const receitasMensais = totals.ticketMensal - totals.opex - totals.valorLm;
  const roiGlobalFinal = receitasMensais > 0 ? despesasFixas / receitasMensais : 0;

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
          "Lançamento custos de materiais e mão de Obra": dp.custosMateriaisAdicionais || 0,
          "Valor LM": dp.media_mensalidade_lm || 0,
          "Valor Minimo do Sistema": item.valor_minimo || 0,
          "Valor Mensal (Ticket)": (item.valor_minimo || 0) > (item.ticket_mensal || 0)
            ? `🔴 ${formatCurrency(item.ticket_mensal)}`
            : `🟢 ${formatCurrency(item.ticket_mensal)}`,
          "Finder": formatCurrency((item.ticket_mensal || 0) * ((dp.usou_finder2 || 0) / 100)),
          "Taxa Instalação": dp.taxaInstalacao || 0,
          "Camp. Com.": formatCurrency(dp.campanha_comercial_meses || 0),
          "Regra % LM": item.ticket_mensal ? ((dp.media_mensalidade_lm || 0) / item.ticket_mensal * 100).toFixed(2) + "%" : "0%",
          "ROI Previsto": item.previsao_roi != null ? item.previsao_roi.toFixed(1) : "-",
          "ROI Global": item.roi_global ? item.roi_global.toFixed(2) : "-"
        };
      });

      excelData.push({
        "Id": "Totais Gerais:",
        "Produto": "",
        "Banda/Modelo": "",
        "Qtde": "",
        "Capex": totals.capex,
        "Lançamento custos de materiais e mão de Obra": totals.custosMateriais,
        "Valor LM": totals.valorLm,
        "Valor Minimo do Sistema": totals.valorMinimo,
        "Valor Mensal (Ticket)": totals.valorMinimo > totals.ticketMensal
          ? `🔴 ${formatCurrency(totals.ticketMensal)}`
          : `🟢 ${formatCurrency(totals.ticketMensal)}`,
        "Finder": String(totals.finder),
        "Taxa Instalação": totals.taxaInstalacao,
        "Camp. Com.": String(totals.campanha),
        "Regra % LM": "",
        "ROI Previsto": "",
        "ROI Global": ""
      } as typeof excelData[0]);

      // Add Summary section to Excel
      const emptyRow = {} as typeof excelData[0];
      excelData.push(emptyRow);
      excelData.push({ ...emptyRow, "Id": "RESUMO ROI GLOBAL" });
      excelData.push({
        ...emptyRow,
        "Id": "Despesas:",
        "Produto": `(${formatCurrency(totals.capex)} + ${formatCurrency(totals.custosMateriais)} + ${formatCurrency(totals.finder)} + ${formatCurrency(totals.campanha)}) - ${formatCurrency(totals.taxaInstalacao)}`,
        "Qtde": formatCurrency(despesasFixas)
      });
      excelData.push({
        ...emptyRow,
        "Id": "Receitas:",
        "Produto": `${formatCurrency(totals.ticketMensal)} - ${formatCurrency(totals.opex)} - ${formatCurrency(totals.valorLm)}`,
        "Qtde": formatCurrency(receitasMensais)
      });
      excelData.push({
        ...emptyRow,
        "Id": "ROI Global:",
        "Produto": `${formatCurrency(despesasFixas)} / ${formatCurrency(receitasMensais)}`,
        "Qtde": roiGlobalFinal.toFixed(2)
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

  const handleExportPdf = () => {
    if (filteredData.length === 0) return;

    try {
      setIsExporting(true);
      const doc = new jsPDF({ orientation: "landscape" });
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 14;
      const lineHeight = 8;
      const labelWidth = 55;

      const labels = [
        "Produto",
        "Banda/Modelo",
        "Qtde",
        "Capex",
        "Custos Mat/Mão de Obra",
        "Valor LM",
        "Valor Mínimo Sistema",
        "Ticket Mensal",
        "Finder",
        "Taxa Instalação",
        "Campanha Com.",
        "Regra % LM",
        "ROI Previsto",
        "ROI Global",
      ];

      const columnData = filteredData.map(item => {
        const dp = item.dados_precificacao || {};
        return [
          item.produto_nt || dp.produto || "-",
          getBandaModelo(item),
          String(getQuantidade(item)),
          formatCurrency(dp.valorCapex),
          formatCurrency(dp.custosMateriaisAdicionais),
          formatCurrency(dp.media_mensalidade_lm),
          formatCurrency(item.valor_minimo),
          formatCurrency(item.ticket_mensal),
          formatCurrency((item.ticket_mensal || 0) * ((dp.usou_finder2 || 0) / 100)),
          formatCurrency(dp.taxaInstalacao),
          formatCurrency(dp.campanha_comercial_meses || 0),
          item.ticket_mensal ? ((dp.media_mensalidade_lm || 0) / item.ticket_mensal * 100).toFixed(2) + "%" : "0%",
          item.previsao_roi != null ? item.previsao_roi.toFixed(1) : "-",
          item.roi_global ? item.roi_global.toFixed(2) : "-"
        ];
      });

      const numItems = columnData.length;
      // Define max cols per page dynamically (min 1, usually 4-5)
      const maxColsPerPage = Math.max(1, Math.floor((pageWidth - margin * 2 - labelWidth) / 45));
      const numPages = Math.ceil(numItems / maxColsPerPage);

      for (let p = 0; p < numPages; p++) {
        if (p > 0) doc.addPage();
        let y = 20;

        // Cabeçalho Tema Verde
        doc.setFillColor(22, 163, 74); // green-600
        doc.rect(0, 0, pageWidth, 30, 'F');

        doc.setFontSize(16);
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.text(`Relatório ROI Global - Comparativo - ID: ${selectedId}` + (numPages > 1 ? ` (Pág ${p + 1})` : ""), margin, 19);
        y = 40;

        doc.setFontSize(9);
        doc.setTextColor(30, 41, 59); // texto base escuro

        const startCol = p * maxColsPerPage;
        const endCol = Math.min((p + 1) * maxColsPerPage, numItems);
        const itemWidth = (pageWidth - margin * 2 - labelWidth) / maxColsPerPage;

        // Fundo para o título das colunas
        doc.setFillColor(240, 253, 244); // green-50
        doc.rect(margin, y - 6, pageWidth - margin * 2, 10, 'F');

        // Cabecalho das colunas (Itens)
        doc.setTextColor(22, 163, 74); // green-600
        doc.setFont("helvetica", "bold");
        doc.text("ATRIBUTO", margin + 3, y);
        for (let i = startCol; i < endCol; i++) {
          const x = margin + labelWidth + ((i - startCol) * itemWidth);
          const itemObj = filteredData[i];
          doc.text(`ITEM ${i + 1} (${itemObj.id.slice(0, 4)})`, x + 3, y);
        }
        y += 8;

        doc.setLineWidth(0.5);
        doc.setDrawColor(22, 163, 74); // linha inferior do cabeçalho mais espessa e verde
        doc.line(margin, y - 5, pageWidth - margin, y - 5);

        doc.setTextColor(30, 41, 59); // reseta cor do texto

        // Renderizar cada linha de atributo
        labels.forEach((label, rowIndex) => {
          // Linhas zebradas para facilitar a leitura
          if (rowIndex % 2 !== 0) {
            doc.setFillColor(248, 250, 252); // slate-50
            doc.rect(margin, y - 6, pageWidth - margin * 2, 8, 'F');
          }

          doc.setFont("helvetica", "bold");
          doc.text(label, margin + 3, y);
          doc.setFont("helvetica", "normal");

          for (let i = startCol; i < endCol; i++) {
            const x = margin + labelWidth + ((i - startCol) * itemWidth);
            let val = String(columnData[i][rowIndex]);

            // Truncate to fit column width
            if (val.length > 25) {
              val = val.substring(0, 23) + "...";
            }

            // Condicional Ticket Mensal (rowIndex 7 em labels => "Ticket Mensal")
            if (rowIndex === 7) {
              const itemObj = filteredData[i];
              if ((itemObj.valor_minimo || 0) > (itemObj.ticket_mensal || 0)) {
                doc.setTextColor(220, 38, 38); // red
                doc.setFont("helvetica", "bold");
              } else {
                doc.setTextColor(22, 163, 74); // green
                doc.setFont("helvetica", "bold");
              }
            } else {
              doc.setTextColor(30, 41, 59);
              doc.setFont("helvetica", "normal");
            }

            doc.text(val, x + 3, y);

            // Reverte cor base
            if (rowIndex === 7) {
              doc.setTextColor(30, 41, 59);
              doc.setFont("helvetica", "normal");
            }
          }
          y += lineHeight;

          doc.setLineWidth(0.1);
          doc.setDrawColor(226, 232, 240); // slate-200
          doc.line(margin, y - 6, pageWidth - margin, y - 6);
        });

        // Na ultima página, exibir o resumo geral
        if (p === numPages - 1) {
          y += 5;
          if (y + 115 > pageHeight - 10) {
            doc.addPage();
            // Refaz o topo da página no resumo em quebra de página
            doc.setFillColor(22, 163, 74); // green-600
            doc.rect(0, 0, pageWidth, 30, 'F');
            doc.setFontSize(16);
            doc.setTextColor(255, 255, 255);
            doc.setFont("helvetica", "bold");
            doc.text(`Relatório ROI Global - Comparativo - ID: ${selectedId}`, margin, 19);
            y = 40;
          }

          doc.setTextColor(22, 163, 74);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          doc.text("RESUMO E TOTAIS GERAIS", margin, y);
          y += 10;

          // Caixa com fundo verde claro para os totais
          doc.setFillColor(240, 253, 244); // green-50
          doc.setDrawColor(187, 247, 208); // green-200
          doc.setLineWidth(0.5);
          doc.rect(margin, y - 6, pageWidth - margin * 2, 106, 'FD');
          y += 4;

          doc.setTextColor(30, 41, 59); // texto destaque
          doc.setFontSize(9);

          doc.setFont("helvetica", "bold");
          doc.text("TOTAIS DAS COLUNAS (PARCIAIS)", margin + 5, y);
          y += 6;
          doc.setFont("helvetica", "normal");

          const columnsLeft = [
            { label: 'Capex: ', value: formatCurrency(totals.capex) },
            { label: 'Custos Mat/Mão de Obra: ', value: formatCurrency(totals.custosMateriais) },
            { label: 'Valor LM: ', value: formatCurrency(totals.valorLm) },
            { label: 'Valor Mínimo Sistema: ', value: formatCurrency(totals.valorMinimo) }
          ];
          const columnsRight = [
            { label: 'Ticket Mensal: ', value: formatCurrency(totals.ticketMensal) },
            { label: 'Finder: ', value: formatCurrency(totals.finder) },
            { label: 'Taxa Instalação: ', value: formatCurrency(totals.taxaInstalacao) },
            { label: 'Campanha Comercial: ', value: formatCurrency(totals.campanha) }
          ];

          for (let i = 0; i < 4; i++) {
            // Lado esquerdo
            doc.setFont("helvetica", "bold");
            doc.text(`• ${columnsLeft[i].label}`, margin + 10, y + (i * 6));
            let wLeft = doc.getTextWidth(`• ${columnsLeft[i].label}`);
            doc.setFont("helvetica", "normal");
            doc.text(columnsLeft[i].value, margin + 10 + wLeft, y + (i * 6));

            // Lado direito
            doc.setFont("helvetica", "bold");
            doc.setTextColor(30, 41, 59);
            doc.text(`• ${columnsRight[i].label}`, margin + 120, y + (i * 6));
            let wRight = doc.getTextWidth(`• ${columnsRight[i].label}`);
            doc.setFont("helvetica", "normal");

            if (columnsRight[i].label === 'Ticket Mensal: ') {
              if (totals.valorMinimo > totals.ticketMensal) {
                doc.setTextColor(220, 38, 38);
                doc.setFont("helvetica", "bold");
              } else {
                doc.setTextColor(22, 163, 74);
                doc.setFont("helvetica", "bold");
              }
            }

            doc.text(columnsRight[i].value, margin + 120 + wRight, y + (i * 6));
            doc.setTextColor(30, 41, 59); // reseta
            doc.setFont("helvetica", "normal");
          }
          y += 30;

          // Divisão interna
          doc.setDrawColor(187, 247, 208); // green-200
          doc.setLineWidth(0.5);
          doc.line(margin + 5, y, pageWidth - margin - 5, y);
          y += 8;

          // Despesas
          doc.setFont("helvetica", "bold");
          doc.setTextColor(225, 29, 72); // rose-600
          doc.text(`TOTAL DESPESAS: ${formatCurrency(despesasFixas)}`, margin + 5, y);

          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139); // texto mudo
          doc.text(`Cálculo: (${formatCurrency(totals.capex)} + ${formatCurrency(totals.custosMateriais)} + ${formatCurrency(totals.finder)} + ${formatCurrency(totals.campanha)}) - ${formatCurrency(totals.taxaInstalacao)}`, margin + 5, y + 6);
          y += 16;

          // Receitas
          doc.setFont("helvetica", "bold");
          doc.setTextColor(22, 163, 74); // green-600
          doc.text(`TOTAL RECEITAS: ${formatCurrency(receitasMensais)}`, margin + 5, y);

          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139); // texto mudo
          doc.text(`Cálculo: ${formatCurrency(totals.ticketMensal)} - ${formatCurrency(totals.opex)} - ${formatCurrency(totals.valorLm)}`, margin + 5, y + 6);
          y += 16;

          doc.line(margin + 5, y - 4, pageWidth - margin - 5, y - 4);

          // Retângulo forte de Destaque Final
          doc.setFillColor(22, 163, 74); // green-600
          doc.rect(margin + 5, y, 160, 12, 'F');

          doc.setTextColor(255, 255, 255);
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text(`ROI GLOBAL FINAL: ${roiGlobalFinal.toFixed(2)} meses`, margin + 10, y + 8);
        }
      }

      doc.save(`relatorio-roi-global-${selectedId}.pdf`);

      toast({
        title: "Sucesso",
        description: "PDF exportado com sucesso!",
      });
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      toast({
        title: "Erro",
        description: "Não foi possivel exportar o PDF.",
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
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium whitespace-nowrap">Buscar por ID Guarda Chuva:</label>
              <div className="w-[300px]">
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

            <div className="flex items-center gap-2">
              {filteredData.length > 0 && (
                <>
                  <Button
                    onClick={handleExportPdf}
                    disabled={isExporting}
                    variant="outline"
                    className="gap-2"
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScrollText className="h-4 w-4" />}
                    {isExporting ? "Exportando..." : "Exportar PDF"}
                  </Button>
                  <Button
                    onClick={handleExportExcel}
                    disabled={isExporting}
                    className="gap-2"
                  >
                    {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {isExporting ? "Exportando..." : "Exportar Excel"}
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>

          {filteredData.length > 0 ? (
            <div className="rounded-md border flex-1 overflow-auto bg-white px-4 pb-4" ref={reportRef}>
              <div className="mb-4 pt-4">
                <h2 className="text-lg font-bold">Relatório Consolidado - ID: {selectedId}</h2>
                <p className="text-sm text-muted-foreground">Data de geração: {new Date().toLocaleDateString("pt-BR")}</p>
              </div>
              <div className="[&>div]:overflow-visible relative mt-2">
                <Table>
                  <TableHeader className="break-normal shadow-sm group">
                    <TableRow className="h-14 hover:bg-transparent">
                      <TableHead className="whitespace-nowrap sticky top-0 bg-muted z-10 shadow-[0_1px_0_0_#e2e8f0]">Id</TableHead>
                      <TableHead className="whitespace-nowrap sticky top-0 bg-muted z-10 shadow-[0_1px_0_0_#e2e8f0]">Produto</TableHead>
                      <TableHead className="whitespace-nowrap sticky top-0 bg-muted z-10 shadow-[0_1px_0_0_#e2e8f0]">Banda/Modelo</TableHead>
                      <TableHead className="whitespace-nowrap text-center sticky top-0 bg-muted z-10 shadow-[0_1px_0_0_#e2e8f0]">Qtde</TableHead>
                      <TableHead className="whitespace-nowrap text-right sticky top-0 bg-muted z-10 shadow-[0_1px_0_0_#e2e8f0]">Capex</TableHead>
                      <TableHead className="whitespace-nowrap text-right sticky top-0 bg-muted z-10 shadow-[0_1px_0_0_#e2e8f0]" title="Lançamento custos de materiais e mão de Obra">Custos Mat/Obra</TableHead>
                      <TableHead className="whitespace-nowrap text-right sticky top-0 bg-muted z-10 shadow-[0_1px_0_0_#e2e8f0]">Valor LM</TableHead>
                      <TableHead className="whitespace-nowrap text-right sticky top-0 bg-muted z-10 shadow-[0_1px_0_0_#e2e8f0]">Valor Minimo do Sistema</TableHead>
                      <TableHead className="whitespace-nowrap text-right sticky top-0 bg-muted z-10 shadow-[0_1px_0_0_#e2e8f0]">Valor Mensal (Ticket)</TableHead>
                      <TableHead className="whitespace-nowrap text-center sticky top-0 bg-muted z-10 shadow-[0_1px_0_0_#e2e8f0]">Finder</TableHead>
                      <TableHead className="whitespace-nowrap text-right sticky top-0 bg-muted z-10 shadow-[0_1px_0_0_#e2e8f0]">Taxa Instalação</TableHead>
                      <TableHead className="whitespace-nowrap text-center sticky top-0 bg-muted z-10 shadow-[0_1px_0_0_#e2e8f0]">Camp. Com.</TableHead>
                      <TableHead className="whitespace-nowrap text-center sticky top-0 bg-muted z-10 shadow-[0_1px_0_0_#e2e8f0]">Regra % LM</TableHead>
                      <TableHead className="whitespace-nowrap text-center sticky top-0 bg-muted z-10 shadow-[0_1px_0_0_#e2e8f0]">ROI Previsto</TableHead>
                      <TableHead className="whitespace-nowrap text-center sticky top-0 bg-muted z-10 shadow-[0_1px_0_0_#e2e8f0]">ROI Global</TableHead>
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
                        <TableCell className="text-right">{formatCurrency(dp.custosMateriaisAdicionais)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(dp.media_mensalidade_lm)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.valor_minimo)}
                        </TableCell>
                        <TableCell className={cn(
                          "text-right font-semibold",
                          (item.valor_minimo || 0) > (item.ticket_mensal || 0) ? "text-destructive" : "text-green-600"
                        )}>
                          {formatCurrency(item.ticket_mensal)}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatCurrency((item.ticket_mensal || 0) * ((dp.usou_finder2 || 0) / 100))}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(dp.taxaInstalacao)}</TableCell>
                        <TableCell className="text-center">
                          {formatCurrency(dp.campanha_comercial_meses || 0)}
                        </TableCell>
                        <TableCell className="text-center">
                          {(() => {
                            const ratio = item.ticket_mensal ? (dp.media_mensalidade_lm || 0) / item.ticket_mensal : 0;
                            return (
                              <span className={cn(
                                "font-medium",
                                ratio > 0.33 ? "text-destructive" : "text-green-600"
                              )}>
                                {ratio.toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 2 })}
                              </span>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-center text-muted-foreground font-medium">
                          {item.previsao_roi != null ? item.previsao_roi.toFixed(1) : "-"}
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {item.roi_global ? item.roi_global.toFixed(2) : "-"}
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
                    <TableCell className="text-right">{formatCurrency(totals.custosMateriais)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.valorLm)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.valorMinimo)}</TableCell>
                    <TableCell className={cn(
                      "text-right font-semibold",
                      totals.valorMinimo > totals.ticketMensal ? "text-destructive" : "text-green-600"
                    )}>
                      {formatCurrency(totals.ticketMensal)}
                    </TableCell>
                    <TableCell className="text-center">{formatCurrency(totals.finder)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(totals.taxaInstalacao)}</TableCell>
                    <TableCell className="text-center">{formatCurrency(totals.campanha)}</TableCell>
                    <TableCell className="text-center"></TableCell>
                    <TableCell className="text-center"></TableCell>
                    <TableCell className="text-center">{roiGlobalFinal.toFixed(2)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
              </div>

              <div className="mt-8 p-6 bg-muted/30 rounded-xl border-t-4 border-t-primary shadow-inner">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <div className="h-2 w-6 bg-primary rounded-full" />
                  Resumo do ROI Global
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Despesas Card */}
                  <div className="bg-white p-5 rounded-lg border shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Detalhamento de Despesas</span>
                      <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/5 font-bold">Saídas</Badge>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-muted-foreground italic">
                        Cálculo: (Capex + Lançamento + Finder + Campanha) - Taxa de Instalação
                      </p>
                      <div className="p-3 bg-muted/50 rounded-md font-mono text-sm">
                        ({formatCurrency(totals.capex)} + {formatCurrency(totals.custosMateriais)} + {formatCurrency(totals.finder)} + {formatCurrency(totals.campanha)}) - {formatCurrency(totals.taxaInstalacao)}
                      </div>
                      <div className="pt-2 flex justify-between items-end border-t border-dashed">
                        <span className="text-sm font-medium">Despesas Totais:</span>
                        <span className="text-2xl font-black text-destructive">{formatCurrency(despesasFixas)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Receitas Card */}
                  <div className="bg-white p-5 rounded-lg border shadow-sm space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                      <span className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Detalhamento de Receitas</span>
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 font-bold">Entradas</Badge>
                    </div>
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-muted-foreground italic">
                        Cálculo: Valor Mensal - OPEX - Valor LM
                      </p>
                      <div className="p-3 bg-muted/50 rounded-md font-mono text-sm">
                        {formatCurrency(totals.ticketMensal)} - {formatCurrency(totals.opex)} - {formatCurrency(totals.valorLm)}
                      </div>
                      <div className="pt-2 flex justify-between items-end border-t border-dashed">
                        <span className="text-sm font-medium">Receitas Totais:</span>
                        <span className="text-2xl font-black text-green-600">{formatCurrency(receitasMensais)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ROI Final Banner */}
                <div className="mt-8 bg-primary/5 border-2 border-primary/20 p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
                  <div className="space-y-1">
                    <h4 className="text-lg font-bold text-primary flex items-center gap-2">
                      ROI Global Final
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Fórmula consolidada: <span className="font-mono bg-primary/10 px-2 py-0.5 rounded">{formatCurrency(despesasFixas)} / {formatCurrency(receitasMensais)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-4 bg-white px-8 py-4 rounded-xl border-2 border-primary shadow-lg animate-in fade-in zoom-in duration-500">
                    <div className="text-sm font-bold text-primary uppercase vertical-text">RESULTADO</div>
                    <div className="text-5xl font-black text-primary tabular-nums">
                      {roiGlobalFinal.toFixed(2)}
                      <span className="text-sm font-medium ml-1">meses</span>
                    </div>
                  </div>
                </div>
              </div>
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

      </DialogContent>
    </Dialog>
  );
}
