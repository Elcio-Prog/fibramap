import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";
import { cleanAddressForSearch } from "@/lib/geo-utils";
import { convertNumberWords, convertDigitsToWords } from "@/lib/number-words";

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: { address: string; lat: number; lng: number }) => void;
  placeholder?: string;
}

export function AddressAutocomplete({ value, onChange, onSelect, placeholder }: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (query: string) => {
    // Cancel any previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      // Clean address before searching
      const cleaned = convertNumberWords(cleanAddressForSearch(query));
      
      const nominatimUrl = (q: string) =>
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&countrycodes=br&addressdetails=1&accept-language=pt-BR`;
      const fetchJson = (url: string): Promise<NominatimResult[]> =>
        fetch(url, { signal: controller.signal }).then(r => r.json()).catch(() => []);

      // Build all search variants in parallel
      const promises: Promise<NominatimResult[]>[] = [
        fetchJson(nominatimUrl(cleaned)),
      ];

      // If query contains digits, also search with number words (e.g. "42" → "quarenta e dois")
      const withWords = /\d/.test(cleaned) ? convertDigitsToWords(cleaned) : null;
      if (withWords && withWords !== cleaned) {
        promises.push(fetchJson(nominatimUrl(withWords)));
      }

      // Always also search simplified (drop middle comma terms like "centro")
      const parts = cleaned.split(/\s*,\s*/).filter(Boolean);
      if (parts.length >= 3) {
        const simpler = `${parts[0]} ${parts[parts.length - 1]}`;
        promises.push(fetchJson(nominatimUrl(simpler)));
        // Also simplified + number words
        const simplerWords = /\d/.test(simpler) ? convertDigitsToWords(simpler) : null;
        if (simplerWords && simplerWords !== simpler) {
          promises.push(fetchJson(nominatimUrl(simplerWords)));
        }
        // And with words version simplified
        if (withWords) {
          const wordParts = withWords.split(/\s*,\s*/).filter(Boolean);
          if (wordParts.length >= 3) {
            const simplerW = `${wordParts[0]} ${wordParts[wordParts.length - 1]}`;
            promises.push(fetchJson(nominatimUrl(simplerW)));
          }
        }
      }

      const results = await Promise.all(promises);
      // Merge and deduplicate by place_id
      const seen = new Set<number>();
      let data: NominatimResult[] = [];
      for (const arr of results) {
        for (const item of arr) {
          if (!seen.has(item.place_id)) {
            seen.add(item.place_id);
            data.push(item);
          }
        }
      }

      // Last resort: try simplified query (remove number and neighborhood)
      if (data.length === 0) {
        const simplified = cleaned
          .replace(/,?\s*\d+\s*/g, " ")
          .replace(/\s*-\s*[^,]+/g, "")
          .trim();
        if (simplified !== cleaned) {
          data = await fetchJson(nominatimUrl(simplified));
        }
      }

      if (controller.signal.aborted) return; // stale response
      setSuggestions(data);
      setShowDropdown(data.length > 0);
    } catch (err: any) {
      if (err?.name === "AbortError") return; // cancelled, ignore
      setSuggestions([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 700);
  };

  const handleSelect = (item: NominatimResult) => {
    onChange(item.display_name);
    setShowDropdown(false);
    setSuggestions([]);
    onSelect({
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          placeholder={placeholder || "Digite o endereço..."}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-start gap-2 border-b last:border-b-0"
              onClick={() => handleSelect(s)}
              type="button"
            >
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">{s.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
