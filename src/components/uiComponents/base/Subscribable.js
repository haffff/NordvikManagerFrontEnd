
import { toaster } from '../../ui/toaster';import * as React from 'react';
import UtilityHelper from '../../../helpers/UtilityHelper';
import WebSocketManagerInstance from '../../game/WebSocketManager';
import { __esModule } from '@testing-library/jest-dom/dist/matchers';

export const Subscribable = ({ commandPrefix, onMessage, children }) => {
    const [uuid, _setUUID] = React.useState(UtilityHelper.GenerateUUID());
    
    React.useEffect(() => {
        WebSocketManagerInstance.Subscribe(commandPrefix + uuid, (event) => {
            if (event.command.startsWith(commandPrefix))
            {
                if(event.result === "NoPermission")
                {
                    toaster.create(UtilityHelper.GenerateNoPermissionToast());
                } else
                if(event.result === "WrongArguments")
                {
                    toaster.create({
                        title: 'Something went wrong!',
                        description: "Seems like wrong arguments were provided. Try to check your action or contact with support",
                        status: 'error',
                        duration: 9000,
                        isClosable: true
                    });
                } else
                if(event.result === "NoResource")
                {
                    toaster.create({
                        title: 'No resource found!',
                        description: "Seems like resource you are looking for does not exist",
                        status: 'error',
                        duration: 9000,
                        isClosable: true
                    });
                }
                else
                {
                    onMessage(event);
                }
            }
        })
        return () => {
            WebSocketManagerInstance.Unsubscribe(commandPrefix + uuid);
        }
    }, []);

    return (
        <>{children}</>
    );
}
export default Subscribable;