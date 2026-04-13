

## Plan: Fix Route Distance Inconsistencies

### Problems Identified

1. **OSRM uses `foot` profile instead of `driving`** — Both `getRouteDistance` and `getRouteDistancePreSnapped` in `geo-utils.ts` use OSRM's `foot` profile, which follows pedestrian paths and can produce incorrect/shorter routes or fail where driving routes exist.

2. **No route drawn when OSRM fails** — In FeasibilityPage, when OSRM fails for non-NTT providers (line 480-483), `routeGeometry` stays `null`, so nothing is drawn on the map. The user sees the distance label but no visual trace.

3. **No "route failed" indicator in FeasibilityPage** — Unlike WsSingleSearch which shows a "Rota não disponível" label when `route_failed=true`, FeasibilityPage has no such indicator.

### Changes

**1. `src/lib/geo-utils.ts`** — Switch OSRM profile from `foot` to `driving`
- `getRouteDistance` (line 889): change `/foot/` to `/driving/`
- `getRouteDistancePreSnapped` (line 1079): change `/foot/` to `/driving/`
- Add a fallback: if `driving` returns no route, retry with `foot` profile (for very short distances where driving may not work, e.g. pedestrian-only areas)
- Increase timeout from 7s to 10s for better reliability

**2. `src/pages/FeasibilityPage.tsx`** — Add "route failed" visual indicator
- When `routeGeometry` is null but `nearestPoint` exists, show a warning label similar to WsSingleSearch ("Rota viária indisponível") instead of showing nothing
- Track `routeFailed` flag from the `findBestConnectionPointByRoute` result and pass it through to the rendering

**3. `src/pages/FeasibilityPage.tsx`** — Pass `routeFailed` through results
- Add `routeFailed` to the `FeasibilityResult` interface
- Propagate the flag from `cpByRoute.routeFailed` for NTT providers
- For non-NTT providers, set `routeFailed = true` when `getRouteDistance` returns null geometry

**4. `src/pages/WsSingleSearch.tsx`** — Already handles `route_failed` correctly, no changes needed

### Technical Detail

The OSRM public server at `router.project-osrm.org` supports both `driving` and `foot` profiles. The `foot` profile follows pedestrian paths which can:
- Cross through parks, pedestrian zones, and private areas
- Produce routes that don't follow road infrastructure
- Fail in areas without mapped pedestrian paths

Switching to `driving` with `foot` fallback ensures routes follow the road network (matching fiber cable deployment reality) while still providing results in edge cases.

