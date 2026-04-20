import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock } from "lucide-react";

export type DistanciaChoice = "sistema" | "projetista";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  distanciaSistema: number | null;
  onChoose: (choice: DistanciaChoice) => void;
}

export default function ModalEscolhaDistancia({ open, onOpenChange, distanciaSistema, onChoose }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Como deseja definir a distância?</DialogTitle>
          <DialogDescription>
            Escolha entre usar a distância calculada pelo sistema ou aguardar o preenchimento por um projetista.
            {distanciaSistema != null && (
              <span className="block mt-1 font-medium text-foreground">
                Distância estimada: {Math.round(distanciaSistema).toLocaleString("pt-BR")} m
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 py-2">
          <Button
            variant="outline"
            className="h-auto py-4 flex items-center gap-3 justify-start border-2 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
            onClick={() => onChoose("sistema")}
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="text-left">
              <div className="font-semibold text-sm">Usar distância do Sistema</div>
              <div className="text-xs text-muted-foreground">
                A distância calculada será preenchida automaticamente
              </div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex items-center gap-3 justify-start border-2 hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-950/20"
            onClick={() => onChoose("projetista")}
          >
            <Clock className="h-5 w-5 text-violet-500 shrink-0" />
            <div className="text-left">
              <div className="font-semibold text-sm">Aguardar Projetista</div>
              <div className="text-xs text-muted-foreground">
                O campo de distância ficará vazio para preenchimento posterior
              </div>
            </div>
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
