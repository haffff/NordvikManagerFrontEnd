import UtilityHelper from "./UtilityHelper";

// Safely parse JSON responses. Returns parsed object or undefined on empty/non-JSON or parse failure.
async function safeParseJsonOrUndefined(response) {
  try {
    const contentType = (response.headers && response.headers.get && response.headers.get('content-type')) || '';

    // If content type explicitly JSON, try json() first
    if (contentType.toLowerCase().includes('application/json')) {
      try {
        return await response.json();
      } catch (e) {
        // Fall through to text fallback
        console.error('WebHelper: response.json() failed, falling back to text().', e);
      }
    }

    // Fallback: read raw text and attempt to parse if non-empty
    const text = await response.text();
    if (!text) return undefined;

    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn('WebHelper: response is not valid JSON', {
        status: response.status,
        url: response.url,
        contentType,
        raw: text.slice ? text.slice(0, 2000) : text,
      });
      return undefined;
    }
  } catch (e) {
    console.error('WebHelper: failed to parse response', e);
    try {
      const fallback = await response.text();
      console.error('WebHelper: raw response body (fallback):', fallback.slice ? fallback.slice(0, 2000) : fallback);
    } catch (e2) {
      // ignore
    }
    return undefined;
  }
}

export const WebHelper = {
  ApiAddress: process.env.REACT_APP_BASE_URL
    ? (process.env.REACT_APP_PROTOCOL || "") + process.env.REACT_APP_BASE_URL + "/api"
    : "/api",
  ImageAddress: process.env.REACT_APP_BASE_URL
    ? (process.env.REACT_APP_PROTOCOL || "") + process.env.REACT_APP_BASE_URL + "/api/Materials/Resource?id="
    : "/api/Materials/Resource?id=",
  GameId: undefined,

  addGameId: (addr, customGameId = undefined) => {
    const id = customGameId || WebHelper.GameId;
    if (!id) return addr;
    if (addr.includes("?")) {
      return `${addr}&gameid=${id}`;
    }
    return `${addr}?gameid=${id}`;
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
          safeParseJsonOrUndefined(result)
            .then((parsed) => {
              if (onok) onok(parsed);
            })
            .catch((e) => {
              if (onException !== undefined) onException(e);
              else console.error(e);
            });
        } else {
          if (onerror !== undefined) onerror(result);
        }
      })
      .catch((e) => {
        if (onException !== undefined) onException(e);
        else console.error(e);      });
  },

  getAsync: async (adress) => {
    let address = WebHelper.addGameId(`${WebHelper.ApiAddress}/${adress}`);
    try {
      const result = await fetch(address, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          withCredentials: true,
        },
      });
      if (result.ok) {
        return await safeParseJsonOrUndefined(result);
      } else {
        console.warn(`WebHelper.getAsync: HTTP ${result.status} for ${address}`);
        return undefined;
      }
    } catch (e) {
      console.error(`WebHelper.getAsync: network error for ${address}`, e);
      return undefined;
    }
  },
  postAsync: async (adress, body, formData = false) => {
    let address = WebHelper.addGameId(`${WebHelper.ApiAddress}/${adress}`);

    const headers = {};
    if (!formData) {
      headers["Content-Type"] = "application/json";
    }
    headers.withCredentials = true;

    try {
      return await fetch(address, {
        body: formData ? body : JSON.stringify(body),
        method: "POST",
        credentials: "include",
        headers,
      });
    } catch (e) {
      console.error(`WebHelper.postAsync: network error for ${address}`, e);
      return undefined;
    }
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
          safeParseJsonOrUndefined(result)
            .then((parsed) => {
              if (onok) onok(parsed);
            })
            .catch((e) => {
              if (onException !== undefined) onException(e);
              else console.error(e);
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
  deleteAsync: async (adress) => {
    let address = WebHelper.addGameId(`${WebHelper.ApiAddress}/${adress}`);
    try {
      const result = await fetch(address, {
        method: "DELETE",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          withCredentials: true,
        },
      });
      if (result.ok) {
        return await safeParseJsonOrUndefined(result);
      }
      console.warn(`WebHelper.deleteAsync: HTTP ${result.status} for ${address}`);
      return undefined;
    } catch (e) {
      console.error(`WebHelper.deleteAsync: network error for ${address}`, e);
      return undefined;
    }
  },
      
  getMaterialAsync: async (id, mimeType) => {
    let address = WebHelper.getResourceString(id);
    try {
      const result = await fetch(address, {
        method: "GET",
        credentials: "include",
        headers: {
          withCredentials: true,
        },
      });
      if (result.ok) {
        if (mimeType.startsWith("text") || mimeType.startsWith("application")) {
          return await result.text();
        } else {
          return await result.blob();
        }
      }
      console.warn(`WebHelper.getMaterialAsync: HTTP ${result.status} for ${address}`);
      return undefined;
    } catch (e) {
      console.error(`WebHelper.getMaterialAsync: network error for ${address}`, e);
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
