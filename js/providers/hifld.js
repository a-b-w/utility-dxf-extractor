class HIFLDProvider {

    constructor() {
        this.id = "hifld";
        this.name = "HIFLD";

        this.datasets = {
            transmission: "https://services2.arcgis.com/FiaPA4ga0iQKduv3/arcgis/rest/services/US_Electric_Power_Transmission_Lines/FeatureServer/0/query",
            substations: "https://services5.arcgis.com/HDRa0B57OVrv2E1q/ArcGIS/rest/services/Electric_Substations/FeatureServer/0/query"
        };
    }

    async query(source, boundaryGeoJson, options = {}) {
        console.log(`HIFLD provider queried: ${source.name}`);

        const endpoint = this.datasets[source.dataset];

        if (!endpoint || !boundaryGeoJson) {
            return this.emptyFeatureCollection();
        }

        const extent = this.getBoundaryExtent(boundaryGeoJson);
        const url = this.buildQueryUrl(endpoint, extent);

        console.log("HIFLD query URL:", url);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HIFLD request failed with status ${response.status}`);
        }

        const geojson = await response.json();

        geojson.features = (geojson.features || []).map(feature => ({
            ...feature,
            properties: {
                ...(feature.properties || {}),
                source: source.name,
                provider: "hifld",
                power: source.power
            }
        }));

        console.log(`HIFLD returned ${geojson.features.length} features from ${source.name}`);

        return geojson;
    }

    buildQueryUrl(endpoint, extent) {
        const url = new URL(endpoint);

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
        url.searchParams.set("f", "geojson");

        return url.toString();
    }

    getBoundaryExtent(boundaryGeoJson) {
        let west = Infinity;
        let south = Infinity;
        let east = -Infinity;
        let north = -Infinity;

        boundaryGeoJson.features.forEach(feature => {
            this.walkCoordinates(feature.geometry.coordinates, coord => {
                west = Math.min(west, coord[0]);
                south = Math.min(south, coord[1]);
                east = Math.max(east, coord[0]);
                north = Math.max(north, coord[1]);
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

    emptyFeatureCollection() {
        return {
            type: "FeatureCollection",
            features: []
        };
    }
}

const hifldProvider = new HIFLDProvider();

providerManager.register(hifldProvider);