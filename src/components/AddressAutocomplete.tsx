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
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      // Clean address before searching
      const cleaned = convertNumberWords(cleanAddressForSearch(query));
      
      // Build search promises - always search with digits version
      const promises: Promise<NominatimResult[]>[] = [
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleaned)}&limit=5&countrycodes=br&addressdetails=1&accept-language=pt-BR`)
          .then(r => r.json()).catch(() => []),
      ];

      // If query contains digits, also search with number words (e.g. "42" → "quarenta e dois")
      const withWords = /\d/.test(cleaned) ? convertDigitsToWords(cleaned) : null;
      if (withWords && withWords !== cleaned) {
        promises.push(
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(withWords)}&limit=5&countrycodes=br&addressdetails=1&accept-language=pt-BR`)
            .then(r => r.json()).catch(() => [])
        );
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

      // Fallback 1: try removing middle comma-separated terms (e.g. "centro")
      // Keep first segment (street) and last segment (city), drop middle ones
      if (data.length === 0) {
        const parts = cleaned.split(/\s*,\s*/).filter(Boolean);
        if (parts.length >= 3) {
          const simpler = `${parts[0]} ${parts[parts.length - 1]}`;
          const fallbackPromises: Promise<NominatimResult[]>[] = [
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simpler)}&limit=5&countrycodes=br&addressdetails=1&accept-language=pt-BR`)
              .then(r => r.json()).catch(() => []),
          ];
          // Also try with number words version
          const simplerWords = /\d/.test(simpler) ? convertDigitsToWords(simpler) : null;
          if (simplerWords && simplerWords !== simpler) {
            fallbackPromises.push(
              fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simplerWords)}&limit=5&countrycodes=br&addressdetails=1&accept-language=pt-BR`)
                .then(r => r.json()).catch(() => [])
            );
          }
          const fbResults = await Promise.all(fallbackPromises);
          for (const arr of fbResults) {
            for (const item of arr) {
              if (!seen.has(item.place_id)) {
                seen.add(item.place_id);
                data.push(item);
              }
            }
          }
        }
      }

      // Fallback 2: try simplified query (remove number and neighborhood)
      if (data.length === 0) {
        const simplified = cleaned
          .replace(/,?\s*\d+\s*/g, " ")
          .replace(/\s*-\s*[^,]+/g, "")
          .trim();
        if (simplified !== cleaned) {
          const res3 = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simplified)}&limit=5&countrycodes=br&addressdetails=1&accept-language=pt-BR`
          );
          data = await res3.json();
        }
      }

      setSuggestions(data);
      setShowDropdown(data.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    onChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
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
