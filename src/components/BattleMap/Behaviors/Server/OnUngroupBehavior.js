import { OnAddElementBehavior } from './OnAddElementBehavior';

// The group goes; each part comes in as an added element would (its properties, whether
// it can be selected), with the rights this player had on the group: the parts get its rows.
export class OnUngroupBehavior {
    Handle(response, canvas, battleMapId) {
        const groups = canvas.getObjects().filter(x => response.elementIds?.includes(x.id));
        const permission = groups[0]?.permission;
        groups.forEach(group => {
            group.additionalObjects?.forEach(x => canvas.remove(x));
            canvas.remove(group);
        });

        const add = new OnAddElementBehavior();
        (response.data ?? []).forEach(part => add.Handle({ ...response, data: { ...part, permission } }, canvas, battleMapId));
        canvas.requestRenderAll();
    }
}
