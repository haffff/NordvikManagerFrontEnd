import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import { Box, Tab, TabList, TabPanel, TabPanels, Tabs } from "@chakra-ui/react";
import useGame from "../../uiComponents/hooks/useGameHook";
import useUUID from "../../uiComponents/hooks/useUUID";
import BasePanel from "../../uiComponents/base/BasePanel";
import WebHelper from "../../../helpers/WebHelper";

export const CardPanel = ({ id, name }) => {
  const game = useGame();
  const divId = useUUID();
  const [loaded, setLoaded] = React.useState(false);

  const ctx = Dockable.useContentContext();
  ctx.setTitle(name);

  React.useEffect(() => {
    if (!divId || !document.getElementById(divId)) {
      return;
    }

    const script = document.createElement("script");
    const additionalFiles = [];

    WebHelper.get(
      "materials/getcard?id=" + id,
      (response) => {
        script.src = WebHelper.ImageAddress + response.mainResource;
        script.id = "cardScript_" + divId;
        script.async = true;
        script.divId = divId;
        script.cardId = id;
        script.type = "text/javascript";
        script.setAttribute("divId", divId);
        script.setAttribute("cardId", id);

        // Get property with additional arguments and add them as attributes
        WebHelper.get(
          "properties/QueryProperties?parentIds=" +
            id +
            "&names=additionalArguments",
          (properties) => {
            const additionalDocumentsProperty = properties[0];
            if (additionalDocumentsProperty) {
              script.setAttribute(
                "additionalArguments",
                additionalDocumentsProperty.value
              );
            }

            document.body.appendChild(script);

            response.additionalResources.forEach((additionalResource) => {
              WebHelper.get(
                "materials/ResourceMetadata?id=" + additionalResource,
                (meta) => {
                  if (meta.mimeType === "application/javascript") {
                    const additionalScript = document.createElement("script");
                    additionalScript.src =
                      WebHelper.ImageAddress + additionalResource;
                    additionalScript.async = true;
                    additionalScript.mainDivId = divId;
                    additionalScript.cardId = id;
                    document.body.appendChild(additionalScript);
                    additionalFiles.push(additionalScript);
                  }

                  if (meta.mimeType === "text/css") {
                    const link = document.createElement("link");
                    link.rel = "stylesheet";
                    link.href = WebHelper.ImageAddress + additionalResource;
                    document.head.appendChild(link);
                    additionalFiles.push(link);
                  }

                  //Is there anything more needed?
                }
              );
              setLoaded(true);
            });
          }
        );
      },
      (error) => console.log(error)
    );

    return () => {
      document.body.removeChild(script);

      additionalFiles.forEach((file) => {
        if (file.parentNode) {
          file.parentNode.removeChild(file);
        }
      });
    };
  }, [divId]);

  if (!divId) {
    return <>Loading...</>;
  }

  return (
    <BasePanel style={{ display: "flex" }} id={divId || undefined}></BasePanel>
  );
};
export default CardPanel;
