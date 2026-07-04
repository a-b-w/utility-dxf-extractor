class ArcGISProvider {

    constructor() {
        this.id = "arcgis";
        this.name = "ArcGIS REST";
    }

    async query(source, boundary, options = {}) {
        console.log("ArcGIS provider queried:", source.name);

        if (!source.url) {
            console.warn("ArcGIS source missing URL:", source);
            return this.emptyFeatureCollection();
        }

        if (!boundary || !boundary.features || boundary.features.length === 0) {
            console.warn("ArcGIS query skipped because no boundary was provided.");
            return this.emptyFeatureCollection();
        }

        const queryUrl = this.buildQueryUrl(source, boundary);

        console.log("ArcGIS query URL:", queryUrl);

        const response = await fetch(queryUrl);

        if (!response.ok) {
            throw new Error(`ArcGIS request failed with status ${response.status}`);
        }

        const esriJson = await response.json();

        if (esriJson.error) {
            console.error("ArcGIS REST error:", esriJson.error);
            throw new Error(`ArcGIS error: ${esriJson.error.message || "Unknown ArcGIS error"}`);
        }

        console.log(
            `ArcGIS returned ${esriJson.features ? esriJson.features.length : 0} features from ${source.name}`
        );

        return this.esriJsonToGeoJson(esriJson, source);
    }

    buildQueryUrl(source, boundary) {
        const url = new URL(`${source.url}/query`);

        const extent = this.getBoundaryExtent(boundary);

        const geometry = {
            xmin: extent.west,
            ymin: extent.south,
            xmax: extent.east,
            ymax: extent.north,
            spatialReference: {
                wkid: 4326
            }
        };

        url.searchParams.set("where", "1=1");
        url.searchParams.set("geometry", JSON.stringify(geometry));
        url.searchParams.set("geometryType", "esriGeometryEnvelope");
        url.searchParams.set("inSR", "4326");
        url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
        url.searchParams.set("outFields", "*");
        url.searchParams.set("returnGeometry", "true");
        url.searchParams.set("outSR", "4326");
        url.searchParams.set("f", "json");

        return url.toString();
    }

    getBoundaryExtent(boundary) {
        let west = Infinity;
        let south = Infinity;
        let east = -Infinity;
        let north = -Infinity;

        boundary.features.forEach(feature => {
            this.walkCoordinates(feature.geometry.coordinates, coord => {
                const lon = coord[0];
                const lat = coord[1];

                west = Math.min(west, lon);
                south = Math.min(south, lat);
                east = Math.max(east, lon);
                north = Math.max(north, lat);
            });
        });

        return { west, south, east, north };
    }

    walkCoordinates(coords, callback) {
        if (!Array.isArray(coords)) return;

        if (
            coords.length >= 2 &&
            typeof coords[0] === "number" &&
            typeof coords[1] === "number"
        ) {
            callback(coords);
            return;
        }

        coords.forEach(child => this.walkCoordinates(child, callback));
    }

    esriJsonToGeoJson(esriJson, source) {
        const features = (esriJson.features || [])
            .map(feature => this.esriFeatureToGeoJson(feature, source))
            .filter(Boolean);

        return {
            type: "FeatureCollection",
            features
        };
    }

    esriFeatureToGeoJson(feature, source) {
        const attributes = feature.attributes || {};
        const geometry = feature.geometry;

        if (!geometry) return null;

        const geojsonGeometry = this.esriGeometryToGeoJson(geometry);

        if (!geojsonGeometry) return null;

        return {
            type: "Feature",
            properties: {
                ...attributes,
                source: source.name,
                provider: "arcgis",
                power: source.power || "line"
            },
            geometry: geojsonGeometry
        };
    }

    esriGeometryToGeoJson(geometry) {
        if (geometry.x !== undefined && geometry.y !== undefined) {
            return {
                type: "Point",
                coordinates: [geometry.x, geometry.y]
            };
        }

        if (Array.isArray(geometry.paths)) {
            if (geometry.paths.length === 1) {
                return {
                    type: "LineString",
                    coordinates: geometry.paths[0]
                };
            }

            return {
                type: "MultiLineString",
                coordinates: geometry.paths
            };
        }

        if (Array.isArray(geometry.rings)) {
            return {
                type: "Polygon",
                coordinates: geometry.rings
            };
        }

        console.warn("Unsupported ArcGIS geometry:", geometry);
        return null;
    }

    emptyFeatureCollection() {
        return {
            type: "FeatureCollection",
            features: []
        };
    }
}

const arcgisProvider = new ArcGISProvider();

providerManager.register(arcgisProvider);