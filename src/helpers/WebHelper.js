import UtilityHelper from "./UtilityHelper";

export const WebHelper = {
  ApiAddress: process.env.REACT_APP_PROTOCOL + process.env.REACT_APP_BASE_URL + "/api",
  WebSocketAddress: "wss://" + process.env.REACT_APP_BASE_URL + "/api/battlemap/ws",
  ImageAddress: process.env.REACT_APP_PROTOCOL + process.env.REACT_APP_BASE_URL + "/api/Materials/Resource?id=",
  GameId: undefined,

  addGameId: (addr, customGameId = undefined) => {
    if (addr.includes("?")) {
      return `${addr}&gameid=${customGameId || WebHelper.GameId}`;
    }
    return `${addr}?gameid=${customGameId || WebHelper.GameId}`;
  },

  post: (adress, body, onok, onerror, onException) => {
    let address = WebHelper.addGameId(`${WebHelper.ApiAddress}/${adress}`);
    return fetch(address, {
      body: JSON.stringify(body),
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        withCredentials: true,
      },
    })
      .then((result) => {
        if (result.ok) {
          //if (result.bodyUsed)
          result.json().then((jsonData) => onok(jsonData));
          //else
          //    onok({});
        } else {
          if (onerror !== undefined) onerror(result);
        }
      })
      .catch((e) => {
        if (onException !== undefined) onException(e);
        else console.error(e);
      });
  },

  getAsync: async (adress) => {
    let address = WebHelper.addGameId(`${WebHelper.ApiAddress}/${adress}`);
    const result = await fetch(address, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        withCredentials: true,
      },
    });
    if (result.ok) {
      return await result.json();
    } else {
      return undefined;
    }
  },

  postAsync: async (adress, body, formData = false) => {
    let address = WebHelper.addGameId(`${WebHelper.ApiAddress}/${adress}`);

    const headers = {};
    if(!formData) {
      headers["Content-Type"] = "application/json";
    }

    headers.withCredentials = true;

    return await fetch(address, {
      body: formData ? body : JSON.stringify(body),
      method: "POST",
      credentials: "include",
      headers
    });
  },

  get: (adress, onok, onerror, onException) => {
    let address = WebHelper.addGameId(`${WebHelper.ApiAddress}/${adress}`);
    fetch(address, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        withCredentials: true,
      },
    })
      .then((result) => {
        if (result.ok) {
          result.json().then((jsonData) => {
            if (onok) onok(jsonData);
          });
        } else {
          if (onerror !== undefined) {
            onerror(result);
          }
        }
      })
      .catch((e) => {
        if (onException !== undefined) onException(e);
        else console.error(e);
      });
  },

  deleteAsync: async (adress, onok, onerror, onException) => {

    let address = WebHelper.addGameId(`${WebHelper.ApiAddress}/${adress}`);

    let result = await fetch(address, {
      method: "DELETE",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        withCredentials: true,
      },
    });

    if (result.ok) {
      return await result.json();
    }

    return undefined;
  },
      

  getMaterialAsync: async (id, mimeType) => {
    let address = this.getResourceString(id);

    const result = await fetch(address, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": mimeType,
        withCredentials: true,
      },
    });

    if (result.ok) {
      if (mimeType.startsWith("text") || mimeType.startsWith("application")) {
        return await result.text();
      } else {
        return await result.blob();
      }
    } else {
      return undefined;
    }
  },

  getMaterial: (id, mimeType, onok, onerror, onException) => {
    let address = WebHelper.getResourceString(id);
    return fetch(address, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": mimeType,
        withCredentials: true,
      },
    })
      .then((result) => {
        if (result.ok) {
          if (
            mimeType.startsWith("text") ||
            mimeType.startsWith("application")
          ) {
            result.text().then((text) => onok(text));
          } else {
            result.blob().then((blob) => onok(blob));
          }
        } else {
          if (onerror !== undefined) onerror(result);
        }
      })
      .catch((e) => {
        if (onException !== undefined) onException(e);
        else console.error(e);
      });
  },

  getNoResp: (adress, onok, onerror, onException) => {
    let address = WebHelper.addGameId(`${WebHelper.ApiAddress}/${adress}`);
    return fetch(address, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        withCredentials: true,
      },
    })
      .then((result) => {
        if (result.ok) {
          onok();
        } else {
          if (onerror !== undefined) onerror(result);
        }
      })
      .catch((e) => {
        if (onException !== undefined) onException(e);
        else console.error(e);
      });
  },

  getNoRespAsync: async (adress) => {
    let address = WebHelper.addGameId(`${WebHelper.ApiAddress}/${adress}`);
    return await fetch(address, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        withCredentials: true,
      },
    });
  },

  postMaterial: (file, onok, onerror, onException) => {
    let obj = {};
    console.log(`${file.name}`);
    UtilityHelper.ConvertBlobToB64(file).then((result) => {
      obj.Name = file.name;
      obj.Data = result;
      obj.GameID = WebHelper.GameId;
      obj.MimeType = file.type.toString();
      return WebHelper.post(
        "Materials/AddResource",
        obj,
        onok,
        onerror,
        onException
      );
    });
  },

  getResourceString: (id, key, gameId = undefined) => {
    if ((id === undefined || id === null) && (key === undefined || key === null)) {
      key = "emptyImage";
    }

    const keyStr = key ? `key=${key}` : "";
    const idStr = id ? `id=${id}` : "";
    return WebHelper.addGameId(`${WebHelper.ApiAddress}/Materials/Resource?${idStr || keyStr}`, gameId);
  },
};

export default WebHelper;
