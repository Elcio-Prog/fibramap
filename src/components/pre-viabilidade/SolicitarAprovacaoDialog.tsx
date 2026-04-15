import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const MOTIVO_OPTIONS = [
  "Concorrência direta",
  "Cliente estratégico",
  "Volume futuro",
  "Penetração em nova região",
  "Parceria comercial",
  "Projeto guarda-chuva",
  "Retenção de cliente",
  "Teste de viabilidade técnica",
  "Campanha promocional",
  "LPU com cliente",
  "Teste expansão Last Mile",
  "Outros",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  numero: number | null;
}

export default function SolicitarAprovacaoDialog({ open, onOpenChange, numero }: Props) {
  const [motivo, setMotivo] = useState("");

  const handleOpenChange = (v: boolean) => {
    if (!v) setMotivo("");
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Solicitar Aprovação {numero != null ? `#${numero}` : ""}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Motivo</Label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo" />
              </SelectTrigger>
              <SelectContent side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-52">
                {MOTIVO_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button disabled={!motivo}>Solicitar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
