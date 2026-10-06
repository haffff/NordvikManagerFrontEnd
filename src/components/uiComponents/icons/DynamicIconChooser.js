import { Box, Button, Flex, HStack, Input, Spinner, Text } from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { FaSearch } from "react-icons/fa";
import DynamicIcon from "./DynamicIcon";
import { ICON_PACK_LOADERS } from "../../../helpers/ReactIconPackLoaders";

const SHOWN_AT_FIRST = 21;
// "More..." over the whole pack (~4000 icons) would render all of them at once.
const MAX_SHOWN = 300;

/**
 * Picks a game-icons (react-icons/gi) icon by name. onSelect gets the name, or ""
 * when the icon is removed (the tree update treats null as "keep the old one").
 */
export const DynamicIconChooser = ({ onSelect, iconSelected, isDisabled }) => {
    const [filter, setFilter] = useState("");
    const [showSelect, setShowSelect] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [icons, setIcons] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedKey, setSelectedKey] = useState(iconSelected || null);

    // Follow the value we're given: the folder dialog stays mounted between opens,
    // so without this it kept showing the icon from the previous open.
    useEffect(() => {
        setSelectedKey(iconSelected || null);
    }, [iconSelected]);

    // Load the pack lazily — only once, only when the picker opens.
    useEffect(() => {
        if (!showSelect || icons) return;
        setLoading(true);
        ICON_PACK_LOADERS.gi()
            .then((mod) => { setIcons(mod); setLoading(false); })
            .catch(() => setLoading(false));
    }, [showSelect, icons]);

    const query = filter.trim().toLowerCase();
    const matching = icons
        ? Object.keys(icons).filter((k) => /^[A-Z]/.test(k) && k.toLowerCase().includes(query))
        : [];
    const shown = matching.slice(0, showAll ? MAX_SHOWN : SHOWN_AT_FIRST);

    const select = (key) => {
        setSelectedKey(key || null);
        setShowSelect(false);
        if (onSelect) onSelect(key);
    };

    const openPicker = () => {
        setShowSelect(true);
        setShowAll(false);
    };

    // The component straight from the loaded pack when we have it (no async step),
    // otherwise DynamicIcon loads it.
    const renderPreview = () => {
        if (!selectedKey) return null;
        const Loaded = icons?.[selectedKey];
        return Loaded ? <Loaded size={55} /> : <DynamicIcon iconName={selectedKey} iconProps={{ size: 55 }} />;
    };

    return (
        <>
            {renderPreview()}
            {selectedKey && (
                <Text fontSize="xs" color="gray.400" mt={1}>
                    {selectedKey}
                </Text>
            )}

            {showSelect ? (
                <Box mt={2}>
                    <Flex align="center" gap={2}>
                        <FaSearch />
                        <Input
                            size="xs"
                            aria-label="Search icons"
                            placeholder="Search icons, e.g. dragon"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </Flex>

                    {loading ? (
                        <Flex justify="center" p={4}>
                            <Spinner size="sm" />
                        </Flex>
                    ) : (
                        <Flex wrap="wrap" alignContent="flex-start" gap={1} maxH="200px" overflowY="auto" mt={2}>
                            {shown.map((key) => {
                                const Component = icons[key];
                                const isSelected = key === selectedKey;
                                return (
                                    <Box
                                        as="button"
                                        type="button"
                                        key={key}
                                        aria-label={key}
                                        aria-pressed={isSelected}
                                        title={key}
                                        p={1}
                                        borderRadius="md"
                                        borderWidth="1px"
                                        borderColor={isSelected ? "blue.400" : "transparent"}
                                        bg={isSelected ? "var(--nordvik-selection-color, #2d3a5a)" : undefined}
                                        _hover={{ bg: "whiteAlpha.200" }}
                                        cursor="pointer"
                                        onClick={() => select(key)}
                                    >
                                        <Component size="36" />
                                    </Box>
                                );
                            })}
                        </Flex>
                    )}

                    {showAll && matching.length > MAX_SHOWN && (
                        <Text fontSize="xs" color="fg.muted" mt={1}>
                            Showing {MAX_SHOWN} of {matching.length} — search to narrow it down.
                        </Text>
                    )}

                    <HStack gap={2} mt={2}>
                        {matching.length > SHOWN_AT_FIRST && (
                            <Button size="xs" variant="outline" onClick={() => setShowAll(!showAll)}>
                                {showAll ? "Less..." : "More..."}
                            </Button>
                        )}
                        <Button size="xs" variant="ghost" onClick={() => setShowSelect(false)}>
                            Close
                        </Button>
                    </HStack>
                </Box>
            ) : (
                <HStack gap={2} mt={1}>
                    <Button disabled={isDisabled} size="xs" onClick={openPicker}>
                        {selectedKey ? "Change Icon" : "Select Icon"}
                    </Button>
                    {selectedKey && (
                        <Button disabled={isDisabled} size="xs" variant="ghost" onClick={() => select("")}>
                            Remove icon
                        </Button>
                    )}
                </HStack>
            )}
        </>
    );
};

export default DynamicIconChooser;
