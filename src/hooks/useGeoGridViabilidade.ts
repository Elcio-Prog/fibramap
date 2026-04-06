import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GeoGridRecipiente {
  id: string;
  geogrid_id: string;
  sigla: string;
  portas_livres: number | null;
  latitude: number;
  longitude: number;
  status_viabilidade: string | null;
  recipiente_id: string | null;
  recipiente_item: string | null;
  recipiente_sigla: string | null;
  pasta_nome: string | null;
  tipo_splitter: string | null;
  portas: number | null;
  portas_ocupadas: number | null;
}

async function fetchGeoGridViabilidade(): Promise<GeoGridRecipiente[]> {
  try {
    const { data, error } = await supabase
      .from("geogrid_viabilidade_cache")
      .select(
        "id, geogrid_id, sigla, portas_livres, latitude, longitude, status_viabilidade, recipiente_id, recipiente_item, recipiente_sigla, pasta_nome, tipo_splitter, portas, portas_ocupadas"
      )
      .not("tipo_splitter", "like", "%Des");

    if (error) {
      console.error("[GeoGrid] Erro ao buscar geogrid_viabilidade_cache:", error);
      return [];
    }

    return (data ?? []) as GeoGridRecipiente[];
  } catch (err) {
    console.error("[GeoGrid] Exceção ao buscar geogrid_viabilidade_cache:", err);
    return [];
  }
}

export function useGeoGridViabilidade() {
  return useQuery({
    queryKey: ["geogrid-viabilidade"],
    queryFn: fetchGeoGridViabilidade,
  });
}
