class OSMProvider {

    constructor() {
        this.id = "osm";
        this.name = "OpenStreetMap Overpass";
    }

    async query(source, boundary, options = {}) {
        const mode = options.mode || "boundary";

        const overpassJson = mode === "boundary"
            ? await this.queryByBoundary(boundary, options)
            : await this.queryByMapView(options);

        const geojson = this.overpassToGeoJson(overpassJson);

        geojson.features.forEach(feature => {
            feature.properties.source = "OSM";
            feature.properties.provider = "osm";
        });

        return geojson;
    }

    async queryByBoundary(boundaryGeoJson, options = {}) {
        const polygonQueries = boundaryGeoJson.features.map(feature => {
            const ring = feature.geometry.coordinates[0];
            const polyString = ring.map(coord => `${coord[1]} ${coord[0]}`).join(" ");

            return `
                way["power"="line"](poly:"${polyString}");
                way["power"="minor_line"](poly:"${polyString}");
                way["power"="cable"](poly:"${polyString}");
                node["power"="tower"](poly:"${polyString}");
                node["power"="pole"](poly:"${polyString}");
                node["power"="transformer"](poly:"${polyString}");
                way["power"="substation"](poly:"${polyString}");
                relation["power"="substation"](poly:"${polyString}");
            `;
        }).join("\n");

        return await this.runOverpassQuery(`
[out:json][timeout:120];
(
${polygonQueries}
);
out body;
>;
out skel qt;
`, options);
    }

    async queryByMapView(options = {}) {
        const map = options.map;
        const b = map.getBounds();

        const south = b.getSouth();
        const west = b.getWest();
        const north = b.getNorth();
        const east = b.getEast();

        return await this.runOverpassQuery(`
[out:json][timeout:120];
(
  way["power"="line"](${south},${west},${north},${east});
  way["power"="minor_line"](${south},${west},${north},${east});
  way["power"="cable"](${south},${west},${north},${east});
  node["power"="tower"](${south},${west},${north},${east});
  node["power"="pole"](${south},${west},${north},${east});
  node["power"="transformer"](${south},${west},${north},${east});
  way["power"="substation"](${south},${west},${north},${east});
  relation["power"="substation"](${south},${west},${north},${east});
);
out body;
>;
out skel qt;
`, options);
    }

    async runOverpassQuery(query, options = {}, attempt = 1) {
        console.log(`Overpass attempt ${attempt}:`, query);

        try {
            const response = await fetch("https://overpass-api.de/api/interpreter", {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
                },
                body: new URLSearchParams({
                    data: query
                })
            });

            if (!response.ok) {
                if ([429, 502, 503, 504].includes(response.status) && attempt < 3) {
                    if (options.resultsDiv) {
                        options.resultsDiv.textContent =
                            `Overpass was busy or timed out. Retrying attempt ${attempt + 1} of 3...`;
                    }

                    await this.sleep(2000 * attempt);
                    return await this.runOverpassQuery(query, options, attempt + 1);
                }

                throw new Error(`Overpass request failed with status ${response.status}`);
            }

            const json = await response.json();

            console.log("Overpass raw result:", json);
            console.log("Raw elements returned:", json.elements ? json.elements.length : 0);

            return json;

        } catch (error) {
            if (attempt < 3) {
                if (options.resultsDiv) {
                    options.resultsDiv.textContent =
                        `Overpass request failed. Retrying attempt ${attempt + 1} of 3...`;
                }

                await this.sleep(2000 * attempt);
                return await this.runOverpassQuery(query, options, attempt + 1);
            }

            throw error;
        }
    }

    overpassToGeoJson(overpassJson) {
        const nodes = new Map();
        const features = [];

        overpassJson.elements.forEach(element => {
            if (element.type === "node" && Number.isFinite(element.lon) && Number.isFinite(element.lat)) {
                nodes.set(element.id, {
                    coordinates: [element.lon, element.lat],
                    tags: {
                        ...(element.tags || {}),
                        osm_id: element.id
                    }
                });
            }
        });

        overpassJson.elements.forEach(element => {
            const tags = {
                ...(element.tags || {}),
                osm_id: element.id
            };

            if (element.type === "node" && tags.power) {
                features.push({
                    type: "Feature",
                    properties: tags,
                    geometry: {
                        type: "Point",
                        coordinates: [element.lon, element.lat]
                    }
                });
            }

            if (element.type === "way" && tags.power && Array.isArray(element.nodes)) {
                const coordinates = element.nodes
                    .map(nodeId => nodes.get(nodeId))
                    .filter(Boolean)
                    .map(node => node.coordinates);

                if (coordinates.length >= 2) {
                    const isClosed =
                        coordinates.length >= 4 &&
                        coordinates[0][0] === coordinates[coordinates.length - 1][0] &&
                        coordinates[0][1] === coordinates[coordinates.length - 1][1];

                    features.push({
                        type: "Feature",
                        properties: tags,
                        geometry: isClosed
                            ? { type: "Polygon", coordinates: [coordinates] }
                            : { type: "LineString", coordinates }
                    });
                }
            }
        });

        return {
            type: "FeatureCollection",
            features
        };
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

const osmProvider = new OSMProvider();

providerManager.register(osmProvider);