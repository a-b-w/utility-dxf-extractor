const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            osm: {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© OpenStreetMap'
            }
        },
        layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
    },
    center: [-97.7431, 30.2672],
    zoom: 8
});

const kmlFileInput = document.getElementById('kmlFile');
const resultsDiv = document.getElementById('results');
const projectionSelect = document.getElementById('projectionSelect');
const findUtilitiesBtn = document.getElementById('findUtilitiesBtn');

let boundaryGeoJson = null;
let utilitiesGeoJson = null;
let statePlaneZones = [];
let countyBoundaries = [];
let projectionOptions = [];

map.on('load', async () => {
    addMapLayers();

    try {
        await loadProjectionOptions();
        setupProjectionSearch();
        await loadStatePlaneZones();
        await loadCountyBoundaries();
        await sourceManager.load();

        resultsDiv.textContent = 'Ready. Upload a KML/KMZ boundary.';
    } catch (error) {
        console.error(error);
        resultsDiv.textContent = `Startup Error: ${error.message}`;
    }
});

kmlFileInput.addEventListener('change', async () => {
    const file = kmlFileInput.files[0];
    if (!file) return;

    try {
        resultsDiv.textContent = 'Reading boundary file...';

        const kmlText = await readKmlOrKmz(file);
        boundaryGeoJson = parseKmlPolygons(kmlText);
        utilitiesGeoJson = null;

        map.getSource('utilities').setData(emptyFeatureCollection());

        if (boundaryGeoJson.features.length === 0) {
            resultsDiv.textContent = 'No polygon area shapes found in this file.';
            return;
        }

        map.getSource('boundary').setData(boundaryGeoJson);
        zoomToGeoJson(boundaryGeoJson);

        const detectedZone = detectStatePlaneZone(boundaryGeoJson);
        const detectedCounty = detectCounty(boundaryGeoJson);
        const detectedCounties = detectCounties(boundaryGeoJson);
        const localSources = getSourcesForCounties(detectedCounties);

        const projection = chooseProjectionFromZone(detectedZone);
        setProjectionSearchValue(projection);

        const zoneText = detectedZone
            ? `Detected Zone: ${detectedZone.zoneName}\nFIPS: ${detectedZone.fipsZone}\nSuggested Projection: ${projection.label}`
            : `No State Plane zone detected.\nSuggested Projection: ${projection.label}`;

        const countyText = detectedCounties.length
            ? `Counties detected: ${detectedCounties.map(county => `${county.namelsad}, ${county.stusab}`).join('; ')}`
            : detectedCounty
                ? `County: ${detectedCounty.namelsad}\nState: ${detectedCounty.state_name}\nCounty GEOID: ${detectedCounty.geoid}`
                : 'County: Unknown';

        const sourceText = `Configured local sources: ${localSources.length}`;

        resultsDiv.textContent =
            `Loaded file: ${file.name}\n` +
            `Area polygons found: ${boundaryGeoJson.features.length}\n\n` +
            countyText +
            `\n\n` +
            sourceText +
            `\n\n` +
            zoneText;

    } catch (error) {
        console.error(error);
        resultsDiv.textContent = `Error: ${error.message}`;
    }
});

findUtilitiesBtn.addEventListener('click', async () => {
    try {
        const mode = getSearchMode();

        if (mode === 'boundary' && (!boundaryGeoJson || boundaryGeoJson.features.length === 0)) {
            resultsDiv.textContent = 'Upload a KML/KMZ boundary first, or switch Search Area to Current Map View.';
            return;
        }

        resultsDiv.textContent = `Querying utility sources using ${mode === 'boundary' ? 'boundary' : 'current map view'}...`;

        utilitiesGeoJson = await runUtilitySources(mode);
        map.getSource('utilities').setData(utilitiesGeoJson);

        const counts = countUtilities(utilitiesGeoJson);

        resultsDiv.textContent =
            `Utilities found:\n\n` +
            `Transmission lines: ${counts.lines}\n` +
            `Towers: ${counts.towers}\n` +
            `Poles: ${counts.poles}\n` +
            `Substations: ${counts.substations}\n` +
            `Transformers: ${counts.transformers}\n` +
            `Other power features: ${counts.other}\n\n` +
            `Preview added to map.`;

    } catch (error) {
        console.error(error);
        resultsDiv.textContent = `Utility Search Error: ${error.message}`;
    }
});

function addMapLayers() {
    map.addSource('boundary', { type: 'geojson', data: emptyFeatureCollection() });

    map.addLayer({
        id: 'boundary-fill',
        type: 'fill',
        source: 'boundary',
        paint: { 'fill-color': '#0077ff', 'fill-opacity': 0.20 }
    });

    map.addLayer({
        id: 'boundary-outline',
        type: 'line',
        source: 'boundary',
        paint: { 'line-color': '#003cff', 'line-width': 3 }
    });

    map.addSource('utilities', { type: 'geojson', data: emptyFeatureCollection() });

    map.addLayer({
        id: 'utility-lines',
        type: 'line',
        source: 'utilities',
        filter: [
            'all',
            ['==', ['geometry-type'], 'LineString'],
            ['in', ['get', 'power'], ['literal', ['line', 'minor_line', 'cable']]]
        ],
        paint: {
            'line-color': '#ff0000',
            'line-width': 3
        }
    });

    map.addLayer({
        id: 'utility-substations',
        type: 'fill',
        source: 'utilities',
        filter: [
            'all',
            ['==', ['geometry-type'], 'Polygon'],
            ['==', ['get', 'power'], 'substation']
        ],
        paint: {
            'fill-color': '#0066ff',
            'fill-opacity': 0.35
        }
    });

    map.addLayer({
        id: 'utility-substation-outlines',
        type: 'line',
        source: 'utilities',
        filter: [
            'all',
            ['==', ['geometry-type'], 'Polygon'],
            ['==', ['get', 'power'], 'substation']
        ],
        paint: {
            'line-color': '#003399',
            'line-width': 2
        }
    });

    map.addLayer({
        id: 'utility-poles',
        type: 'circle',
        source: 'utilities',
        filter: [
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'power'], 'pole']
        ],
        paint: {
            'circle-radius': 4,
            'circle-color': '#ffff00',
            'circle-stroke-color': '#000000',
            'circle-stroke-width': 1
        }
    });

    map.addLayer({
        id: 'utility-towers',
        type: 'circle',
        source: 'utilities',
        filter: [
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['==', ['get', 'power'], 'tower']
        ],
        paint: {
            'circle-radius': 5,
            'circle-color': '#00b894',
            'circle-stroke-color': '#005bbb',
            'circle-stroke-width': 2
        }
    });

    map.addLayer({
        id: 'utility-other-points',
        type: 'circle',
        source: 'utilities',
        filter: [
            'all',
            ['==', ['geometry-type'], 'Point'],
            ['!', ['in', ['get', 'power'], ['literal', ['pole', 'tower']]]]
        ],
        paint: {
            'circle-radius': 4,
            'circle-color': '#ff8800',
            'circle-stroke-color': '#000000',
            'circle-stroke-width': 1
        }
    });

    map.addLayer({
        id: 'utility-other-polygons',
        type: 'fill',
        source: 'utilities',
        filter: [
            'all',
            ['==', ['geometry-type'], 'Polygon'],
            ['!=', ['get', 'power'], 'substation']
        ],
        paint: {
            'fill-color': '#ff8800',
            'fill-opacity': 0.25
        }
    });
}

/*
    INTERNAL SOURCE MANAGER

    UI stays simple.
    Behind the scenes, all sources should plug into this array.

    Current source:
    - OSM / Overpass

    Future sources:
    - HIFLD transmission
    - HIFLD substations
    - ArcGIS FeatureServer sources
    - user-supplied data
*/
async function runUtilitySources(mode) {
    const detectedCounties = boundaryGeoJson
        ? detectCounties(boundaryGeoJson)
        : [];

    const applicableSources = getSourcesForCounties(detectedCounties);

    const sourceResults = [];

    for (const source of applicableSources) {
        resultsDiv.textContent =
            `Querying ${source.name} using ${mode === "boundary" ? "boundary" : "current map view"}...`;

        const result = await providerManager.query(
            source,
            boundaryGeoJson,
            {
                mode,
                map,
                resultsDiv
            }
        );

        sourceResults.push(result);
    }

    const merged = mergeFeatureCollections(sourceResults);
    const deduped = dedupeUtilityFeatures(merged);

    return deduped;
}

function getSourcesForCounties(counties) {
    const sourceMap = new Map();

    if (!counties || counties.length === 0) {
        const globalSources = sourceManager.getSourcesForLocation(null, null);

        globalSources.forEach(source => {
            sourceMap.set(source.id, source);
        });

        return Array.from(sourceMap.values());
    }

    counties.forEach(county => {
        const countySources = sourceManager.getSourcesForLocation(
            county.state_name,
            county.namelsad
        );

        countySources.forEach(source => {
            sourceMap.set(source.id, source);
        });
    });

    return Array.from(sourceMap.values());
}

function mergeFeatureCollections(collections) {
    const features = [];

    collections.forEach(collection => {
        if (!collection || !Array.isArray(collection.features)) return;
        features.push(...collection.features);
    });

    return {
        type: 'FeatureCollection',
        features
    };
}

function dedupeUtilityFeatures(geojson) {
    const seen = new Set();
    const features = [];

    geojson.features.forEach(feature => {
        const key = makeFeatureKey(feature);

        if (!seen.has(key)) {
            seen.add(key);
            features.push(feature);
        }
    });

    return {
        type: 'FeatureCollection',
        features
    };
}

function makeFeatureKey(feature) {
    const geometry = feature.geometry;
    const power = feature.properties.power || 'unknown';
    const sourceId = feature.properties.id || feature.properties.osm_id || '';

    if (sourceId) {
        return `${power}|${sourceId}`;
    }

    if (geometry.type === 'Point') {
        const lon = Number(geometry.coordinates[0]).toFixed(6);
        const lat = Number(geometry.coordinates[1]).toFixed(6);
        return `${power}|point|${lon}|${lat}`;
    }

    if (geometry.type === 'LineString') {
        const first = geometry.coordinates[0];
        const last = geometry.coordinates[geometry.coordinates.length - 1];

        return [
            power,
            geometry.type,
            first[0].toFixed(5),
            first[1].toFixed(5),
            last[0].toFixed(5),
            last[1].toFixed(5),
            geometry.coordinates.length
        ].join('|');
    }

    if (geometry.type === 'Polygon') {
        const ring = geometry.coordinates[0];
        const first = ring[0];

        return [
            power,
            geometry.type,
            first[0].toFixed(5),
            first[1].toFixed(5),
            ring.length
        ].join('|');
    }

    return `${power}|${JSON.stringify(geometry)}`;
}

async function loadProjectionOptions() {
    const response = await fetch('data/projections.json');

    if (!response.ok) {
        throw new Error('Could not load data/projections.json');
    }

    projectionOptions = await response.json();

    if (!Array.isArray(projectionOptions) || projectionOptions.length === 0) {
        throw new Error('Projection list is empty or invalid.');
    }
}

function setupProjectionSearch() {
    const wrapper = document.createElement('div');
    const searchInput = document.createElement('input');

    searchInput.id = 'projectionSearch';
    searchInput.setAttribute('list', 'projectionList');
    searchInput.placeholder = 'Search EPSG, FIPS, or State Plane zone';

    const defaultProjection = projectionOptions.find(p => p.epsg === '4326') || projectionOptions[0];
    searchInput.value = defaultProjection.label;

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
    if (input && projection) input.value = projection.label;
}

function getSelectedProjection() {
    const input = document.getElementById('projectionSearch');
    if (!input) return projectionOptions[0];

    return projectionOptions.find(option => option.label === input.value) ||
        projectionOptions.find(option => option.epsg === '4326') ||
        projectionOptions[0];
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

async function loadCountyBoundaries() {
    const response = await fetch('data/us_county_boundaries.zip');

    if (!response.ok) {
        throw new Error('Could not load data/us_county_boundaries.zip');
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const kmlFileName = Object.keys(zip.files).find(name =>
        name.toLowerCase().endsWith('.kml')
    );

    if (!kmlFileName) {
        throw new Error('County ZIP did not contain a KML file.');
    }

    const kmlText = await zip.files[kmlFileName].async('text');
    countyBoundaries = parseCountyKml(kmlText);

    console.log(`Loaded ${countyBoundaries.length} counties from ZIP.`);
}

function parseCountyKml(kmlText) {
    const xmlDoc = new DOMParser().parseFromString(kmlText, 'text/xml');
    const placemarks = xmlDoc.getElementsByTagName('Placemark');
    const counties = [];

    for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i];
        const polygonNode = placemark.getElementsByTagName('Polygon')[0];
        if (!polygonNode) continue;

        const coordinatesNode = polygonNode.getElementsByTagName('coordinates')[0];
        if (!coordinatesNode) continue;

        const coordinates = parseKmlCoordinateText(coordinatesNode.textContent);
        if (coordinates.length < 4) continue;

        closeRingIfNeeded(coordinates);

        counties.push({
            geoid: getSimpleDataValue(placemark, 'geoid') || getSimpleDataValue(placemark, 'GEOID'),
            countyfp: getSimpleDataValue(placemark, 'countyfp') || getSimpleDataValue(placemark, 'COUNTYFP'),
            name: getSimpleDataValue(placemark, 'name') || getSimpleDataValue(placemark, 'NAME') || getPlacemarkName(placemark),
            namelsad: getSimpleDataValue(placemark, 'namelsad') || getSimpleDataValue(placemark, 'NAMELSAD') || getPlacemarkName(placemark),
            stusab: getSimpleDataValue(placemark, 'stusab') || getSimpleDataValue(placemark, 'STUSAB'),
            state_name: getSimpleDataValue(placemark, 'state_name') || getSimpleDataValue(placemark, 'STATE_NAME'),
            coordinates
        });
    }

    return counties;
}

function chooseProjectionFromZone(zone) {
    if (!zone) {
        return projectionOptions.find(option => option.epsg === '4326') || projectionOptions[0];
    }

    return projectionOptions.find(option => option.fips === zone.fipsZone) ||
        projectionOptions.find(option => option.epsg === '4326') ||
        projectionOptions[0];
}

function getSearchMode() {
    const selected = document.querySelector('input[name="searchMode"]:checked');
    return selected ? selected.value : 'boundary';
}

async function queryOverpassByBoundary(boundaryGeoJson) {
    const polygonQueries = boundaryGeoJson.features.map(feature => {
        const ring = feature.geometry.coordinates[0];
        const polyString = ring.map(coord => `${coord[1]} ${coord[0]}`).join(' ');

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
    }).join('\n');

    return await runOverpassQuery(`
[out:json][timeout:120];
(
${polygonQueries}
);
out body;
>;
out skel qt;
`);
}

async function queryOverpassByMapView() {
    const b = map.getBounds();
    const south = b.getSouth();
    const west = b.getWest();
    const north = b.getNorth();
    const east = b.getEast();

    return await runOverpassQuery(`
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
`);
}

async function runOverpassQuery(query, attempt = 1) {
    console.log(`Overpass attempt ${attempt}:`, query);

    try {
        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: new URLSearchParams({
                data: query
            })
        });

        if (!response.ok) {
            if ((response.status === 504 || response.status === 429 || response.status === 502 || response.status === 503) && attempt < 3) {
                resultsDiv.textContent = `Overpass was busy or timed out. Retrying attempt ${attempt + 1} of 3...`;
                await sleep(2000 * attempt);
                return await runOverpassQuery(query, attempt + 1);
            }

            throw new Error(`Overpass request failed with status ${response.status}`);
        }

        const json = await response.json();

        console.log('Overpass raw result:', json);
        console.log('Raw elements returned:', json.elements ? json.elements.length : 0);

        return json;

    } catch (error) {
        if (attempt < 3) {
            resultsDiv.textContent = `Overpass request failed. Retrying attempt ${attempt + 1} of 3...`;
            await sleep(2000 * attempt);
            return await runOverpassQuery(query, attempt + 1);
        }

        throw error;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function readKmlOrKmz(file) {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.kml')) return await file.text();

    if (fileName.endsWith('.kmz')) {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);

        const kmlFileName = Object.keys(zip.files).find(name =>
            name.toLowerCase().endsWith('.kml')
        );

        if (!kmlFileName) throw new Error('KMZ did not contain a KML file.');

        return await zip.files[kmlFileName].async('text');
    }

    throw new Error('Please upload a KML or KMZ file.');
}

function parseKmlPolygons(kmlText) {
    const xmlDoc = new DOMParser().parseFromString(kmlText, 'text/xml');
    const polygonNodes = xmlDoc.getElementsByTagName('Polygon');
    const features = [];

    for (let i = 0; i < polygonNodes.length; i++) {
        const coordinatesNode = polygonNodes[i].getElementsByTagName('coordinates')[0];
        if (!coordinatesNode) continue;

        const coordinates = parseKmlCoordinateText(coordinatesNode.textContent);
        if (coordinates.length < 4) continue;

        closeRingIfNeeded(coordinates);

        features.push({
            type: 'Feature',
            properties: { source: 'KML Polygon', index: i + 1 },
            geometry: { type: 'Polygon', coordinates: [coordinates] }
        });
    }

    return { type: 'FeatureCollection', features };
}

function parseStatePlaneZoneKml(kmlText) {
    const xmlDoc = new DOMParser().parseFromString(kmlText, 'text/xml');
    const placemarks = xmlDoc.getElementsByTagName('Placemark');
    const zones = [];

    for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i];
        const polygonNode = placemark.getElementsByTagName('Polygon')[0];
        if (!polygonNode) continue;

        const coordinatesNode = polygonNode.getElementsByTagName('coordinates')[0];
        if (!coordinatesNode) continue;

        const coordinates = parseKmlCoordinateText(coordinatesNode.textContent);
        if (coordinates.length < 4) continue;

        closeRingIfNeeded(coordinates);

        zones.push({
            zoneName: getSimpleDataValue(placemark, 'ZONENAME') || getPlacemarkName(placemark) || 'Unknown Zone',
            fipsZone: getSimpleDataValue(placemark, 'FIPSZONE') || '',
            zone: getSimpleDataValue(placemark, 'ZONE') || '',
            coordinates
        });
    }

    return zones;
}

function overpassToGeoJson(overpassJson) {
    const nodes = new Map();
    const features = [];

    overpassJson.elements.forEach(element => {
        if (element.type === 'node' && Number.isFinite(element.lon) && Number.isFinite(element.lat)) {
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

        if (element.type === 'node' && tags.power) {
            features.push({
                type: 'Feature',
                properties: tags,
                geometry: { type: 'Point', coordinates: [element.lon, element.lat] }
            });
        }

        if (element.type === 'way' && tags.power && Array.isArray(element.nodes)) {
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
                    type: 'Feature',
                    properties: tags,
                    geometry: isClosed
                        ? { type: 'Polygon', coordinates: [coordinates] }
                        : { type: 'LineString', coordinates }
                });
            }
        }
    });

    return { type: 'FeatureCollection', features };
}

function countUtilities(geojson) {
    const counts = {
        lines: 0,
        towers: 0,
        poles: 0,
        substations: 0,
        transformers: 0,
        other: 0
    };

    geojson.features.forEach(feature => {
        const power = feature.properties.power;

        if (power === 'line' || power === 'minor_line' || power === 'cable') counts.lines++;
        else if (power === 'tower') counts.towers++;
        else if (power === 'pole') counts.poles++;
        else if (power === 'substation') counts.substations++;
        else if (power === 'transformer') counts.transformers++;
        else counts.other++;
    });

    return counts;
}

function parseKmlCoordinateText(text) {
    return text.trim().split(/\s+/).map(pair => {
        const parts = pair.split(',');
        return [parseFloat(parts[0]), parseFloat(parts[1])];
    }).filter(coord => Number.isFinite(coord[0]) && Number.isFinite(coord[1]));
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
        if (simpleDataNodes[i].getAttribute('name') === fieldName) {
            return simpleDataNodes[i].textContent.trim();
        }
    }

    return '';
}

function getPlacemarkName(placemark) {
    const nameNode = placemark.getElementsByTagName('name')[0];
    return nameNode ? nameNode.textContent.trim() : '';
}

function detectStatePlaneZone(boundaryGeoJson) {
    if (!statePlaneZones.length) return null;

    const centroid = getGeoJsonCentroid(boundaryGeoJson);

    for (const zone of statePlaneZones) {
        if (pointInPolygon(centroid, zone.coordinates)) return zone;
    }

    return null;
}

function detectCounty(boundaryGeoJson) {
    const counties = detectCounties(boundaryGeoJson);

    if (counties.length > 0) {
        return counties[0];
    }

    return null;
}

function detectCounties(boundaryGeoJson) {
    if (!countyBoundaries.length || !boundaryGeoJson) {
        return [];
    }

    const matched = [];

    for (const county of countyBoundaries) {
        if (boundaryTouchesCounty(boundaryGeoJson, county)) {
            matched.push(county);
        }
    }

    return matched;
}

function boundaryTouchesCounty(boundaryGeoJson, county) {
    for (const feature of boundaryGeoJson.features) {
        const rings = getFeatureRings(feature);

        for (const ring of rings) {
            if (ring.some(coord => pointInPolygon(coord, county.coordinates))) {
                return true;
            }

            if (county.coordinates.some(coord => pointInPolygon(coord, ring))) {
                return true;
            }

            if (ringsIntersect(ring, county.coordinates)) {
                return true;
            }
        }
    }

    return false;
}

function getFeatureRings(feature) {
    if (!feature || !feature.geometry) {
        return [];
    }

    if (feature.geometry.type === 'Polygon') {
        return feature.geometry.coordinates;
    }

    if (feature.geometry.type === 'MultiPolygon') {
        return feature.geometry.coordinates.flat();
    }

    return [];
}

function ringsIntersect(ringA, ringB) {
    for (let i = 0; i < ringA.length - 1; i++) {
        for (let j = 0; j < ringB.length - 1; j++) {
            if (lineSegmentsIntersect(ringA[i], ringA[i + 1], ringB[j], ringB[j + 1])) {
                return true;
            }
        }
    }

    return false;
}

function lineSegmentsIntersect(a, b, c, d) {
    const denominator =
        ((d[1] - c[1]) * (b[0] - a[0])) -
        ((d[0] - c[0]) * (b[1] - a[1]));

    if (denominator === 0) {
        return false;
    }

    const ua =
        (((d[0] - c[0]) * (a[1] - c[1])) -
        ((d[1] - c[1]) * (a[0] - c[0]))) /
        denominator;

    const ub =
        (((b[0] - a[0]) * (a[1] - c[1])) -
        ((b[1] - a[1]) * (a[0] - c[0]))) /
        denominator;

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
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

    return [totalX / totalCount, totalY / totalCount];
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

        if (intersect) inside = !inside;
    }

    return inside;
}

function zoomToGeoJson(geojson) {
    const bounds = new maplibregl.LngLatBounds();

    geojson.features.forEach(feature => {
        feature.geometry.coordinates.forEach(ring => {
            ring.forEach(coord => bounds.extend(coord));
        });
    });

    map.fitBounds(bounds, { padding: 60, duration: 1000 });
}

function emptyFeatureCollection() {
    return { type: 'FeatureCollection', features: [] };
}