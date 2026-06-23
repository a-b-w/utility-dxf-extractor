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