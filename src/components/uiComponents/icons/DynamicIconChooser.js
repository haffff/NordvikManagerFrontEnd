import { Button, Flex, HStack, Input, Spinner, Text } from "@chakra-ui/react";
import React, { useState, useEffect } from "react";
import { FaSearch } from "react-icons/fa";
import DynamicIcon from "./DynamicIcon";

const AmountToShow = 21;

export const DynamicIconChooser = ({ onSelect, iconSelected, isDisabled }) => {
    const [filter, setFilter] = useState("");
    const [showSelect, setShowSelect] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [icons, setIcons] = useState(null);
    const [loading, setLoading] = useState(false);

    // The selected state holds both key (string) and Component (the icon fn).
    // Storing Component lets the preview render immediately after selection
    // without a second async import cycle.
    const [selected, setSelected] = useState(
        iconSelected ? { key: iconSelected, Component: null } : null
    );

    // Load the full gi pack lazily — only once, only when the picker opens.
    useEffect(() => {
        if (!showSelect || icons) return;
        setLoading(true);
        import("react-icons/gi")
            .then((mod) => { setIcons(mod); setLoading(false); })
            .catch(() => setLoading(false));
    }, [showSelect]);

    const getIcons = () => {
        if (!icons) return [];
        const filtered = Object.keys(icons).filter(
            (k) => /^[A-Z]/.test(k) && k.includes(filter)
        );
        const slice = showAll ? filtered : filtered.slice(0, AmountToShow);
        return slice.map((k) => ({ key: k, Component: icons[k] }));
    };

    const handleSelect = (key, Component) => {
        // React only treats the top-level setState argument as an updater when it's
        // a function. Storing an object {key, Component} is safe — Component inside
        // the object is not touched by React's updater detection.
        setSelected({ key, Component });
        setShowSelect(false);
        if (onSelect) onSelect(key);
    };

    // Prefer the directly stored Component (instant, no async) when the user just
    // clicked an icon. Fall back to DynamicIcon (async load) when the chooser is
    // initialized from a saved key (e.g. settings panel reopened with existing value).
    const renderPreview = () => {
        if (!selected) return null;
        if (selected.Component) {
            return React.createElement(selected.Component, { size: 55 });
        }
        return <DynamicIcon iconName={selected.key} iconProps={{ size: 55 }} />;
    };

    return (
        <>
            {renderPreview()}

            {showSelect ? (
                <>
                    <Flex>
                        <FaSearch />
                        <Input size="xs" onChange={(e) => setFilter(e.target.value)} />
                    </Flex>

                    {loading ? (
                        <Flex justify="center" p={4}>
                            <Spinner size="sm" />
                        </Flex>
                    ) : (
                        <HStack wrap="wrap" overflowY="auto" height="200px">
                            {getIcons().map(({ key, Component }) => (
                                <Flex
                                    key={key}
                                    align="flex-start"
                                    style={{ cursor: "pointer" }}
                                    onClick={() => handleSelect(key, Component)}
                                >
                                    <Component size="40" />
                                </Flex>
                            ))}
                        </HStack>
                    )}

                    <Button
                        isDisabled={isDisabled}
                        width={45}
                        size="xs"
                        onClick={() => setShowAll(!showAll)}
                    >
                        {showAll ? "Less..." : "More..."}
                    </Button>
                </>
            ) : (
                <Button
                    isDisabled={isDisabled}
                    size="xs"
                    onClick={() => { setShowSelect(true); setShowAll(false); }}
                >
                    {selected ? "Change Icon" : "Select Icon"}
                </Button>
            )}

            {selected && (
                <Text fontSize="xs" color="gray.400" mt={1}>
                    {selected.key}
                </Text>
            )}
        </>
    );
};

export default DynamicIconChooser;
