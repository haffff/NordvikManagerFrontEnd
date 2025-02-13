class GameData {
    maps = undefined;
    players = undefined;
    layouts = undefined;
    defaultLayout = undefined;
}

class GameDataManger {
    Load(gameData) {
        let clone = structuredClone(gameData)
        this.Game = clone;
        // this.Game.players = clone.players;
        // this.Game.maps = clone.maps;
        // this.Game.layouts = clone.layouts;
        // this.Game.defaultLayout = clone.layouts;
        this.CurrentPlayer = () => this.Game.players.filter(x => x.id === this.CurrentPlayerId)[0];
    }

    GetConnectedPlayers() {
        return this.ConnectedPlayers;
    }

    Game = undefined;
    CurrentPlayerId = undefined;
    CurrentPlayer = undefined;
    ConnectedPlayers = undefined;
    ContainerRef = undefined;
}

export default GameDataManger;
