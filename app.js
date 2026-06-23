const map = new maplibregl.Map({
    container: 'map',

    style: {
        version: 8,
        sources: {
            osm: {
                type: 'raster',
                tiles: [
                    'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
                ],
                tileSize: 256,
                attribution: '© OpenStreetMap'
            }
        },
        layers: [
            {
                id: 'osm',
                type: 'raster',
                source: 'osm'
            }
        ]
    },

    center: [-97.7431, 30.2672],
    zoom: 8
});

const kmlFileInput = document.getElementById('kmlFile');
const resultsDiv = document.getElementById('results');

map.on('load', () => {
    map.addSource('boundary', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    });

    map.addLayer({
        id: 'boundary-fill',
        type: 'fill',
        source: 'boundary',
        paint: {
            'fill-color': '#0077ff',
            'fill-opacity': 0.20
        }
    });

    map.addLayer({
        id: 'boundary-outline',
        type: 'line',
        source: 'boundary',
        paint: {
            'line-color': '#003cff',
            'line-width': 3
        }
    });
});

kmlFileInput.addEventListener('change', async function () {
    const file = kmlFileInput.files[0];

    if (!file) {
        resultsDiv.textContent = 'No file loaded.';
        return;
    }

    try {
        resultsDiv.textContent = 'Reading boundary file...';

        const kmlText = await readKmlOrKmz(file);
        const boundaryGeoJson = parseKmlPolygons(kmlText);

        if (boundaryGeoJson.features.length === 0) {
            resultsDiv.textContent = 'No polygon area shapes found in this file.';
            return;
        }

        map.getSource('boundary').setData(boundaryGeoJson);
        zoomToGeoJson(boundaryGeoJson);

        resultsDiv.textContent =
            `Loaded file: ${file.name}\n` +
            `Area polygons found: ${boundaryGeoJson.features.length}\n` +
            `Projection: WGS84 fallback for now`;

    } catch (error) {
        console.error(error);
        resultsDiv.textContent = `Error: ${error.message}`;
    }
});

async function readKmlOrKmz(file) {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.kml')) {
        return await file.text();
    }

    if (fileName.endsWith('.kmz')) {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        const kmlFileName = Object.keys(zip.files).find(name =>
            name.toLowerCase().endsWith('.kml')
        );

        if (!kmlFileName) {
            throw new Error('KMZ did not contain a KML file.');
        }

        return await zip.files[kmlFileName].async('text');
    }

    throw new Error('Please upload a KML or KMZ file.');
}

function parseKmlPolygons(kmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

    const polygonNodes = xmlDoc.getElementsByTagName('Polygon');

    const features = [];

    for (let i = 0; i < polygonNodes.length; i++) {
        const polygonNode = polygonNodes[i];

        const coordinatesNode = polygonNode.getElementsByTagName('coordinates')[0];

        if (!coordinatesNode) {
            continue;
        }

        const coordinatesText = coordinatesNode.textContent.trim();

        if (!coordinatesText) {
            continue;
        }

        const coordinates = coordinatesText
            .split(/\s+/)
            .map(pair => {
                const parts = pair.split(',');
                const lon = parseFloat(parts[0]);
                const lat = parseFloat(parts[1]);

                return [lon, lat];
            })
            .filter(coord =>
                Number.isFinite(coord[0]) &&
                Number.isFinite(coord[1])
            );

        if (coordinates.length < 4) {
            continue;
        }

        const first = coordinates[0];
        const last = coordinates[coordinates.length - 1];

        if (first[0] !== last[0] || first[1] !== last[1]) {
            coordinates.push(first);
        }

        features.push({
            type: 'Feature',
            properties: {
                source: 'KML Polygon',
                index: i + 1
            },
            geometry: {
                type: 'Polygon',
                coordinates: [coordinates]
            }
        });
    }

    return {
        type: 'FeatureCollection',
        features: features
    };
}

function zoomToGeoJson(geojson) {
    const bounds = new maplibregl.LngLatBounds();

    geojson.features.forEach(feature => {
        const rings = feature.geometry.coordinates;

        rings.forEach(ring => {
            ring.forEach(coord => {
                bounds.extend(coord);
            });
        });
    });

    map.fitBounds(bounds, {
        padding: 60,
        duration: 1000
    });
}