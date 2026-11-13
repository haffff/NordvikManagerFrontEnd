import * as React from 'react';
import { Button, Input, Text, Textarea, VStack } from '@chakra-ui/react';
import {
    DialogRoot, DialogContent, DialogHeader, DialogTitle,
    DialogBody, DialogFooter, DialogCloseTrigger,
} from '../../ui/dialog';
import { Checkbox } from '../../ui/checkbox';
import { downloadJson, exportEntity, exportFileName, importEntity, parseExport } from '../../../helpers/entityTransfer';
import { askImportCode } from '../ImportCodePrompt';
import { toaster } from '../../ui/toaster';

// Export JSON and Import JSON for a folder tree (maps, cards, playlists…). See
// helpers/entityTransfer.js; the server finds the files a file uses, or takes them from it.

/** Downloads `entity` as a .json file; "Include files" puts the pictures, sounds and code it uses in too. */
export const ExportJsonDialog = ({ kind, entity, onClose }) => {
    const [includeFiles, setIncludeFiles] = React.useState(false);
    const [includeCards, setIncludeCards] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState(null);

    React.useEffect(() => { setIncludeFiles(false); setIncludeCards(false); setError(null); }, [entity]);

    const download = async () => {
        setBusy(true);
        setError(null);
        try {
            const exported = await exportEntity(kind, entity.id, kind === "map" ? { includeFiles, includeCards } : { includeFiles });
            downloadJson(exportFileName(exported), exported);
            onClose();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <DialogRoot open={Boolean(entity)} onOpenChange={(e) => { if (!e.open) onClose(); }}>
            <DialogContent maxW="sm">
                <DialogHeader>
                    <DialogTitle>Export "{entity?.name}"</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <VStack align="stretch" gap={2}>
                        <Text fontSize="sm">
                            Saves it as a JSON file you can import here or into another game.
                        </Text>
                        <Checkbox size="sm" checked={includeFiles} onCheckedChange={(e) => setIncludeFiles(!!e.checked)}>
                            Include files (pictures, sounds, card pages): bigger, but complete in a game without them
                        </Checkbox>
                        {kind === "map" && (
                            <Checkbox size="sm" checked={includeCards} onCheckedChange={(e) => setIncludeCards(!!e.checked)}>
                                Include the tokens' cards, so another game gets them too (with their own files, if files are included)
                            </Checkbox>
                        )}
                        {error && <Text fontSize="sm" color="red.400">{error}</Text>}
                    </VStack>
                </DialogBody>
                <DialogFooter gap={2}>
                    <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button size="sm" colorPalette="blue" loading={busy} onClick={download}>Download</Button>
                </DialogFooter>
                <DialogCloseTrigger />
            </DialogContent>
        </DialogRoot>
    );
};

// A picked file bigger than this isn't shown in the text box (a big export with its files
// in it would make the box, and the page, crawl); it's imported as it is.
const SHOW_LIMIT = 200 * 1024;

const sizeText = (bytes) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Imports an exported file (picked or pasted) into folder `parentId`; onImported({ id, missing }).
 * The dialog closes as the import starts: a progress toast follows it from there, like an upload.
 */
export const ImportJsonDialog = ({ open, kind, parentId, onClose, onImported }) => {
    const [text, setText] = React.useState("");
    const [picked, setPicked] = React.useState(null); // { name, size, text } of a file too big to show
    const [error, setError] = React.useState(null);

    React.useEffect(() => { if (open) { setText(""); setPicked(null); setError(null); } }, [open]);

    const pickFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const content = await file.text();
        setError(null);
        if (content.length > SHOW_LIMIT) { setPicked({ name: file.name, size: file.size, text: content }); setText(""); }
        else { setPicked(null); setText(content); }
    };

    const source = picked?.text ?? text;

    const runImport = () => {
        setError(null);
        let parsed;
        try {
            parsed = parseExport(source);
        } catch (e) {
            setError(e.message);
            return;
        }
        onClose();
        // The text as it is: the server checks its signature over it. Card code from
        // another server is imported only if the GM says so (null when they don't).
        importEntity(source, { kind, parsed, parentId: parentId ?? null, confirmCode: askImportCode })
            .then((result) => { if (result) onImported?.(result); })
            .catch((e) => toaster.create({ title: "Couldn't import it", description: e.message, type: "error" }));
    };

    return (
        <DialogRoot open={open} onOpenChange={(e) => { if (!e.open) onClose(); }}>
            <DialogContent maxW="md">
                <DialogHeader>
                    <DialogTitle>Import JSON</DialogTitle>
                </DialogHeader>
                <DialogBody>
                    <VStack align="stretch" gap={2}>
                        <Text fontSize="sm">
                            Pick a file made with Export JSON, or paste its contents.
                        </Text>
                        <Input type="file" accept=".json,application/json" size="sm" aria-label="Exported file" onChange={pickFile} p="1" />
                        {picked ? (
                            <Text fontSize="sm" color="gray.400">{picked.name} ({sizeText(picked.size)}): too big to show, it's imported as it is.</Text>
                        ) : (
                            <Textarea size="xs" rows={8} fontFamily="mono" aria-label="Exported JSON"
                                value={text} onChange={(e) => setText(e.target.value)} placeholder='{ "format": "nordvik-entity", … }' />
                        )}
                        {error && <Text fontSize="sm" color="red.400">{error}</Text>}
                    </VStack>
                </DialogBody>
                <DialogFooter gap={2}>
                    <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button size="sm" colorPalette="blue" disabled={!source.trim()} onClick={runImport}>Import</Button>
                </DialogFooter>
                <DialogCloseTrigger />
            </DialogContent>
        </DialogRoot>
    );
};
