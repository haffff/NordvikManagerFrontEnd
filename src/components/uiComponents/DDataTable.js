import { For, HStack, Table } from "@chakra-ui/react";

import {
  PaginationItems,
  PaginationNextTrigger,
  PaginationPageText,
  PaginationPrevTrigger,
  PaginationRoot,
} from "../ui/pagination";

export const DDataTable = ({
  page,
  data,
  count,
  total,
  fallback,
  GenerateHeader,
  GenerateRow,
  GetData,
}) => {
  return (
    <>
      <Table.Root>
        <Table.Header>
          <Table.Row>{GenerateHeader ? GenerateHeader() : <></>}</Table.Row>
        </Table.Header>
        <Table.Body>
          <For each={data} fallback={fallback || <Table.Row></Table.Row>}>
            {GenerateRow
              ? (item) => GenerateRow(item)
              : (item) => (
                  <Table.Row>
                    {Object.keys(item).map((key) => {
                      return <Table.Cell>{item[key]}</Table.Cell>;
                    })}
                  </Table.Row>
                )}
          </For>
        </Table.Body>
      </Table.Root>
      <PaginationRoot
        key={page}
        count={total}
        pageSize={count}
        page={page}
        onPageChange={(e) => GetData(e.page)}
        defaultPage={1}
        size={"xl"}
      >
        <HStack>
          <PaginationPrevTrigger />
          <PaginationItems />
          <PaginationNextTrigger />
        </HStack>
        <PaginationPageText margin={'10px'} format="long"  />
      </PaginationRoot>
    </>
  );
};
