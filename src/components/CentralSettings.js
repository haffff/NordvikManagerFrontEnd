const CentralSettings = {
    loadMeta(meta) {
        this.isInvitationRequired = meta.isInvitationRequired;
        this.stunServers = meta.stunServers;
        this.turnServer = meta.turnServer;
        this.minBackendVersion = meta.minBackendVersion;
        this.publicGamesAllowed = meta.publicGamesAllowed;
    },

    isInvitationRequired: true,
    stunServers: [],
    turnServer: null,
    minBackendVersion: null,
    publicGamesAllowed: false
}

export default CentralSettings;
