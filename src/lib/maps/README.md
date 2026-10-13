# World map geometry

`world-shapes.json` is derived from Natural Earth Admin 0 countries, 110m:
https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson

Natural Earth data is public domain: https://www.naturalearthdata.com/about/terms-of-use/
Longitude/latitude coordinates are projected to an SVG equirectangular 720×360 canvas. Antarctica is omitted. A point marks the Maldives, which are too small for the 110m polygons.

Spanish contours use Natural Earth Admin 0 countries, 10m, to retain the Balearic and Canary islands:
https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_0_countries.geojson

Destination bounds for Minorque and Tenerife are derived from their island polygons in that dataset. When the selected period contains only that island for Spain, the map label and selected-country viewport use its actual bounds.
