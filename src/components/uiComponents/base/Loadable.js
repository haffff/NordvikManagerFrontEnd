import * as React from 'react';

export const Loadable = ({OnLoad, ReloadRef,children}) => {
    const [isLoading, setIsLoading] = React.useState(true);
    
    if(ReloadRef)
    {
        ReloadRef.current = () => {setIsLoading(true)};
    }

    let Finish = () =>
    {
        setIsLoading(false);
    }

    if(isLoading)
    {
        OnLoad(Finish);       
        return(
            <>LOADING ...</>
        );
    }

    return (
        <>{children}</>
    );
}
export default Loadable;