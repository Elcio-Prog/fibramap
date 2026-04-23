---
name: Straight line routing to box
description: Distance and trace from customer to nearest box uses Haversine straight line, not OSRM road routing, since fiber installation doesn't follow streets
type: preference
---
The routing from the customer coordinate to the nearest connection box (TA/CE) uses straight-line (Haversine) distance and a direct LineString geometry instead of OSRM road-based routing. This reflects real-world fiber installation where cable is laid directly from the client to the box, not following street paths. CPFL/highway crossing checks still apply using the straight-line geometry.
