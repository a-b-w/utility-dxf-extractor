class ArcGISProvider {

    constructor() {
        this.id = "arcgis";
        this.name = "ArcGIS REST";
    }

    async query(source, boundary, options = {}) {
        console.log("ArcGIS provider queried:", source.name);

        // Real FeatureServer query logic comes next.
        return {
            type: "FeatureCollection",
            features: []
        };
    }
}

const arcgisProvider = new ArcGISProvider();

providerManager.register(arcgisProvider);