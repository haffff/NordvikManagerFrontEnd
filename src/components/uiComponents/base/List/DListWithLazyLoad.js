import { Button, Center, Flex, Icon, Stack } from '@chakra-ui/react';
import * as React from 'react';
import { FaPlus } from 'react-icons/fa';
import WebHelper from '../../../../helpers/WebHelper';

export const DListWithLazyLoad = ({url, generateComponentView, hasOtherArgs, mainComponent, withAddButton, handleAdd, children}) => {
    
    const [list, setList] = React.useState([]);
    const [page, setPage] = React.useState(0);

    React.useEffect(() => {
        getNextPage();
    }, []);

    const getNextPage = () => {
        WebHelper.get(url + (hasOtherArgs ? "&" : "?") + "page=" + page, (response) => {setList([...list, ...response])}, (error) => console.log(error));
        setPage(page + 1);
    }

    return (
        <Flex 
        direction="column" 
        width={mainComponent ? "100%" : undefined} 
        overflowY={mainComponent ? "auto" : undefined}>
            {children}
            {withAddButton ? 
            (<Button onClick={handleAdd} padding={3} margin={1} size='sm' width="97%">
            </Button>) : 
            undefined}
        </Flex>
    );
}

export default DListWithLazyLoad;