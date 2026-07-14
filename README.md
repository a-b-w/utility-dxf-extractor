# Alex's Utility Extractor — Version 1.0

Alex's Utility Extractor is a browser-based GIS utility aggregation tool.

Upload a KML or KMZ project boundary, automatically detect the project location and recommended projection, query available public utility sources, preview the results on an interactive map, and download a packaged set of GIS deliverables.

## Version 1.0 Features

- KML and KMZ boundary import
- Multi-polygon boundary support
- Multi-county source discovery
- County, state, and GEOID detection
- State Plane zone, FIPS, and EPSG recommendation
- Boundary or current-map-view search modes
- OpenStreetMap / Overpass utility extraction
- HIFLD transmission-line and substation extraction
- ArcGIS provider framework
- Automatic provider registration and source selection
- Provider-result merging and basic deduplication
- Interactive utility preview
- ZIP download package containing:
  - Utility GeoJSON
  - Utility KML
  - Utility KMZ
  - Project metadata TXT
  - Boundary GeoJSON
  - Boundary KML

## Current Boundary Inputs

- `.kml`
- `.kmz`

DXF/DWG boundary import was evaluated but is not part of Version 1.0. The stable KML/KMZ workflow is the supported release path.

## Run Locally

From Git Bash:

```bash
cd /c/Projects/utility-dxf-extractor
py -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

If `py` is unavailable:

```bash
python -m http.server 8000
```

## Basic Workflow

1. Upload a KML or KMZ boundary.
2. Confirm the detected county and projection information.
3. Choose Boundary or Current Map View.
4. Click **Find Utilities**.
5. Review the map and result counts.
6. Click **Download Package**.

## Project Structure

```text
utility-dxf-extractor/
├── data/
│   ├── sources.json
│   ├── projections.json
│   ├── stateplane_zones.kml
│   └── us_county_boundaries.zip
├── js/
│   ├── managers/
│   │   ├── providermanager.js
│   │   └── sourcemanager.js
│   └── providers/
│       ├── arcgis.js
│       ├── hifld.js
│       └── osm.js
├── app.js
├── index.html
├── styles.css
├── README.md
└── ROADMAP.md
```

## Version

**Version 1.0 — Stable KML/KMZ utility extraction and GIS package download**

Created by Alexander West.
