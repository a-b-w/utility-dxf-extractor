class ProviderManager {

    constructor() {
        this.providers = {};
    }

    register(provider) {

    this.providers[provider.id] = provider;

    console.log(
        `✅ Registered provider: ${provider.id} (${provider.name})`
    );

}

    get(id) {

        return this.providers[id];

    }

    async query(source, boundary, options = {}) {

        const provider = this.get(source.type);

        if (!provider) {

            console.warn(`Provider "${source.type}" not found.`);

            return [];

        }

        return await provider.query(source, boundary, options);

    }

}

const providerManager = new ProviderManager();