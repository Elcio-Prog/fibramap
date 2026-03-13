import { useState, useRef, useEffect, useCallback } from "react";
import L from "leaflet";
import { Search, X } from "lucide-react";

interface Props {
  map: L.Map | null;
}

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

function parseCoords(input: string): { lat: number; lng: number } | null {
  const cleaned = input.trim();
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

  useEffect(() => {
    if (!map) return;
    const handler = () => clearMarker();
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [map]);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 3) { setSuggestions([]); return; }
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

    const coords = parseCoords(query);
    if (coords) {
      placeMarker(coords.lat, coords.lng, `${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
      return;
    }

    const cep = parseCep(query);
    if (cep) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (data.erro) { setErrorMsg("CEP não encontrado."); return; }
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
    <div className="absolute left-1/2 top-4 z-[1000] w-[min(420px,90%)] -translate-x-1/2">
      {/* Search container */}
      <div className="relative flex items-center rounded-full bg-sidebar shadow-lg shadow-black/20 ring-1 ring-white/10">
        <Search className="pointer-events-none ml-4 h-4 w-4 shrink-0 text-sidebar-foreground/50" />
        <input
          className="h-11 flex-1 bg-transparent px-3 text-sm text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none"
          placeholder="Endereço, CEP ou coordenadas..."
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
        />
        <div className="flex shrink-0 items-center gap-0.5 pr-2">
          {query && (
            <button
              onClick={() => { setQuery(""); setSuggestions([]); setErrorMsg(""); clearMarker(); }}
              className="flex h-7 w-7 items-center justify-center rounded-full text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={handleSearch}
            className="flex h-7 w-7 items-center justify-center rounded-full text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-2xl bg-sidebar shadow-lg shadow-black/20 ring-1 ring-white/10">
          {suggestions.map((s, i) => (
            <button
              key={i}
              className="w-full border-b border-sidebar-border px-4 py-2.5 text-left text-xs text-sidebar-foreground/80 transition-colors last:border-b-0 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={() => selectSuggestion(s)}
            >
              {s.display_name}
            </button>
          ))}
        </div>
      )}

      {/* Error message */}
      {errorMsg && (
        <div className="mt-2 rounded-2xl bg-sidebar px-4 py-2.5 text-xs text-sidebar-foreground/70 shadow-lg shadow-black/20 ring-1 ring-white/10">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
