import WebSocketManagerInstance from "../../game/WebSocketManager";
import { fabric } from 'fabric';
import DTOConverter from "../DTOConverter";
import WebHelper from "./WebHelper";

class PropertiesHelper {
    panel = "properties";
    contextId = "properties";
    id = "PropertiesHelper";


    
    GetByNames(parent, names, callback) {
        return WebHelper.get(`properties/QueryProperties?parentIds=${parent}&names=${names.join(',')}`, (response) => {
            if (callback) {
                callback(response);
            }

            resolve(response);
        }, (error) => {
            reject();
        }, (exc) => {
            reject();
        });
    }

    GetByIds(parent, ids, callback) {
        return WebHelper.get(`properties/QueryProperties?parentIds=${parent}&ids=${ids.join(',')}`, (response) => {
            if (callback) {
                callback(response);
            }

            resolve(response);
        }, (error) => {
            reject();
        }, (exc) => {
            reject();
        });
    }
}

const PropertiesHelperInstance = new PropertiesHelper();

export default PropertiesHelperInstance;
