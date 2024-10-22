import { fabric } from 'fabric';

class GridFactory {
    DrawGrid = (gridSize, size) => {
          let gridArr = [];

          for (var i = 0; i < (size[0] / gridSize); i++) {
            let line = new fabric.Line([i * gridSize, 0, i * gridSize, size[1]], { name: ".line", type: 'line', stroke: '#aaa', selectable: false, layer: 0 });
            gridArr.push(line);
          }
          
          for (var i = 0; i < (size[1] / gridSize); i++) {
            let line = new fabric.Line([0, i * gridSize, size[0], i * gridSize], { name: ".line", type: 'line', stroke: '#aaa', selectable: false, layer: 0 });
            gridArr.push(line);
          }

          let line = new fabric.Line([size[0], 0, size[0], size[1]], { name: ".line", type: 'line', stroke: '#aaa', selectable: false, layer: 0 });
          gridArr.push(line);

          line = new fabric.Line([0 , size[1], size[0], size[1]], { name: ".line", type: 'line', stroke: '#aaa', selectable: false, layer: 0 });
          gridArr.push(line);
    
          let grp = new fabric.Group(gridArr, { name: ".grid", selectable: false, interactive: false, layer: 0 });
          return grp;
      }
}

const GridFactoryInstance = new GridFactory();
export default GridFactoryInstance;
