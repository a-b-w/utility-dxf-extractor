class OSMProvider {

    constructor() {

        this.id = "osm";

        this.name = "OpenStreetMap";

    }

    async query(source, boundary, options = {}) {

        console.log("OSM provider queried.");

        return [];

    }

}

const osmProvider = new OSMProvider();

providerManager.register(osmProvider);