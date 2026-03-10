import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

interface Props {
  value: string;
  type?: "text" | "number";
  onSave: (value: string) => void;
  width?: string;
  mask?: "cnpj";
}

export default function CartEditableCell({ value, type = "text", onSave, width = "w-[80px]", mask }: Props) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleBlur = () => {
    setEditing(false);
    if (localValue !== value) {
      onSave(mask === "cnpj" ? localValue : localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleBlur();
    if (e.key === "Escape") { setLocalValue(value); setEditing(false); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (mask === "cnpj") {
      setLocalValue(formatCnpj(e.target.value));
    } else {
      setLocalValue(e.target.value);
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        className={`h-6 text-[10px] px-1 ${width}`}
        type={mask ? "text" : type}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <div
      className={`flex items-center gap-0.5 cursor-pointer group ${width} min-h-[24px] px-1 rounded border border-transparent hover:border-dashed hover:border-muted-foreground/40`}
      onClick={() => setEditing(true)}
    >
      <span className="truncate text-[10px]">{value || "—"}</span>
      <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
    </div>
  );
}
