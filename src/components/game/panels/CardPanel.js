import * as React from "react";
import * as Dockable from "@hlorenzi/react-dockable";
import { Box, Tab, TabList, TabPanel, TabPanels, Tabs } from "@chakra-ui/react";
import useGame from "../../uiComponents/hooks/useGameHook";
import useUUID from "../../uiComponents/hooks/useUUID";
import WebHelper from "../../../helpers/WebHelper";

export const CardPanel = ({ gameDataManagerRef, state, id, name }) => {
  const game = useGame();
  const divId = useUUID();

  const ctx = Dockable.useContentContext();
  ctx.setTitle(name);

  React.useEffect(() => {
    if (!divId) {
      return;
    }

    const script = document.createElement("script");
    const additionalFiles = [];

    WebHelper.get(
      "materials/getcard?id=" + id,
      (response) => {
        script.src = WebHelper.ImageAddress + response.mainResource;
        script.async = true;
        script.divId = divId;
        script.type = "text/javascript";
        script.setAttribute("divId", divId);
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
        });
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

  if (!game) {
    return <>Loading</>;
  }

  return <Box style={{display: 'flex'}} id={divId || undefined}></Box>;
};
export default CardPanel;
