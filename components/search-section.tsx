"use client";

import { useStreamableValue, type StreamableValue } from "ai/rsc";
import type { SearchResults as TypeSearchResults } from "@/lib/types";
import { SearchResults } from "./search-results";
import { SearchResultsImageSection } from "./search-results-image";
import { SearchSkeleton } from "./search-skeleton";
import { Section } from "./section";
import { ToolBadge } from "./tool-badge";

interface SearchSectionProps {
  result?: StreamableValue<string>;
  includeDomains?: string[];
}

export function SearchSection({ result, includeDomains }: SearchSectionProps) {
  const [data, error, pending] = useStreamableValue(result);
  const searchResults: TypeSearchResults = data ? JSON.parse(data) : undefined;
  const includeDomainsString = includeDomains
    ? ` [${includeDomains.join(", ")}]`
    : "";
  return (
    <div>
      {!pending && data ? (
        <>
          <Section size="sm" className="pb-0 pt-2">
            <ToolBadge tool="search">{`${searchResults.query}${includeDomainsString}`}</ToolBadge>
          </Section>
          {searchResults.images && searchResults.images.length > 0 && (
            <Section title="Images">
              <SearchResultsImageSection
                images={searchResults.images}
                query={searchResults.query}
              />
            </Section>
          )}
          <Section title="Sources">
            <SearchResults results={searchResults.results} />
          </Section>
        </>
      ) : (
        <Section className="pb-0 pt-2">
          <SearchSkeleton />
        </Section>
      )}
    </div>
  );
}
