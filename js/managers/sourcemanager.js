class SourceManager {
    constructor() {
        this.sources = [];
    }

    async load() {
        const response = await fetch("data/sources.json");

        if (!response.ok) {
            throw new Error("Could not load data/sources.json");
        }

        const data = await response.json();
        this.sources = data.sources || [];

        console.log(`Loaded ${this.sources.length} utility source definitions.`);
    }

    getSourcesForLocation(stateName, countyName, cityName = null) {
        return this.sources.filter(source => {
            if (!source.enabled) return false;
            if (!source.coverage) return false;

            return this.sourceAppliesToLocation(
                source.coverage,
                stateName,
                countyName,
                cityName
            );
        });
    }

    sourceAppliesToLocation(coverage, stateName, countyName, cityName = null) {
        if (coverage.scope === "global") {
            return true;
        }

        if (coverage.scope === "usa" || coverage.scope === "national") {
            return true;
        }

        if (coverage.scope === "state") {
            return coverage.state === stateName;
        }

        const cleanCountyName = countyName
            ? countyName.replace(" County", "").trim()
            : "";

        if (coverage.scope === "county") {
            if (coverage.state && coverage.state !== stateName) {
                return false;
            }

            return Array.isArray(coverage.counties) &&
                coverage.counties.includes(cleanCountyName);
        }

        if (coverage.scope === "city") {
            if (coverage.state && coverage.state !== stateName) {
                return false;
            }

            return cityName &&
                Array.isArray(coverage.cities) &&
                coverage.cities.includes(cityName);
        }

        return false;
    }
}

const sourceManager = new SourceManager();