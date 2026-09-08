import { Search } from "lucide-react";

import { useState } from "react";
import type { FC } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

export interface DataFilterSearchProps {
  placeholder?: string;
}

interface DataFilterSearchViewProps extends DataFilterSearchProps {
  loading?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}

interface SearchDraftState {
  sourceValue: string;
  value: string;
}

const createSearchDraftState = (
  value: string | undefined,
): SearchDraftState => {
  const query = value ?? "";

  return {
    sourceValue: query,
    value: query,
  };
};

export const DataFilterSearch: FC<DataFilterSearchViewProps> = ({
  loading,
  placeholder,
  value,
  onChange,
}) => {
  const [draftState, setDraftState] = useState(() =>
    createSearchDraftState(value),
  );
  const currentQuery = value ?? "";
  const query =
    draftState.sourceValue === currentQuery ? draftState.value : currentQuery;

  const emitChange = () => {
    if (query === currentQuery) {
      return;
    }

    setDraftState({
      sourceValue: query,
      value: query,
    });
    onChange?.(query);
  };

  return (
    <div
      className="flex min-w-0 items-center gap-2"
      data-slot="data-filter-search"
    >
      <InputGroup>
        <InputGroupInput
          placeholder={placeholder}
          value={query}
          onBlur={emitChange}
          onChange={(event) => {
            setDraftState({
              sourceValue: currentQuery,
              value: event.target.value,
            });
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) {
              return;
            }

            event.preventDefault();
            emitChange();
          }}
        />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        {loading && (
          <InputGroupAddon align="inline-end">
            <Spinner />
          </InputGroupAddon>
        )}
      </InputGroup>
    </div>
  );
};
