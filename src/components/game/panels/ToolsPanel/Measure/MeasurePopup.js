import { useEffect } from "react";
import ClientMediator from "../../../../../ClientMediator";

const MeasurePopup = () => {
  const [value, setValue] = useState(measure);

  useEffect(() => {
    let arrow = ClientMediator.sendCommand("BattleMap", "GetMeasureArrow", {
      contextId: battleMapId,
    });

    const handleMouseMove = (e) => {
        if (arrow) {
            let x1 = arrow.x1;
            let y1 = arrow.y1;
            let x2 = e.clientX;
            let y2 = e.clientY;

            //Calculate distance
            let distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

            canvas.renderAll();
        }
    };

    document.addEventListener("mousemove", handleMouseMove);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return (
    <div className="measure-popup">
      <input
        type="number"
        value={value}
        onChange={handleChange}
        placeholder="Enter measure"
      />
      <button onClick={handleSave}>Save</button>
    </div>
  );
};
