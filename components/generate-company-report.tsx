'use client'

import { Button } from '@/components/ui/button'
import { FileSearch } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function GenerateCompanyReport() {
  const router = useRouter()

  const generateReport = () => {
    const comprehensivePrompt = `Generate a comprehensive company report following the union research framework. Research and analyze the company thoroughly using these sources:

GOVERNMENT RECORDS:
- OSHA Establishment Search for safety violations, accident reports, union status designation
- NLRB Case Database for labor relations cases, union recognition petitions, ULPs
- Federal Procurement Data System for federal government contracts
- State DOT Contract Databases for state transportation contracts and bidding records
- State Business Entity Searches for corporate registrations, officers, subsidiary relationships
- County/Municipal Bid Records for local government contracts and bid documents
- Property Tax Assessor Records for real estate holdings, valuations, ownership
- UCC Filings for equipment financing, loans, banking relationships
- Building Department Records for construction permits, inspections, violations
- State Contractor Licensing Boards for license status, disciplinary actions
- Election Commission/Campaign Finance Databases for political contributions
- Court Records (PACER for federal, state systems for local) for litigation history
- Environmental Agency Databases for permits, violations, remediation projects
- State Labor Department Records for prevailing wage violations, apprenticeship programs
- Local Zoning/Planning Board Minutes for development applications, project approvals

INDUSTRY RESOURCES:
- IUOE Employer Database for union representation across companies
- Engineering News-Record (ENR) for company rankings, project details, executives
- Construction Industry Trade Publications for news, projects, acquisitions
- Trade Association Memberships (ABC, AGC, etc.) to identify anti-union affiliations
- Bid Reporting Services (BidX, GovWin) for project bidding activity
- Private Construction Databases (Dodge, ConstructConnect) for project tracking
- Industry Conference Attendee Lists for networking, partnerships
- Equipment Dealer Records for fleet size, equipment investments

CORPORATE SOURCES:
- Company Websites for self-reported projects, leadership, services
- Corporate Press Releases for acquisitions, new projects, leadership changes
- Company Job Postings for hiring needs, compensation, growth areas
- LinkedIn Company Pages for employee counts, new hires, departures
- Corporate Social Media for project updates, culture, announcements
- Employee Reviews (Glassdoor, Indeed) for working conditions, management issues
- Annual Reports for public companies or subsidiaries of public companies
- Corporate Foundation Records for philanthropic activities, community relations

INDIVIDUAL/PERSONAL SOURCES:
- Executive LinkedIn Profiles for career history, professional connections
- Social Media Accounts for personal connections, activities, interests
- Voter Registration Records for political affiliations, residential addresses
- Property Records for personal real estate holdings
- News Articles for profiles, interviews, controversies
- Obituaries and Family Announcements for family connections, history
- Alumni Directories for educational background, connections

HUMAN INTELLIGENCE:
- Former Employee Interviews for workplace conditions, management practices
- Union Member Networks for cross-company information, organizing experiences
- Building Trades Councils for project information, labor relations history
- Community Organizations for local reputation, community impacts
- Supply Chain Contacts for vendor relationships, payment practices
- Job Site Visits for direct observation of operations, signage, equipment

STRUCTURE THE REPORT WITH THESE SECTIONS:

1. EXECUTIVE SUMMARY
- Company overview and key metrics
- Union representation status (current and historical)
- Strategic assessment for organizing potential
- Priority recommendations

2. CORPORATE STRUCTURE & OPERATIONS
- Company history and ownership
- Subsidiaries and related entities
- Facility locations with addresses (plants, quarries, yards, offices)
- Services and business lines
- Geographic footprint and market coverage
- Revenue and financial performance
- Major clients and project types

3. LEADERSHIP & MANAGEMENT
- Key executives with biographical details
- Board of directors/ownership structure
- Management philosophy and style
- Family connections and relationships
- Compensation and financial interests
- Political affiliations and activities

4. WORKFORCE ANALYSIS
- Total employee count and breakdown by classification
- Union representation (which locals represent which units)
- Employee demographics and distribution
- Compensation structure and benefits
- Working conditions and safety record
- Training programs and career development
- Employee turnover and satisfaction indicators

5. LABOR RELATIONS PROFILE
- Union history and current representation
- Anti-union tactics and messaging
- Labor relations consultants/attorneys used
- NLRB case history and outcomes
- Collective bargaining history (if applicable)
- Strike history or work stoppages
- Recent organizing attempts (successful or failed)

6. PROJECTS & CONTRACTS
- Current major projects with locations and timelines
- Government contracts and public sector work
- Bidding patterns and success rates
- Project labor agreements (acceptance or avoidance)
- Compliance with prevailing wage requirements
- Subcontractor relationships and labor practices

7. SAFETY & COMPLIANCE
- OSHA violations and citations (detailed)
- Worker injury/fatality incidents
- Environmental compliance issues
- Litigation history (employment, contract, regulatory)
- Licensing and certification status
- Debarment or eligibility issues

8. FINANCIAL PROFILE
- Revenue trends and profitability estimates
- Major funding sources and contracts
- Banking relationships and lenders
- UCC filings and equipment financing
- Real estate holdings and assets
- Financial vulnerabilities or strengths

9. POLITICAL & COMMUNITY CONNECTIONS
- Political contributions (detailed by recipient)
- Lobbying activities and expenditures
- Industry association memberships
- Community relationships and reputation
- Charitable activities and foundation work
- Key political allies and relationships

10. MARKET POSITION & COMPETITION
- Market share in core sectors
- Main competitors (union and non-union)
- Competitive advantages and disadvantages
- Expansion strategies and acquisition history
- Bidding strategies and pricing approach

11. STRATEGIC PRESSURE POINTS
- Client/customer pressure opportunities
- Financial/investor leverage points
- Regulatory compliance vulnerabilities
- Community pressure opportunities
- Media/public relations vulnerabilities
- Project timeline or deadline pressures

12. ORGANIZING STRATEGY RECOMMENDATIONS
- Priority targets for organizing efforts
- Recommended messaging and approach
- Potential worker concerns and issues
- Anticipated company responses
- Legal considerations and strategy
- Timeline and resource requirements
- Success metrics and evaluation framework

13. APPENDICES
- Detailed facility location information
- Executive contact information
- Known employee lists with positions
- OSHA violation details
- Legal case summaries
- Political contribution details
- News articles and media coverage
- Union contract details (if applicable)

Provide a comprehensive, factual analysis that combines documentation with strategic insights for union organizing. Use markdown formatting with clear headings and subheadings.`

    router.push(`/search?q=${encodeURIComponent(comprehensivePrompt)}`)
  }

  return (
    <Button
      onClick={generateReport}
      variant="outline"
      className="w-full justify-start"
    >
      <FileSearch className="size-4 mr-2" />
      <span>Generate Company Report</span>
    </Button>
  )
}
