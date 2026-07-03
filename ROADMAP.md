# Alex's Utility Extractor Roadmap

## Vision

Alex's Utility Extractor is a GIS utility data aggregation tool.

The goal is simple:

Upload a project boundary, automatically detect location and projection, query the best available public utility data sources, merge the results, remove duplicates, and export clean CAD/GIS deliverables.

## Current Status

### Completed

- KML/KMZ boundary upload
- Boundary polygon extraction
- Map preview
- County detection
- State detection
- County GEOID detection
- State Plane zone detection
- EPSG/FIPS projection suggestion
- Projection search
- OSM / Overpass utility query
- Boundary search mode
- Current map view search mode
- Overpass retry logic
- Utility symbology
- Compressed county dataset loading
- Source registry foundation
- Plugin-style source architecture started

## Architecture Goal

```text
Boundary
    ↓
Location Detection
    ↓
Projection Detection
    ↓
Source Registry
    ↓
Provider Manager
    ↓
OSM / ArcGIS / HIFLD / WFS / GeoJSON
    ↓
Normalize Features
    ↓
Merge
    ↓
Deduplicate
    ↓
Preview
    ↓
DXF Export