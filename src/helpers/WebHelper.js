import UtilityHelper from './UtilityHelper';

export const WebHelper = {
    ApiAddress: "https://dndmanagerdev.local/api",
    WebSocketAddress: "wss://dndmanagerdev.local/api",
    CardAddress: "http://card.dndmanagerdev.local",
    ImageAddress: `https://dndmanagerdev.local/api/Materials/Resource?id=`,
    GameId: undefined,

    addGameId: (addr) => {
        if(addr.includes("?"))
        {
            return `${addr}&gameid=${WebHelper.GameId}`;
        }
        return `${addr}?gameid=${WebHelper.GameId}`;
    },

    post: (adress, body, onok, onerror, onException) => {
        let address = WebHelper.addGameId(`${WebHelper.ApiAddress}/${adress}`);
        fetch(address, {
            body: JSON.stringify(body), method: "POST", credentials: "include", headers: {
                'Content-Type': 'application/json', 
                withCredentials: true
            }
        }).then((result) => {
            if (result.ok) {
                //if (result.bodyUsed)
                result.json().then(jsonData => onok(jsonData))
                //else
                //    onok({});
            }
            else {
                if (onerror !== undefined)
                    onerror(result);
            }
        }).catch((e) => {
            if (onException !== undefined)
                onException(e);
            else
                console.error(e);
        });
    },

    get: (adress, onok, onerror, onException) => {
        let address = WebHelper.addGameId(`${WebHelper.ApiAddress}/${adress}`);
        fetch(address, { 
            method: "GET", 
            credentials: "include", 
            headers: { 
                'Content-Type': 'application/json', 
                withCredentials: true
            } }).then((result) => {
            if (result.ok) {
                result.json().then(jsonData => onok(jsonData));
            }
            else {
                if (onerror !== undefined)
                    onerror(result);
            }
        }).catch((e) => {
            if (onException !== undefined)
                onException(e);
            else
                console.error(e);
        });
    },

    getMaterial: (id, mimeType, onok, onerror, onException) => {
        let address = WebHelper.addGameId(`${WebHelper.ApiAddress}/materials/Resource?id=${id}`);
        fetch(address, { method: "GET", credentials: "include", 
        headers: { 
            'Content-Type': mimeType, 
            withCredentials: true } }).then((result) => {
            if (result.ok) {
                if(mimeType.startsWith("text") || mimeType.startsWith("application"))
                {
                    result.text().then(text => onok(text));
                }
                else
                {
                    result.blob().then(blob => onok(blob));
                }
            }
            else {
                if (onerror !== undefined)
                    onerror(result);
            }
        }).catch((e) => {
            if (onException !== undefined)
                onException(e);
            else
                console.error(e);
        });
    },


    getNoResp: (adress, onok, onerror, onException) => {
        let address = WebHelper.addGameId(`${WebHelper.ApiAddress}/${adress}`);
        fetch(address, { method: "GET", credentials: "include", headers: { 
            'Content-Type': 'application/json', 
            withCredentials: true
        } }).then((result) => {
            if (result.ok) {
                onok();
            }
            else {
                if (onerror !== undefined)
                    onerror(result);
            }
        }).catch((e) => {
            if (onException !== undefined)
                onException(e);
            else
                console.error(e);
        });
    },

    postMaterial: (file, path, onok, onerror, onException) => {
        let obj = {};
        console.log(`${file.name}`);
        UtilityHelper.ConvertBlobToB64(file).then(result => {
            obj.Name = file.name;
            obj.Path = path;
            obj.Data = result;
            obj.GameID = WebHelper.GameId;
            obj.MimeType = file.type.toString();
            WebHelper.post("Materials/AddResource", obj, onok, onerror, onException);
        });
    }
}

export default WebHelper;