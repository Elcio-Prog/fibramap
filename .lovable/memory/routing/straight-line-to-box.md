---
name: OSRM foot profile for routing
description: All OSRM routing uses 'foot' profile to follow roads but ignore one-way street direction restrictions
type: preference
---
All OSRM routing calls (getRouteDistance, getRouteDistancePreSnapped, getRouteDistanceFast) use the `foot` profile instead of `driving`. This ensures routes follow the road network geometry but ignore one-way street restrictions (sentido da via), since fiber installation follows road paths regardless of traffic direction.
