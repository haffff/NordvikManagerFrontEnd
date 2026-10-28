const CentralSettings = {
    loadMeta(meta) {
        this.isInvitationRequired = meta.isInvitationRequired;
        this.stunServers = meta.stunServers;
        this.minBackendVersion = meta.minBackendVersion;
        this.publicGamesAllowed = meta.publicGamesAllowed;
    },

    isInvitationRequired: true,
    stunServers: [],
    minBackendVersion: null,
    publicGamesAllowed: false
}

export default CentralSettings;
