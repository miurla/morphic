-- ============================================================
-- Seed: Agriculture Topic Taxonomy
-- Run AFTER 004_topics.sql
-- ============================================================

-- ---------------------------------------------------------------
-- ROOT CATEGORIES
-- ---------------------------------------------------------------
insert into public.topics
  (id, slug, name, name_es, name_fr, name_pt, description, parent_id, icon, color, sort_order)
values
  ('00000000-0000-0000-0000-000000000001',
   'crops',              'Crops',
   'Cultivos',           'Cultures',          'Culturas',
   'Cereal, oilseed, legume and specialty crop production',
   null, '🌾', '#4CAF50', 1),

  ('00000000-0000-0000-0000-000000000002',
   'soil',               'Soil & Fertilisation',
   'Suelo y Fertilización', 'Sol & Fertilisation', 'Solo e Fertilização',
   'Soil health, fertility management and land use',
   null, '🌱', '#8D6E63', 2),

  ('00000000-0000-0000-0000-000000000003',
   'crop-protection',    'Crop Protection',
   'Protección de Cultivos', 'Protection des Cultures', 'Proteção de Culturas',
   'Pests, diseases, weeds and integrated management',
   null, '🐛', '#FF7043', 3),

  ('00000000-0000-0000-0000-000000000004',
   'livestock',          'Livestock & Poultry',
   'Ganadería y Aves',   'Élevage & Volaille', 'Pecuária e Aves',
   'Cattle, swine, poultry, goats, sheep and aquaculture',
   null, '🐄', '#795548', 4),

  ('00000000-0000-0000-0000-000000000005',
   'farm-management',    'Farm Management',
   'Gestión Agrícola',   'Gestion Agricole',   'Gestão Agrícola',
   'Operations, finance, supply chain and labour',
   null, '🏡', '#607D8B', 5),

  ('00000000-0000-0000-0000-000000000006',
   'climate',            'Climate & Water',
   'Clima y Agua',       'Climat & Eau',       'Clima e Água',
   'Climate adaptation, irrigation, drainage and water management',
   null, '💧', '#2196F3', 6),

  ('00000000-0000-0000-0000-000000000007',
   'agri-tech',          'AgriTech & Precision Farming',
   'AgroTecnología',     'AgriTech',           'AgroTecnologia',
   'Drones, sensors, AI, robotics and digital farming',
   null, '🤖', '#9C27B0', 7),

  ('00000000-0000-0000-0000-000000000008',
   'markets',            'Markets & Policy',
   'Mercados y Política','Marchés & Politique', 'Mercados e Política',
   'Commodity prices, trade regulations and rural finance',
   null, '📈', '#FF9800', 8)

on conflict (slug) do nothing;

-- ---------------------------------------------------------------
-- CROPS  (children of 00000000-0001)
-- ---------------------------------------------------------------
insert into public.topics
  (slug, name, name_es, name_fr, name_pt, parent_id, icon, color, sort_order)
values
  ('cereals',      'Cereals',     'Cereales',    'Céréales',   'Cereais',
   '00000000-0000-0000-0000-000000000001', '🌾', '#66BB6A', 1),

  ('legumes',      'Legumes',     'Leguminosas', 'Légumineuses','Leguminosas',
   '00000000-0000-0000-0000-000000000001', '🫘', '#A5D6A7', 2),

  ('oilseeds',     'Oilseeds',    'Oleaginosas', 'Oléagineux',  'Oleaginosas',
   '00000000-0000-0000-0000-000000000001', '🌻', '#C5E1A5', 3),

  ('horticulture', 'Horticulture','Horticultura','Horticulture','Horticultura',
   '00000000-0000-0000-0000-000000000001', '🥦', '#81C784', 4),

  ('fruits',       'Fruits & Nuts','Frutas y Nueces','Fruits & Noix','Frutas e Nozes',
   '00000000-0000-0000-0000-000000000001', '🍎', '#AED581', 5),

  ('beverages',    'Beverage Crops','Cultivos Industriales','Cultures de Boissons','Culturas de Bebidas',
   '00000000-0000-0000-0000-000000000001', '☕', '#DCE775', 6),

  ('fiber-crops',  'Fiber Crops', 'Fibras',      'Cultures Fibreuses','Fibras',
   '00000000-0000-0000-0000-000000000001', '🧵', '#FFF176', 7)

on conflict (slug) do nothing;

-- ---------------------------------------------------------------
-- SOIL  (children of 00000000-0002)
-- ---------------------------------------------------------------
insert into public.topics
  (slug, name, name_es, name_fr, name_pt, parent_id, icon, color, sort_order)
values
  ('soil-health',       'Soil Health',       'Salud del Suelo',  'Santé du Sol',     'Saúde do Solo',
   '00000000-0000-0000-0000-000000000002', '🌍', '#A1887F', 1),

  ('fertilizers',       'Fertilizers',       'Fertilizantes',    'Engrais',          'Fertilizantes',
   '00000000-0000-0000-0000-000000000002', '🧪', '#BCAAA4', 2),

  ('organic-farming',   'Organic Farming',   'Agricultura Ecológica','Agriculture Bio','Agricultura Orgânica',
   '00000000-0000-0000-0000-000000000002', '♻️', '#D7CCC8', 3),

  ('cover-crops',       'Cover Crops',       'Cultivos de Cobertura','Cultures de Couverture','Culturas de Cobertura',
   '00000000-0000-0000-0000-000000000002', '🌿', '#EFEBE9', 4)

on conflict (slug) do nothing;

-- ---------------------------------------------------------------
-- CROP PROTECTION  (children of 00000000-0003)
-- ---------------------------------------------------------------
insert into public.topics
  (slug, name, name_es, name_fr, name_pt, parent_id, icon, color, sort_order)
values
  ('pests',          'Pest Management',     'Manejo de Plagas',     'Gestion des Ravageurs','Manejo de Pragas',
   '00000000-0000-0000-0000-000000000003', '🐛', '#EF9A9A', 1),

  ('diseases',       'Plant Diseases',      'Enfermedades de Plantas','Maladies des Plantes','Doenças de Plantas',
   '00000000-0000-0000-0000-000000000003', '🦠', '#FFAB91', 2),

  ('weeds',          'Weed Management',     'Manejo de Malezas',    'Gestion des Mauvaises Herbes','Manejo de Ervas Daninhas',
   '00000000-0000-0000-0000-000000000003', '🌾', '#FFCC80', 3),

  ('pesticides',     'Pesticides & Biopesticides','Pesticidas',    'Pesticides',       'Pesticidas',
   '00000000-0000-0000-0000-000000000003', '🧴', '#FFF59D', 4),

  ('ipm',            'Integrated Pest Management','MIP',           'Lutte Intégrée',   'MIP',
   '00000000-0000-0000-0000-000000000003', '🔬', '#E6EE9C', 5)

on conflict (slug) do nothing;

-- ---------------------------------------------------------------
-- LIVESTOCK  (children of 00000000-0004)
-- ---------------------------------------------------------------
insert into public.topics
  (slug, name, name_es, name_fr, name_pt, parent_id, icon, color, sort_order)
values
  ('cattle',     'Cattle',          'Bovinos',       'Bovins',          'Bovinos',
   '00000000-0000-0000-0000-000000000004', '🐄', '#A5D6A7', 1),

  ('poultry',    'Poultry',         'Aves de Corral','Volaille',        'Aves de Corte',
   '00000000-0000-0000-0000-000000000004', '🐔', '#C5E1A5', 2),

  ('swine',      'Swine',           'Porcinos',      'Porcs',           'Suínos',
   '00000000-0000-0000-0000-000000000004', '🐷', '#DCE775', 3),

  ('aquaculture','Aquaculture',      'Acuicultura',   'Aquaculture',     'Aquicultura',
   '00000000-0000-0000-0000-000000000004', '🐟', '#B2EBF2', 4),

  ('animal-health','Animal Health',  'Sanidad Animal','Santé Animale',   'Saúde Animal',
   '00000000-0000-0000-0000-000000000004', '💊', '#B3E5FC', 5)

on conflict (slug) do nothing;

-- ---------------------------------------------------------------
-- CLIMATE & WATER  (children of 00000000-0006)
-- ---------------------------------------------------------------
insert into public.topics
  (slug, name, name_es, name_fr, name_pt, parent_id, icon, color, sort_order)
values
  ('irrigation',       'Irrigation',       'Riego',            'Irrigation',          'Irrigação',
   '00000000-0000-0000-0000-000000000006', '💦', '#81D4FA', 1),

  ('drought',          'Drought Resilience','Resiliencia a la Sequía','Résilience à la Sécheresse','Resiliência à Seca',
   '00000000-0000-0000-0000-000000000006', '🌵', '#FFE0B2', 2),

  ('climate-change',   'Climate Change',   'Cambio Climático', 'Changement Climatique','Mudança Climática',
   '00000000-0000-0000-0000-000000000006', '🌡️', '#FFCCBC', 3),

  ('carbon-farming',   'Carbon Farming',   'Agricultura del Carbono','Agriculture du Carbone','Agricultura do Carbono',
   '00000000-0000-0000-0000-000000000006', '🌿', '#C8E6C9', 4)

on conflict (slug) do nothing;

-- ---------------------------------------------------------------
-- AGRITECH  (children of 00000000-0007)
-- ---------------------------------------------------------------
insert into public.topics
  (slug, name, name_es, name_fr, name_pt, parent_id, icon, color, sort_order)
values
  ('drones',           'Drones & Remote Sensing','Drones',         'Drones & Télédétection','Drones e Sensoriamento',
   '00000000-0000-0000-0000-000000000007', '🚁', '#CE93D8', 1),

  ('precision-ag',     'Precision Agriculture', 'Agricultura de Precisión','Agriculture de Précision','Agricultura de Precisão',
   '00000000-0000-0000-0000-000000000007', '📡', '#B39DDB', 2),

  ('ai-ag',            'AI & Machine Learning in Ag','IA en Agricultura','IA en Agriculture','IA na Agricultura',
   '00000000-0000-0000-0000-000000000007', '🤖', '#9FA8DA', 3),

  ('biotech',          'Biotechnology & Breeding','Biotecnología','Biotechnologie','Biotecnologia',
   '00000000-0000-0000-0000-000000000007', '🧬', '#90CAF9', 4)

on conflict (slug) do nothing;

-- ---------------------------------------------------------------
-- MARKETS & POLICY  (children of 00000000-0008)
-- ---------------------------------------------------------------
insert into public.topics
  (slug, name, name_es, name_fr, name_pt, parent_id, icon, color, sort_order)
values
  ('commodity-prices', 'Commodity Prices', 'Precios Commodities','Prix Commodités',    'Preços de Commodities',
   '00000000-0000-0000-0000-000000000008', '💰', '#FFE082', 1),

  ('trade-policy',     'Trade Policy',     'Política Comercial', 'Politique Commerciale','Política Comercial',
   '00000000-0000-0000-0000-000000000008', '🌐', '#FFD54F', 2),

  ('rural-finance',    'Rural Finance',    'Finanzas Rurales',   'Finance Rurale',     'Finanças Rurais',
   '00000000-0000-0000-0000-000000000008', '🏦', '#FFC107', 3),

  ('food-security',    'Food Security',    'Seguridad Alimentaria','Sécurité Alimentaire','Segurança Alimentar',
   '00000000-0000-0000-0000-000000000008', '🍽️', '#FFB300', 4)

on conflict (slug) do nothing;
