# Alex's Utility Extractor Roadmap

## Release Status

# Version 1.0 — COMPLETE

Version 1.0 establishes a stable end-to-end utility extraction workflow using KML/KMZ boundaries and downloadable GIS packages.

## Vision

Alex's Utility Extractor is a GIS utility data aggregation platform.

The application accepts a project boundary, detects location and projection information, queries the best available public utility sources, merges the results, previews them on a map, and packages the results into portable GIS deliverables.

The long-term goal remains nationwide utility extraction with source expansion driven primarily through configuration rather than repeated application rewrites.

## Version 1.0 Architecture

```text
KML / KMZ Boundary
        │
        ▼
Boundary Parsing
        │
        ▼
Multi-Polygon / Multi-County Detection
        │
        ▼
State / County / GEOID Detection
        │
        ▼
State Plane / FIPS / EPSG Recommendation
        │
        ▼
Source Registry
        │
        ▼
Provider Manager
        │
        ├───────────────┬────────────────┐
        ▼               ▼                ▼
      OSM             HIFLD          ArcGIS Framework
        │               │                │
        └───────────────┴────────────────┘
                        │
                        ▼
                 Merge / Deduplicate
                        │
                        ▼
                   Map Preview
                        │
                        ▼
                 Download Package
```

## Completed in Version 1.0

### Boundary Processing

- KML upload
- KMZ upload
- Polygon extraction
- Multi-polygon support
- Boundary preview
- Automatic map zoom

### Location Detection

- County detection
- Multi-county detection
- State detection
- County GEOID detection
- Nationwide compressed county dataset

### Projection Detection

- State Plane zone detection
- FIPS recommendation
- EPSG recommendation
- Projection search and selection

### Utility Search

- Uploaded-boundary search
- Current-map-view search
- OpenStreetMap / Overpass query engine
- Overpass retry logic
- HIFLD transmission-line query
- HIFLD substation query

### Source Architecture

- `sources.json` registry
- SourceManager
- ProviderManager
- OSM provider
- HIFLD provider
- ArcGIS provider framework
- Automatic provider registration
- County/state coverage filtering
- Multi-source query pipeline

### Processing

- Provider result normalization
- FeatureCollection merge
- Basic duplicate removal
- Utility feature counts
- Provider/source metadata tracking

### User Interface

- Interactive MapLibre map
- Boundary symbology
- Utility symbology
- Projection display
- County/state/GEOID display
- Result summary
- Boundary and map-view search modes

### Version 1.0 Deliverables

Every successful download creates a ZIP package containing:

- Utility GeoJSON
- Utility KML
- Utility KMZ
- Metadata TXT
- Boundary GeoJSON
- Boundary KML

The metadata file records project, projection, search mode, feature counts, and contributing providers.

## Deferred from Version 1.0

The following were intentionally removed from the release path to preserve stability:

- DXF boundary import
- DWG boundary import
- Direct DXF export
- Direct DWG export

These remain future candidates but will not be added by patching the stable Version 1.0 application.

## Version 1.1 Candidates

- Shapefile ZIP export
- GeoJSON boundary import
- Provider diagnostics
- Improved geometry-based deduplication
- Parallel provider queries
- Better progress and timeout reporting
- Additional national and state utility sources

## Version 1.2 Candidates

- Curated ArcGIS source catalog
- State, county, municipal, and utility-company sources
- Provider priority and confidence scoring
- Source health checking
- Local caching

## Future CAD Track

CAD functionality should be developed as a separate, tested conversion track rather than handwritten browser DXF output.

Possible future architecture:

```text
Canonical GeoJSON
        │
        ▼
Validated CAD Conversion Service
        │
        ├── DXF
        └── DWG
```

Any future CAD importer must include explicit source CRS handling and performance-safe county detection before being merged into the stable application.

## Version 1.0 Release Notes

- Stable KML/KMZ boundary workflow established
- OSM and HIFLD providers verified
- Multi-provider results merged and previewed
- Download package verified
- Metadata export verified
- Experimental CAD import/export work removed from release scope

## Current Priority

1. Push and tag Version 1.0.
2. Publish the static application.
3. Verify the hosted KML/KMZ workflow.
4. Begin Version 1.1 only from the stable Version 1.0 branch.

## Development Rule

`main` must remain deployable and working.

Experimental features should be developed in separate branches and merged only after the full Version 1.0 workflow still passes.
