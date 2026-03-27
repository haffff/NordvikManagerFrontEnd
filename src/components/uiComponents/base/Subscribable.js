
import { toaster } from '../../ui/toaster';
import * as React from 'react';
import UtilityHelper from '../../../helpers/UtilityHelper';
import WebSocketManagerInstance from '../../game/WebSocketManager';

export const Subscribable = ({ commandPrefix, onMessage, children }) => {
    const [uuid] = React.useState(UtilityHelper.GenerateUUID);

    // Always call the *latest* onMessage without re-subscribing on every render.
    const onMessageRef = React.useRef(onMessage);
    React.useLayoutEffect(() => { onMessageRef.current = onMessage; });

    React.useEffect(() => {
        WebSocketManagerInstance.Subscribe(commandPrefix + uuid, (event) => {
            if (!event.command.startsWith(commandPrefix)) return;

            if (event.result === "NoPermission") {
                toaster.create(UtilityHelper.GenerateNoPermissionToast());
            } else if (event.result === "WrongArguments") {
                toaster.create({
                    title: 'Something went wrong!',
                    description: "Seems like wrong arguments were provided. Try to check your action or contact with support",
                    type: 'error',
                    duration: 9000,
                });
            } else if (event.result === "NoResource") {
                toaster.create({
                    title: 'No resource found!',
                    description: "Seems like resource you are looking for does not exist",
                    type: 'error',
                    duration: 9000,
                });
            } else {
                onMessageRef.current?.(event);
            }
        });
        return () => {
            WebSocketManagerInstance.Unsubscribe(commandPrefix + uuid);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <>{children}</>;
}
export default Subscribable;