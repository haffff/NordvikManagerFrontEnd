export default ChatMessageParser
{
    regexCurlyBrackets = /\{([^}]+)\}/g;

    ParseMessage: (message) => {
        let splitByMatch = message.split(this.regexCurlyBrackets);
        let matches = message.matchAll(this.regexCurlyBrackets);

        let elementsList = list.map(element => {
            let obj = undefined;
            if (element.startsWith("[b]")) {
                let msg = element.replace("[b]", "");
                let additionalColor = msg.startsWith("[g]") ? "green" : (msg.startsWith("[r]") ? "red" : "purple");
                obj = (<Badge colorScheme={additionalColor}>{msg.replace("[g]", "").replace("[r]", "")}</Badge>);
            }

            // else if (element.startsWith("[a]")) {
            //     obj = (<a href='' >{element.replace("[a]", "")}</a>);
            // }
            else {
                obj = <>{element}</>;
            }
            return obj;
        });
        return elementsList;
    }
}