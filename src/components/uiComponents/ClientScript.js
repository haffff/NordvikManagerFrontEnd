import { useEffect } from "react";
import UtilityHelper from "../../helpers/UtilityHelper";
import WebHelper from "../../helpers/WebHelper";

const ClientScript = ({ script }) => {
    useEffect(() => {
        const url = WebHelper.ImageAddress + script;
        const scriptElement = document.createElement("script");
        scriptElement.src = url;
        scriptElement.id = "clientScript_" + UtilityHelper.GenerateUUID();
        scriptElement.async = true;
        scriptElement.type = "text/javascript";
        document.body.appendChild(scriptElement);
        return () => {
            document.body.removeChild(scriptElement);
        }
    }, []);
}

export default ClientScript;