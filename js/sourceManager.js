class SourceManager {

    constructor() {
        this.sources = null;
    }

    async load() {

        const response = await fetch("data/arcgis_sources.json");

        this.sources = await response.json();

        console.log("Loaded ArcGIS Source Database");
    }

    getStateSources(state) {

        if (!this.sources[state]) return [];

        return this.sources[state].statewide;
    }

    getCountySources(state, county) {

        if (!this.sources[state]) return [];

        return this.sources[state].counties[county] || [];
    }

    getCitySources(state, city) {

        if (!this.sources[state]) return [];

        return this.sources[state].cities[city] || [];
    }

}

const sourceManager = new SourceManager();