import * as React from 'react';
import { Button, Stack, Text } from '@chakra-ui/react';
import { DialogRoot, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '../../ui/dialog';
import { entryPath } from '../tree/treeModel';

// Whether entry id sits in one of the moving entries (or is one).
const insideMoving = (id, byId, moving) => {
    const seen = new Set();
    for (let cur = byId.get(id); cur && !seen.has(cur.id); cur = byId.get(cur.parentId)) {
        if (moving.has(cur.id)) return true;
        seen.add(cur.id);
    }
    return false;
};

/**
 * Picks where the tree's selected entries go: the top level or a folder, shown with its
 * path. Folders being moved, and anything inside them, aren't offered.
 *
 * entries — the tree's entries; moving — ids being moved (null when closed);
 * onPick(folderId | null) — null is the top level.
 */
export const MoveToFolderDialog = ({ entries, moving, onPick, onClose }) => {
    const folders = React.useMemo(() => {
        if (!moving) return [];
        const byId = new Map((entries ?? []).map(e => [e.id, e]));
        const movingIds = new Set(moving);
        return (entries ?? [])
            .filter(e => e.isFolder && !insideMoving(e.id, byId, movingIds))
            .map(e => ({ id: e.id, label: entryPath(e.id, entries) + (e.name ?? '') }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [entries, moving]);

    return (
        <DialogRoot open={!!moving} onOpenChange={(e) => { if (!e.open) onClose(); }}>
            <DialogContent maxW="sm">
                <DialogHeader>
                    <DialogTitle>Move {moving?.length > 1 ? `${moving.length} entries` : ''} to…</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <Stack gap="4px" maxH="60vh" overflowY="auto">
                        <Button size="sm" variant="ghost" justifyContent="flex-start" onClick={() => onPick(null)}>
                            Top level
                        </Button>
                        {folders.map(f => (
                            <Button key={f.id} size="sm" variant="ghost" justifyContent="flex-start" onClick={() => onPick(f.id)}>
                                {f.label}
                            </Button>
                        ))}
                        {!folders.length && <Text fontSize="xs" color="fg.muted">No other folders.</Text>}
                    </Stack>
                </DialogBody>
                <DialogFooter>
                    <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </DialogRoot>
    );
};

export default MoveToFolderDialog;
