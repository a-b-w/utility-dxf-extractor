# Alex's Utility Extractor Roadmap

---

# Vision

Alex's Utility Extractor is a GIS utility data aggregation platform.

The goal is simple:

Upload a project boundary, automatically detect the project location and projection, discover the best available public utility datasets, merge the results into one clean dataset, remove duplicates, preview everything on the map, and export production-ready CAD/GIS deliverables.

The long-term goal is nationwide utility extraction without requiring code changes for new providers.

---

# Architecture

```text
Boundary
    │
    ▼
Location Detection
    │
    ▼
Projection Detection
    │
    ▼
Source Registry (sources.json)
    │
    ▼
Provider Manager
    │
    ├───────────────┐
    │               │
    ▼               ▼
OSM Provider   ArcGIS Provider
    │               │
    └──────┬────────┘
           ▼
Normalize Features
           ▼
Merge
           ▼
Deduplicate
           ▼
Preview
           ▼
DXF Export
```

---

# Current Status

## ✅ Completed

### Boundary Processing

- KML upload
- KMZ upload
- Polygon extraction
- Boundary preview

### Location Detection

- County detection
- State detection
- County GEOID detection

### Projection Detection

- State Plane Zone detection
- EPSG/FIPS recommendation
- Projection search

### OSM

- Overpass query engine
- Boundary search
- Current map view search
- Retry logic
- Utility preview rendering

### County Dataset

- ZIP compressed county dataset
- Automatic loading
- County lookup

### Source Architecture

- Source registry
- sources.json configuration
- SourceManager
- ProviderManager
- Automatic provider registration
- Automatic source selection

### Providers

- OSM Provider
- ArcGIS Provider (framework)

### Processing

- Merge pipeline
- Deduplication framework
- Unified provider pipeline

### User Interface

- Utility preview
- Projection display
- County display
- Search modes

---

# 🚧 Current Milestone

## ArcGIS FeatureServer Query

Current objective:

Use ArcGIS REST FeatureServers to retrieve utility data and merge it with OSM results.

Once complete the application will support multiple providers simultaneously.

---

# Upcoming Milestones

## Milestone 8

ArcGIS FeatureServer support

- Query REST endpoints
- Convert ESRI JSON to GeoJSON
- Merge with OSM
- Display merged utilities

---

## Milestone 9

DXF Export Engine

- Export LineStrings
- Export Points
- Export Polygons
- Download DXF

---

## Milestone 10

CAD Improvements

- Layer mapping
- Colors
- Line weights
- Attribute export
- Blocks/symbols

---

## Milestone 11

Additional Providers

- HIFLD
- WFS
- GeoJSON
- State datasets
- Municipal datasets

---

## Milestone 12

Nationwide Expansion

- Provider diagnostics
- Automatic provider discovery
- Health checking
- Batch processing
- Multiple boundaries
- Provider statistics

---

# Design Philosophy

The application should never require editing JavaScript when adding a new utility provider.

Adding a provider should be:

1. Find the endpoint.
2. Add one entry to sources.json.
3. Reload the application.

Done.

---

# Development Log

## 2026-07-02

Major architecture refactor completed.

Implemented:

- Plugin architecture
- SourceManager
- ProviderManager
- OSM Provider
- ArcGIS Provider framework
- Automatic provider registration
- County-driven provider selection
- Source configuration (sources.json)
- Unified provider query pipeline
- Merge pipeline
- Deduplication pipeline
- Compressed nationwide county dataset
- Utility preview from provider pipeline

Current milestone:

➡ ArcGIS FeatureServer implementation

Next major milestone:

➡ First working DXF export