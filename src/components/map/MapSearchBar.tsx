import { useState, useRef, useEffect, useCallback } from "react";
import L from "leaflet";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  map: L.Map | null;
}

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

/** Detect if input looks like coordinates: -23.5505, -46.6333 or -23.5505 -46.6333 */
function parseCoords(input: string): { lat: number; lng: number } | null {
  const cleaned = input.trim();
  // Match patterns like: -23.5505, -46.6333  or  -23.5505 -46.6333
  const match = cleaned.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

/** Detect if input looks like a CEP */
function parseCep(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 8) return digits;
  return null;
}

export default function MapSearchBar({ map }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const markerRef = useRef<L.Marker | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const clearMarker = () => {
    if (markerRef.current && map) {
      markerRef.current.removeFrom(map);
      markerRef.current = null;
    }
  };

  const placeMarker = (lat: number, lng: number, label?: string) => {
    if (!map) return;
    clearMarker();
    const marker = L.marker([lat, lng]).addTo(map);
    if (label) marker.bindPopup(label).openPopup();
    markerRef.current = marker;
    map.setView([lat, lng], 16);
    setErrorMsg("");
  };

  // Remove marker on click outside
  useEffect(() => {
    if (!map) return;
    const handler = () => clearMarker();
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [map]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setSuggestions([]); return; }
    // Skip autocomplete for coords/CEP
    if (parseCoords(q) || parseCep(q)) { setSuggestions([]); return; }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=br&limit=5`);
      const data = await res.json();
      setSuggestions(data.map((d: any) => ({ display_name: d.display_name, lat: d.lat, lon: d.lon })));
      setShowSuggestions(true);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setErrorMsg("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(value), 400);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setShowSuggestions(false);

    // 1. Coordinates
    const coords = parseCoords(query);
    if (coords) {
      placeMarker(coords.lat, coords.lng, `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
      return;
    }

    // 2. CEP
    const cep = parseCep(query);
    if (cep) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (data.erro) { setErrorMsg("CEP não encontrado."); return; }
        // Geocode the address from CEP
        const addr = `${data.logradouro}, ${data.localidade}, ${data.uf}, Brasil`;
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`);
        const geoData = await geoRes.json();
        if (geoData.length > 0) {
          placeMarker(parseFloat(geoData[0].lat), parseFloat(geoData[0].lon), `${data.logradouro}, ${data.localidade} - ${data.uf}`);
        } else {
          setErrorMsg("Localização não encontrada. Tente outro endereço, CEP ou coordenada.");
        }
      } catch {
        setErrorMsg("Erro ao buscar CEP.");
      }
      return;
    }

    // 3. Address
    if (suggestions.length > 0) {
      const s = suggestions[0];
      placeMarker(parseFloat(s.lat), parseFloat(s.lon), s.display_name);
    } else {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=br&limit=1`);
        const data = await res.json();
        if (data.length > 0) {
          placeMarker(parseFloat(data[0].lat), parseFloat(data[0].lon), data[0].display_name);
        } else {
          setErrorMsg("Localização não encontrada. Tente outro endereço, CEP ou coordenada.");
        }
      } catch {
        setErrorMsg("Erro na busca.");
      }
    }
  };

  const selectSuggestion = (s: Suggestion) => {
    setQuery(s.display_name);
    setShowSuggestions(false);
    setSuggestions([]);
    placeMarker(parseFloat(s.lat), parseFloat(s.lon), s.display_name);
  };

  return (
    <div className="absolute left-3 top-3 z-[1000] w-80">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 pr-16 h-9 text-sm bg-background/95 backdrop-blur-sm shadow-lg border"
          placeholder="Endereço, CEP ou coordenadas..."
          value={query}
          onChange={e => handleInputChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleSearch(); }}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5">
          {query && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setQuery(""); setSuggestions([]); setErrorMsg(""); clearMarker(); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSearch}>
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors border-b last:border-b-0"
              onClick={() => selectSuggestion(s)}
            >
              {s.display_name}
            </button>
          ))}
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <div className="mt-1 bg-background border rounded-md shadow-sm px-3 py-2 text-xs text-muted-foreground">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
