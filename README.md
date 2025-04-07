# Overview

This is frontend part of NordvikManager application. if you are looking for release check [Nordvik Manager Repository](https://github.com/haffff/NordvikManager).

Nordvik Manager frontend is SPA application written in React. Whole idea of application is wrapped around modified [ReactDockable made by Hlorenzi](https://github.com/hlorenzi/react-dockable). Forked version by me you can find [here](https://github.com/haffff/react-dockable-expanded).

## Setting up enviroment for development

In the project directory, you can run standard react commands. Altough to run it you need several env variables.

### Env variables

- API_URL = Url to backend api you want to use (Mind the CORS!) usually its endpoint like "https://YourUrl/api"

- IMAGE_URL = Endpoint for getting resources (it will be deleted in upcoming changes). Url should look like this: "https://YourUrl/api/Materials/Resource?id="
- WS_URL = Endpoint for websocket communication (it will be deleted in upcoming changes). Url should look like this: "wss://YourUrl/api/battlemap/ws"

### Start of development server

Just start with `npm install --legacy-peer-deps` and then `npm start`

## Architecture

As mentioned before Frontend is build around React Dockable. One tab in dockable contains "Panel" There are several panel types like "Players Panel", "Materials Panel" or "BattleMap". Panels have 3 options to communicate with other places in the application: command with [ClientMediator](https://github.com/haffff/NordvikManagerFrontEnd/blob/1b022642b8120391dad4daaa6b14ffcfa706ec7d/src/ClientMediator.js), Rest API with [WebHelper](src/helpers/WebHelper.js) and WebSocketCommand with [WebSocketManagerInstance](https://github.com/haffff/NordvikManagerFrontEnd/blob/main/src/components/game/WebSocketManager.js)(Wrapped with Subscribable or CollectionSyncer). WebHelper and WebSocketManager are used to comunicate with Backend. WebHelper are connecting to REST API, mostly used for getting data. WebSocket is mostly connected to broadcasting commands in game. Exapmles of commands to be broadcasted are token updates. Map adding, map switching or other stuff. And lastly, ClientMediator, is used for communication between modules in client. 

![nm](https://github.com/user-attachments/assets/758376b1-426e-4340-b18b-fe262bd1b71c)

### ClientMediator

ClientMediator has 3 types of methods. 
- First type contains of Send, SendAsync, SendAndWaitForRegister, and SendAndWaitForRegisterAsync.
- Second type are Register and Unregister methods. In additon there are hooks related to that is [useClientMediator](src/components/uiComponents/hooks/useClientMediator.js) hook.
Register method registers provided object with commands to commands index. Requirement for that object is to contain 2 fields: Panel and Id. In addition optional method onEvent that triggers on any event broadcasted.

### WebSocketManager and wrappers

WebSocketManager (WebSocketManagerInstance) contains two major wrappers heavily used in panels. First one is [Subscribable] Component. Second is [CollectionSyncer]. Those components are responsible for watching over websocket commands coming from Backend.

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
