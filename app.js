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
const projectionSelect = document.getElementById('projectionSelect');

let boundaryGeoJson = null;
let statePlaneZones = [];

const projectionOptions = [
    {
        label: 'WGS84 - EPSG:4326',
        epsg: '4326',
        fips: '',
        zone: 'WGS84',
        search: 'wgs84 epsg 4326 latitude longitude lat lon'
    },
    {
        label: 'Texas North - FIPS 4201 - EPSG:2275',
        epsg: '2275',
        fips: '4201',
        zone: 'Texas North',
        search: 'texas north fips 4201 epsg 2275'
    },
    {
        label: 'Texas North Central - FIPS 4202 - EPSG:2276',
        epsg: '2276',
        fips: '4202',
        zone: 'Texas North Central',
        search: 'texas north central fips 4202 epsg 2276'
    },
    {
        label: 'Texas Central - FIPS 4203 - EPSG:2277',
        epsg: '2277',
        fips: '4203',
        zone: 'Texas Central',
        search: 'texas central fips 4203 epsg 2277'
    },
    {
        label: 'Texas South Central - FIPS 4204 - EPSG:2278',
        epsg: '2278',
        fips: '4204',
        zone: 'Texas South Central',
        search: 'texas south central fips 4204 epsg 2278'
    },
    {
        label: 'Texas South - FIPS 4205 - EPSG:2279',
        epsg: '2279',
        fips: '4205',
        zone: 'Texas South',
        search: 'texas south fips 4205 epsg 2279'
    }
];

map.on('load', async () => {
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

    setupProjectionSearch();

    try {
        await loadStatePlaneZones();
    } catch (error) {
        console.warn('State Plane zones not loaded:', error);
    }
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
        boundaryGeoJson = parseKmlPolygons(kmlText);

        if (boundaryGeoJson.features.length === 0) {
            resultsDiv.textContent = 'No polygon area shapes found in this file.';
            return;
        }

        map.getSource('boundary').setData(boundaryGeoJson);
        zoomToGeoJson(boundaryGeoJson);

        const detectedZone = detectStatePlaneZone(boundaryGeoJson);
        const projection = chooseProjectionFromZone(detectedZone);

        setProjectionSearchValue(projection);

        let zoneText = 'No State Plane zone detected. Using WGS84 fallback.';

        if (detectedZone) {
            zoneText =
                `Detected Zone: ${detectedZone.zoneName}\n` +
                `FIPS: ${detectedZone.fipsZone}\n` +
                `Suggested Projection: ${projection.label}`;
        }

        resultsDiv.textContent =
            `Loaded file: ${file.name}\n` +
            `Area polygons found: ${boundaryGeoJson.features.length}\n\n` +
            zoneText;

    } catch (error) {
        console.error(error);
        resultsDiv.textContent = `Error: ${error.message}`;
    }
});

function setupProjectionSearch() {
    const wrapper = document.createElement('div');

    const searchInput = document.createElement('input');
    searchInput.id = 'projectionSearch';
    searchInput.setAttribute('list', 'projectionList');
    searchInput.placeholder = 'Search EPSG, FIPS, or State Plane zone';
    searchInput.value = 'WGS84 - EPSG:4326';

    const dataList = document.createElement('datalist');
    dataList.id = 'projectionList';

    projectionOptions.forEach(option => {
        const item = document.createElement('option');
        item.value = option.label;
        dataList.appendChild(item);
    });

    wrapper.appendChild(searchInput);
    wrapper.appendChild(dataList);

    projectionSelect.replaceWith(wrapper);
}

function setProjectionSearchValue(projection) {
    const input = document.getElementById('projectionSearch');

    if (input && projection) {
        input.value = projection.label;
    }
}

async function loadStatePlaneZones() {
    const response = await fetch('data/stateplane_zones.kml');

    if (!response.ok) {
        throw new Error('Could not load data/stateplane_zones.kml');
    }

    const kmlText = await response.text();
    statePlaneZones = parseStatePlaneZoneKml(kmlText);

    console.log(`Loaded ${statePlaneZones.length} State Plane zones.`);
}

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

        const coordinates = parseKmlCoordinateText(coordinatesNode.textContent);

        if (coordinates.length < 4) {
            continue;
        }

        closeRingIfNeeded(coordinates);

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

function parseStatePlaneZoneKml(kmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

    const placemarks = xmlDoc.getElementsByTagName('Placemark');
    const zones = [];

    for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i];
        const polygonNode = placemark.getElementsByTagName('Polygon')[0];

        if (!polygonNode) {
            continue;
        }

        const coordinatesNode = polygonNode.getElementsByTagName('coordinates')[0];

        if (!coordinatesNode) {
            continue;
        }

        const coordinates = parseKmlCoordinateText(coordinatesNode.textContent);

        if (coordinates.length < 4) {
            continue;
        }

        closeRingIfNeeded(coordinates);

        const zoneName = getSimpleDataValue(placemark, 'ZONENAME') ||
            getPlacemarkName(placemark) ||
            'Unknown Zone';

        const fipsZone = getSimpleDataValue(placemark, 'FIPSZONE') || '';
        const zone = getSimpleDataValue(placemark, 'ZONE') || '';

        zones.push({
            zoneName,
            fipsZone,
            zone,
            coordinates
        });
    }

    return zones;
}

function parseKmlCoordinateText(text) {
    return text
        .trim()
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
}

function closeRingIfNeeded(coordinates) {
    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];

    if (first[0] !== last[0] || first[1] !== last[1]) {
        coordinates.push([...first]);
    }
}

function getSimpleDataValue(placemark, fieldName) {
    const simpleDataNodes = placemark.getElementsByTagName('SimpleData');

    for (let i = 0; i < simpleDataNodes.length; i++) {
        const node = simpleDataNodes[i];

        if (node.getAttribute('name') === fieldName) {
            return node.textContent.trim();
        }
    }

    return '';
}

function getPlacemarkName(placemark) {
    const nameNode = placemark.getElementsByTagName('name')[0];

    if (!nameNode) {
        return '';
    }

    return nameNode.textContent.trim();
}

function detectStatePlaneZone(boundaryGeoJson) {
    if (!statePlaneZones || statePlaneZones.length === 0) {
        return null;
    }

    const centroid = getGeoJsonCentroid(boundaryGeoJson);

    for (const zone of statePlaneZones) {
        if (pointInPolygon(centroid, zone.coordinates)) {
            return zone;
        }
    }

    return null;
}

function chooseProjectionFromZone(zone) {
    if (!zone) {
        return projectionOptions[0];
    }

    const match = projectionOptions.find(option =>
        option.fips === zone.fipsZone
    );

    if (match) {
        return match;
    }

    return projectionOptions[0];
}

function getGeoJsonCentroid(geojson) {
    let totalX = 0;
    let totalY = 0;
    let totalCount = 0;

    geojson.features.forEach(feature => {
        feature.geometry.coordinates.forEach(ring => {
            ring.forEach(coord => {
                totalX += coord[0];
                totalY += coord[1];
                totalCount++;
            });
        });
    });

    return [
        totalX / totalCount,
        totalY / totalCount
    ];
}

function pointInPolygon(point, polygon) {
    const x = point[0];
    const y = point[1];

    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0];
        const yi = polygon[i][1];
        const xj = polygon[j][0];
        const yj = polygon[j][1];

        const intersect =
            ((yi > y) !== (yj > y)) &&
            (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);

        if (intersect) {
            inside = !inside;
        }
    }

    return inside;
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