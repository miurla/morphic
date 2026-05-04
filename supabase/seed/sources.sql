-- ============================================================
-- Seed: Trusted Agriculture Knowledge Sources
-- Run AFTER 005_sources.sql + seed/topics.sql
-- ============================================================

insert into public.sources
  (slug, name, base_url, domain, description, source_type, languages, regions, trust_score, is_featured)
values

-- ---------------------------------------------------------------
-- International Research Organisations
-- ---------------------------------------------------------------
('fao',
 'FAO – Food and Agriculture Organization',
 'https://www.fao.org',
 'fao.org',
 'UN agency leading international efforts to defeat hunger and improve nutrition and food security',
 'research', '{en,es,fr,pt,ar,zh,ru}', '{}', 98, true),

('cgiar',
 'CGIAR',
 'https://www.cgiar.org',
 'cgiar.org',
 'Global research partnership addressing food security challenges',
 'research', '{en,es,fr,pt}', '{}', 97, true),

('cimmyt',
 'CIMMYT – Maize & Wheat Improvement Center',
 'https://www.cimmyt.org',
 'cimmyt.org',
 'International research & training center for improving maize and wheat',
 'research', '{en,es}', '{}', 96, true),

('irri',
 'IRRI – International Rice Research Institute',
 'https://www.irri.org',
 'irri.org',
 'International organization committed to reducing poverty and hunger through rice science',
 'research', '{en}', '{PH,IN,BD,VN,ID}', 96, true),

('icrisat',
 'ICRISAT',
 'https://www.icrisat.org',
 'icrisat.org',
 'International Crops Research Institute for the Semi-Arid Tropics',
 'research', '{en}', '{IN,NG,KE,ET,ML}', 95, true),

('iita',
 'IITA – International Institute of Tropical Agriculture',
 'https://www.iita.org',
 'iita.org',
 'Research-for-development organization focusing on agriculture in tropical sub-Saharan Africa',
 'research', '{en,fr}', '{NG,TZ,KE,CM}', 95, false),

('cifor',
 'CIFOR – Center for International Forestry Research',
 'https://www.cifor.org',
 'cifor.org',
 'Research on forests, climate change, and livelihoods',
 'research', '{en,es,fr,pt,id}', '{}', 94, false),

-- ---------------------------------------------------------------
-- Government / Extension
-- ---------------------------------------------------------------
('usda-ars',
 'USDA Agricultural Research Service',
 'https://www.ars.usda.gov',
 'ars.usda.gov',
 'Primary intramural scientific research agency of the US Department of Agriculture',
 'government', '{en}', '{US}', 97, true),

('usda-nass',
 'USDA NASS',
 'https://www.nass.usda.gov',
 'nass.usda.gov',
 'Official US agricultural statistics service',
 'government', '{en}', '{US}', 96, false),

('embrapa',
 'Embrapa – Brazilian Agricultural Research Corporation',
 'https://www.embrapa.br',
 'embrapa.br',
 'Brazil''s leading agricultural research institution',
 'research', '{pt,en}', '{BR}', 95, true),

('inrae',
 'INRAE – French National Research Institute for Agriculture',
 'https://www.inrae.fr',
 'inrae.fr',
 'French public research institute dedicated to agriculture, food and the environment',
 'research', '{fr,en}', '{FR}', 95, false),

('csiro-ag',
 'CSIRO Agriculture & Food',
 'https://www.csiro.au/en/Research/AF',
 'csiro.au',
 'Australia''s national science agency for agricultural research',
 'research', '{en}', '{AU}', 94, false),

('icar',
 'ICAR – Indian Council of Agricultural Research',
 'https://www.icar.org.in',
 'icar.org.in',
 'Apex body for coordinating, guiding and managing research in agriculture in India',
 'government', '{en,hi}', '{IN}', 93, false),

-- ---------------------------------------------------------------
-- Academic / Peer-Reviewed
-- ---------------------------------------------------------------
('nature-food',
 'Nature Food',
 'https://www.nature.com/natfood',
 'nature.com',
 'High-impact journal covering food systems, agriculture and sustainability',
 'research', '{en}', '{}', 96, true),

('field-crops-research',
 'Field Crops Research (Elsevier)',
 'https://www.sciencedirect.com/journal/field-crops-research',
 'sciencedirect.com',
 'International journal on agronomy, physiology, genetics and management of field crops',
 'research', '{en}', '{}', 94, false),

('agricultural-systems',
 'Agricultural Systems (Elsevier)',
 'https://www.sciencedirect.com/journal/agricultural-systems',
 'sciencedirect.com',
 'Research on the design and management of agricultural systems',
 'research', '{en}', '{}', 93, false),

-- ---------------------------------------------------------------
-- Data & Statistics
-- ---------------------------------------------------------------
('faostat',
 'FAOSTAT',
 'https://www.fao.org/faostat',
 'fao.org',
 'FAO global food and agriculture statistics database',
 'database', '{en,es,fr,pt,ar,zh,ru}', '{}', 97, true),

('world-bank-ag',
 'World Bank Agriculture Data',
 'https://data.worldbank.org/topic/agriculture-and-rural-development',
 'worldbank.org',
 'World Bank open data on agriculture and rural development',
 'database', '{en,es,fr,pt,ar,zh,ru}', '{}', 95, false),

('usda-ers',
 'USDA Economic Research Service',
 'https://www.ers.usda.gov',
 'ers.usda.gov',
 'US agricultural economic research and statistics',
 'government', '{en}', '{US}', 95, false),

-- ---------------------------------------------------------------
-- Extension & Practice
-- ---------------------------------------------------------------
('extension-org',
 'eXtension Foundation',
 'https://extension.org',
 'extension.org',
 'US cooperative extension knowledge network for agricultural practitioners',
 'extension', '{en}', '{US}', 88, false),

('agronomy-cca',
 'CCA Certified Crop Adviser',
 'https://www.certifiedcropadviser.org',
 'certifiedcropadviser.org',
 'Resources for certified crop advisers and agronomists',
 'extension', '{en}', '{US,CA}', 85, false),

-- ---------------------------------------------------------------
-- News & Markets
-- ---------------------------------------------------------------
('agweb',
 'AgWeb – Farm Journal',
 'https://www.agweb.com',
 'agweb.com',
 'Farm Journal agricultural news, markets, and weather coverage',
 'news', '{en}', '{US}', 82, false),

('progressive-farmer',
 'Progressive Farmer',
 'https://www.dtnpf.com',
 'dtnpf.com',
 'Practical agricultural news, advice, and market data',
 'news', '{en}', '{US}', 81, false),

('reuters-agriculture',
 'Reuters Agriculture',
 'https://www.reuters.com/business/environment/',
 'reuters.com',
 'Reuters global agriculture, food, and environment reporting',
 'news', '{en}', '{}', 88, false),

('farming-uk',
 'Farming UK',
 'https://www.farminguk.com',
 'farminguk.com',
 'UK farming news, legislation, and market updates',
 'news', '{en}', '{GB}', 80, false)

on conflict (slug) do nothing;
