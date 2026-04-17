import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Paperclip, Upload, X, FileText, Image as ImageIcon, Download } from "lucide-react";

export interface Anexo {
  path: string;
  name: string;
  size: number;
  type: string;
  uploaded_at: string;
}

interface Props {
  value: Anexo[];
  onChange: (next: Anexo[]) => void;
  disabled?: boolean;
  /** Optional folder prefix (e.g., the pre-viabilidade id) to keep files organized */
  folderPrefix?: string;
}

const BUCKET = "pre-viabilidade-anexos";
const MAX_SIZE_MB = 20;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function isImage(type: string) {
  return type.startsWith("image/");
}

export default function AttachmentsField({ value, onChange, disabled, folderPrefix }: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const novos: Anexo[] = [];
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          toast({ title: "Arquivo muito grande", description: `${file.name} excede ${MAX_SIZE_MB}MB.`, variant: "destructive" });
          continue;
        }
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const folder = folderPrefix || "tmp";
        const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (error) {
          toast({ title: "Erro no upload", description: `${file.name}: ${error.message}`, variant: "destructive" });
          continue;
        }
        novos.push({
          path,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          uploaded_at: new Date().toISOString(),
        });
      }
      if (novos.length) onChange([...(value || []), ...novos]);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async (anexo: Anexo) => {
    try {
      await supabase.storage.from(BUCKET).remove([anexo.path]);
    } catch {/* ignore */ }
    onChange((value || []).filter(a => a.path !== anexo.path));
  };

  const handleDownload = async (anexo: Anexo) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(anexo.path, 60);
    if (error || !data?.signedUrl) {
      toast({ title: "Erro ao gerar link", description: error?.message, variant: "destructive" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" /> Anexos
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Adicionar arquivo
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {(!value || value.length === 0) ? (
        <div className="text-xs text-muted-foreground border border-dashed rounded-md py-4 text-center">
          Nenhum anexo. PDF, imagens e documentos são aceitos (máx. {MAX_SIZE_MB}MB cada).
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {value.map(a => (
            <li key={a.path} className="flex items-center gap-2 px-3 py-2 text-sm">
              {isImage(a.type)
                ? <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                : <FileText className="h-4 w-4 text-muted-foreground shrink-0" />}
              <button
                type="button"
                onClick={() => handleDownload(a)}
                className="truncate text-left hover:underline flex-1"
                title={a.name}
              >
                {a.name}
              </button>
              <span className="text-xs text-muted-foreground tabular-nums shrink-0">{formatSize(a.size)}</span>
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownload(a)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              {!disabled && (
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRemove(a)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
