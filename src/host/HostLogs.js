// The host's log (the browser host's console: .NET's logger and its JS), in the host drawer.
// host.js keeps the lines in the page, so they're there before login and after the host stopped.
import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, HStack, Text } from '@chakra-ui/react';

const FILTERS = [
  { key: 'all', label: 'All', shows: () => true },
  { key: 'warn', label: 'Warnings', shows: (l) => l.level === 'warn' || l.level === 'error' },
  { key: 'error', label: 'Errors', shows: (l) => l.level === 'error' },
];

const COLORS = { error: 'fg.error', warn: 'fg.warning', debug: 'fg.subtle', info: 'fg' };

const time = (at) => new Date(at).toTimeString().slice(0, 8);

/** As text, one line each: "10:00:05 ERROR GameLobby: boom". */
export const formatLines = (lines) => lines.map((l) => `${time(l.at)} ${l.level.toUpperCase()} ${l.text}`).join('\n');

/** @param logs host.js's log: lines(), subscribe(fn), clear() */
export const HostLogs = ({ logs, height = '60vh' }) => {
  const [lines, setLines] = useState(() => logs?.lines() ?? []);
  const [filter, setFilter] = useState('all');
  const [copied, setCopied] = useState(false);
  const box = useRef(null);
  const follow = useRef(true);

  useEffect(() => {
    if (!logs) return undefined;
    setLines(logs.lines());
    return logs.subscribe(() => setLines(logs.lines()));
  }, [logs]);

  // Keep to the newest line unless the GM scrolled up to read.
  useEffect(() => {
    if (follow.current && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [lines, filter]);

  const shown = lines.filter(FILTERS.find((f) => f.key === filter).shows);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(formatLines(shown));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* no clipboard: the lines can still be selected */ }
  };

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <HStack gap={1} wrap="wrap">
        {FILTERS.map((f) => (
          <Button key={f.key} size="xs" variant={filter === f.key ? 'solid' : 'outline'} onClick={() => setFilter(f.key)}>
            {f.label}
          </Button>
        ))}
        <Box flex={1} />
        <Button size="xs" variant="outline" onClick={copy}>{copied ? 'Copied' : 'Copy'}</Button>
        <Button size="xs" variant="outline" onClick={() => { logs?.clear(); setLines([]); }}>Clear</Button>
      </HStack>
      <Box
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget;
          follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
        height={height}
        overflowY="auto"
        fontFamily="mono"
        fontSize="xs"
        borderWidth="1px"
        borderRadius="md"
        padding={2}
        bg="bg.subtle"
      >
        {shown.length === 0 && <Text color="fg.muted">Nothing logged{filter === 'all' ? '' : ' at this level'}.</Text>}
        {shown.map((l) => (
          <Text key={l.id} as="div" color={COLORS[l.level] ?? 'fg'} whiteSpace="pre-wrap" wordBreak="break-word">
            <Text as="span" color="fg.muted">{time(l.at)} </Text>
            {l.text}
          </Text>
        ))}
      </Box>
    </Box>
  );
};

export default HostLogs;
