export const UtilityHelper = {
    ConvertBlobToB64: (blob) => {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();

            reader.onload = (event) => {
                resolve(event.target.result);
            };
            reader.onerror = (error) => {
                reader.abort();
                reject(error);
            };
            reader.readAsDataURL(blob);
        });
    },

    ParseBool: (val) =>
    {
        if ((typeof val === 'string' && (val.toLowerCase() === 'true' || val.toLowerCase() === 'yes')) || val === 1)
            return true;
        else if ((typeof val === 'string' && (val.toLowerCase() === 'false' || val.toLowerCase() === 'no')) || val === 0)
            return false;
    
        return null;
    },

    EmptyGuid: "00000000-0000-0000-0000-000000000000",

    DownloadObjectAsFile: (object, filename) => {
        // create file in browser
        const fileName = filename;
        const json = JSON.stringify(object, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const href = URL.createObjectURL(blob);

        // create "a" HTLM element with href to file
        const link = document.createElement("a");
        link.href = href;
        link.download = fileName + ".json";
        document.body.appendChild(link);
        link.click();

        // clean up "a" element & remove ObjectURL
        document.body.removeChild(link);
        URL.revokeObjectURL(href);
    },

    GenerateUUID: () => {
        return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    },

    GenerateConnectionErrorToast: () => {
        return UtilityHelper.GenerateErrorToast('Connection failed.', 'Seems like connection to server failed.');
    },

    GenerateErrorToast: (title, error) => {
        return {
            title: title || 'Error!',
            description: error,
            type: 'error',
            duration: 9000,
            isClosable: true
        };
    },

    GenerateNoPermissionToast: () => {
        return UtilityHelper.GenerateErrorToast('No permissions!', 'Seems like you cannot do that!.');
    },
    GenerateCannotRemoveExistingBattlemapToast: () => {
        return {
            title: 'Battlemap is open!',
            description: "Cannot delete opened battlemap.",
            status: 'error',
            duration: 9000,
            isClosable: true
        };
    },
    GenerateJoinProblemToast: () => {
        return {
            title: 'Cannot join game!',
            description: "You cannot join this game. Are you sure that password you provided is correct?",
            status: 'error',
            duration: 9000,
            isClosable: true
        };
    },
    GenerateCopiedToast: () => {
        return {
            title: 'Copied!',
            status: 'success',
            duration: 1000,
            isClosable: true
        };
    }
}

export default UtilityHelper;