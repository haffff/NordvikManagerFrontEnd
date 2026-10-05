import * as React from "react";
import { Box, Button, Flex, HStack, Input, Text } from "@chakra-ui/react";
import { FaChevronDown, FaChevronRight, FaSearch } from "react-icons/fa";
import { ActiveWebHelper as WebHelper } from "../../../../../helpers/transport";
import { T } from "./editorTheme";

// Sidebar tool to try out %q:% / %qn:% expressions against the live game.
// (Moved unchanged from the old ActionsPanel.)
const BG_RAISED = T.raised;
const BORDER_CLR = T.border;

export const QueryResolver = () => {
  const [open,       setOpen]       = React.useState(false);
  const [expression, setExpression] = React.useState("");
  const [variables,  setVariables]  = React.useState("");
  const [result,     setResult]     = React.useState(null);
  const [error,      setError]      = React.useState(null);
  const [loading,    setLoading]    = React.useState(false);

  const resolve = async () => {
    if (!expression.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      let vars;
      if (variables.trim()) {
        try { vars = JSON.parse(variables); } catch { setError("Variables must be valid JSON"); setLoading(false); return; }
      }
      const resp = await WebHelper.postAsync("addon/resolveQuery", { expression, variables: vars });
      if (!resp || resp.status < 200 || resp.status >= 300) { setError(`HTTP ${resp?.status ?? "error"}`); return; }
      setResult(resp.body?.result ?? "(empty)");
    } catch (e) {
      setError(e?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box borderTopWidth="1px" borderColor={BORDER_CLR} flexShrink={0}>
      <HStack
        px={3} py={2} cursor="pointer" userSelect="none"
        onClick={() => setOpen(o => !o)}
        _hover={{ bg: BG_RAISED }}
      >
        {open ? <FaChevronDown size={10} color="#718096" /> : <FaChevronRight size={10} color="#718096" />}
        <FaSearch size={10} color="#718096" />
        <Text fontSize="xs" color="gray.500" fontWeight="semibold" textTransform="uppercase" letterSpacing="wider">
          Query Resolver
        </Text>
      </HStack>
      {open && (
        <Flex direction="column" px={3} pb={3} gap={2}>
          <Input
            size="xs" placeholder="%q:{gameId}.name% or %qn:player-&quot;John&quot;.hp%"
            value={expression} onChange={e => setExpression(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") resolve(); }}
            fontFamily="mono" borderColor={BORDER_CLR}
            _placeholder={{ color: "gray.600", fontSize: "10px" }}
          />
          <Input
            size="xs" placeholder='Variables JSON (optional) {"myVar":"value"}'
            value={variables} onChange={e => setVariables(e.target.value)}
            fontFamily="mono" borderColor={BORDER_CLR}
            _placeholder={{ color: "gray.600", fontSize: "10px" }}
          />
          <Button size="xs" variant="outline" onClick={resolve} loading={loading} colorPalette="blue" alignSelf="flex-end">
            <FaSearch /> Resolve
          </Button>
          {result !== null && (
            <Box bg={BG_RAISED} borderRadius="md" borderWidth="1px" borderColor={BORDER_CLR} px={2} py={1}>
              <Text fontSize="xs" color="gray.400" mb="2px">Result</Text>
              <Text fontSize="xs" fontFamily="mono" color="green.300" wordBreak="break-all">{result}</Text>
            </Box>
          )}
          {error && (
            <Text fontSize="xs" color="red.400" fontFamily="mono">{error}</Text>
          )}
        </Flex>
      )}
    </Box>
  );
};

export default QueryResolver;
