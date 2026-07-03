class SourceManager {
    constructor() {
        this.sources = {};
    }

    async load() {
        const response = await fetch("data/arcgis_sources.json");

        if (!response.ok) {
            throw new Error("Could not load data/arcgis_sources.json");
        }

        this.sources = await response.json();

        console.log("Loaded ArcGIS Source Database");
    }

    getSourcesForLocation(stateName, countyName) {
        if (!stateName || !countyName) return [];

        const stateBlock = this.sources[stateName];

        if (!stateBlock) return [];

        const statewide = stateBlock.statewide || [];

        const cleanCountyName = countyName
            .replace(" County", "")
            .trim();

        const countySources =
            stateBlock.counties?.[cleanCountyName] || [];

        return [
            ...statewide,
            ...countySources
        ];
    }
}

const sourceManager = new SourceManager();