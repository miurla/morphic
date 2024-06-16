import { SearchResults } from "@/components/search-results";
import { Section } from "@/components/section";
import { SearchResults as SearchResultsType } from "@/lib/types";

interface RetrieveSectionProps {
  data: SearchResultsType;
}

const RetrieveSection: React.FC<RetrieveSectionProps> = ({ data }) => {
  return (
    <Section title="Sources">
      <SearchResults results={data.results} />
    </Section>
  );
};

export default RetrieveSection;
