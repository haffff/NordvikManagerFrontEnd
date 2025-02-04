import { Input } from "@chakra-ui/react";

export const SearchInput = ({ value, onChange }) => {
  return (
    <Input size={'xs'} placeholder="Search" value={value} onChange={(e) => onChange(e.target.value)} />
  );
};
