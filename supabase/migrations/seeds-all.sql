-- =============================================================================
-- SEEDS: all default catalog/reference data the app expects to exist.
-- =============================================================================
-- Run this once on a freshly-migrated database (or any database where the
-- per-table seed files have not been applied) to populate:
--
--   * public.agents             — agent catalog (6 rows)
--   * public.plans              — pricing tiers (3 rows)
--   * public.question_sections  — intake builder sections (6 rows)
--   * public.questions          — intake questions (72 rows across the sections)
--
-- Every statement is idempotent (ON CONFLICT DO NOTHING / DO UPDATE), so this
-- file can be re-run safely without producing duplicates.
--
-- WHERE THIS COMES FROM
-- These statements mirror the standalone seed files under supabase/seeds/
-- (agents.sql, plans.sql, questions_sections.sql, questions.sql). Edit the
-- source files there; this file is the runnable bundle.
-- =============================================================================

-- ----- agents (catalog) ------------------------------------------------------

insert into public.agents (key, name)
values
  ('BRAND_INTEGRATOR_BRAIN', 'Brand Integrator Brain'),
  ('STORY_TELLER',           'Story Teller'),
  ('IMAGE_GENERATOR',        'Image Generator'),
  ('VIDEO_GENERATOR',        'Video Generator'),
  ('CAMPAIGN_MAKER',         'Campaign Maker'),
  ('BRAND_DIGITAL_ACTIVATION', 'Brand Digital Activation')
on conflict (key) do update
set name = excluded.name;

-- ----- plans (pricing tiers) -------------------------------------------------

insert into public.plans (name, price, currency, duration_days, is_active)
values
  ('BASIC',      49,  'USD', 30, true),
  ('ADVANCED',   149, 'USD', 30, true),
  ('ENTERPRISE', 499, 'USD', 30, true)
on conflict (name) do nothing;

-- ----- question_sections (intake builder) ------------------------------------

insert into public.question_sections (key, title, order_index)
values
  ('COMPANY',                       'Company',                          1),
  ('CONSUMER_MARKET_SEGMENTATION',  'Consumer / Market Segmentation',   2),
  ('USER_PERSONA',                  'User Persona',                     3),
  ('PRODUCTS_SERVICES',             'Products / Services',              4),
  ('CONTEXT',                       'Context',                          5),
  ('STYLE_TONE_OF_VOICE',           'Style / Tone of Voice',            6)
on conflict (key) do nothing;

-- ----- questions (72 across the 6 sections) ---------------------------------

insert into public.questions (section_id, key, question_text, help_text, input_type, order_index)
select s.id, v.key, v.question_text, v.help_text, v.input_type, v.order_index
from public.question_sections s
join (values
    ('CONSUMER_MARKET_SEGMENTATION', 'DEFINITION_OF_PRIMARY_MAIN_AND_SECONDARY_TARGET_AUDIENCES', 'Definition of primary, main, and secondary target audiences', 'Define your primary, main, and secondary target audience groups, explaining their differences and priorities.', 'textarea', 1),
    ('CONSUMER_MARKET_SEGMENTATION', 'TARGET_AUDIENCE_DEMOGRAPHICS_DEFINITION', 'Target Audience Demographics Definition', 'Provide demographic details (age, gender, location, income, etc.) about your target audience.', 'textarea', 2),
    ('CONSUMER_MARKET_SEGMENTATION', 'TARGET_AUDIENCE_PSYCHOGRAPHICS_DEFINITION', 'Target Audience Psychographics Definition', 'Identify the psychographic traits of your target audience—lifestyle, interests, attitudes, and values.', 'textarea', 3),
    ('CONSUMER_MARKET_SEGMENTATION', 'TARGET_AUDIENCE_ECONOMIC_CHARACTERISTICS', 'Target Audience Economic Characteristics', 'Describe the economic characteristics of your target audience, such as income level, purchasing power, and spending habits.', 'textarea', 4),
    ('CONSUMER_MARKET_SEGMENTATION', 'TARGET_AUDIENCE_SOCIOGRAPHIC', 'Target Audience Sociographic', 'Provide sociographic insights, including social status, group affiliations, and cultural influences of your target audience.', 'textarea', 5),
    ('USER_PERSONA', 'TARGET_PERSONAS', 'Target Personas', 'Create detailed profiles of your target personas, including demographic, psychographic, and behavioral information.', 'textarea', 1),
    ('USER_PERSONA', 'TARGET_PERSONAS_AND_LIFESTYLE', 'Target Personas and Lifestyle', 'Describe the lifestyles of your target personas, including daily routines, hobbies, and leisure activities.', 'textarea', 2),
    ('USER_PERSONA', 'THE_PAINS_OF_TARGET_PERSONAS', 'The Pains of Target Personas', 'Identify the fears, concerns, or pain points that your target personas want to avoid or overcome.', 'textarea', 3),
    ('USER_PERSONA', 'THE_VALUES_OF_TARGET_PERSONAS', 'The Values of Target Personas', 'Outline the core values that your target personas hold, which influence their purchasing decisions.', 'textarea', 4),
    ('USER_PERSONA', 'THE_ASPIRATIONS_OF_TARGET_PERSONAS', 'The Aspirations of Target Personas', 'Describe the aspirations, dreams, and goals of your target personas to understand what motivates them.', 'textarea', 5),
    ('USER_PERSONA', 'TARGET_PERSONA_S_HOBBIES', 'Target Persona''s Hobbies', 'List common hobbies and interests of your target personas that may influence their purchasing decisions.', 'textarea', 6),
    ('USER_PERSONA', 'TARGET_PERSONA_S_PERSONALITY_TEMPERAMENT', 'Target Persona''s Personality & Temperament', 'Describe the personality traits and temperament of your target personas (e.g., extroverted, analytical, adventurous).', 'textarea', 7),
    ('COMPANY', 'COMPANY_OVERVIEW_INTRODUCTION', 'Company Overview / Introduction', 'Write a brief introduction to your brand, including its name, industry, founding date, and a summary of what it offers.', 'textarea', 1),
    ('COMPANY', 'BRAND_ESSENCE_CORE_VALUES', 'Brand Essence / Core Values', 'Define the fundamental idea or emotional core that represents your brand’s identity and purpose. Summarize the timeless value and personality that remain consistent across all products and communications.', 'textarea', 2),
    ('COMPANY', 'COMPANY_BACKGROUND', 'Company Background', 'Provide an overview of your company’s history, including founding story, key milestones, and evolution over time.', 'textarea', 3),
    ('COMPANY', 'PRESENT_NARRATIVE', 'Present Narrative', 'Describe your brand’s current story—how it is perceived today, what stage it is in, and how customers relate to it at this moment.', 'textarea', 4),
    ('COMPANY', 'FUTURE_NARRATIVE', 'Future Narrative', 'Illustrate the envisioned story of your brand’s future—where it aims to go, how it will evolve, and what long-term impact it seeks to create.', 'textarea', 5),
    ('COMPANY', 'BRAND_ARCHETYPE', 'Brand Archetype', 'Identify the archetype that best represents your brand (e.g., hero, caregiver, explorer) and explain why this archetype aligns with your brand’s personality.', 'textarea', 6),
    ('COMPANY', 'BRAND_ARCHITECTURE', 'Brand Architecture', 'Describe how your various sub-brands or product lines are organized under the overarching brand (e.g., branded house vs. house of brands).', 'textarea', 7),
    ('COMPANY', 'BRAND_POSITIONING', 'Brand Positioning', 'Explain how your brand is positioned in the market relative to competitors, including target segment, unique benefits, and perceived value.', 'textarea', 8),
    ('COMPANY', 'BRAND_PURPOSE', 'Brand Purpose', 'Define the underlying reason your brand exists beyond making profit, such as the social or emotional impact it aims to have.', 'textarea', 9),
    ('COMPANY', 'BRAND_VISION', 'Brand Vision', 'Express the vision statement for brand, describing the ideal future state the company aims to achieve.', 'textarea', 10),
    ('COMPANY', 'BRAND_MISSION', 'Brand Mission', 'State the specific mission statement for brand—its purpose and objectives within the broader business context.', 'textarea', 11),
    ('COMPANY', 'BRAND_SLOGAN', 'Brand Slogan', 'Write a concise and memorable slogan that captures the brand’s promise, emotional impact, or key differentiator in a few powerful words.', 'text', 12),
    ('COMPANY', 'BRAND_STRATEGIC_RECOURSES', 'Brand Strategic Recourses', 'Identify key resources (e.g., human, financial, technological) that your brand relies on to execute its strategy.', 'textarea', 13),
    ('COMPANY', 'KEY_SUCCESS_FACTORS', 'Key Success Factors', 'Identify the critical factors that determine success for your brand or business (e.g., product quality, customer satisfaction, innovation).', 'textarea', 14),
    ('COMPANY', 'CURRENT_REVENUE_MODEL', 'Current Revenue Model', 'Describe the current revenue streams of your brand—how it generates income through sales, subscriptions, services, or partnerships.', 'textarea', 15),
    ('COMPANY', 'STRATEGIC_PARTNERS', 'Strategic Partners', 'Identify important external partners, organizations, or suppliers that support your brand’s growth, distribution, or innovation strategy.', 'textarea', 16),
    ('PRODUCTS_SERVICES', 'PRODUCT_SERVICE_GROUPS', 'Product / Service Groups', 'Categorize the products into groups or lines and provide a brief description of each group.', 'textarea', 1),
    ('PRODUCTS_SERVICES', 'PRODUCT_SERVICES_PRICE_POSITIONING', 'Product / Services Price Positioning', 'Explain how products are positioned in the market relative to competitors, including target audience and distinguishing attributes.', 'textarea', 2),
    ('PRODUCTS_SERVICES', 'PRODUCT_SERVICES_FEATURES', 'Product / Services Features', 'Describe the key features of each product that customers should know.', 'textarea', 3),
    ('PRODUCTS_SERVICES', 'PRODUCT_SERVICES_SOLUTION_OFFERING_PAIN_RELATED', 'Product / Services Solution Offering (Pain Related)', 'Explain how your product or service directly solves customer pain points—what problems it removes, eases, or transforms into positive experiences.', 'textarea', 4),
    ('PRODUCTS_SERVICES', 'PRODUCT_SERVICES_S_COMPETITIVE_ADVANTAGE', 'Product / Services ''s Competitive Advantage', 'Explain the competitive advantages of products—what makes them better or different from competitors.', 'textarea', 5),
    ('PRODUCTS_SERVICES', 'PRODUCT_SERVICES_BENEFITS_EMOTIONAL_FUNCTIONAL', 'Product / Services Benefits (Emotional & Functional)', 'List both emotional and functional benefits that products provide to customers.', 'textarea', 6),
    ('PRODUCTS_SERVICES', 'PRODUCT_SERVICES_SWOT', 'Product / Services SWOT', 'Conduct a SWOT analysis for products—list strengths, weaknesses, opportunities, and threats.', 'textarea', 7),
    ('PRODUCTS_SERVICES', 'PRODUCT_SERVICES_POD', 'Product / Services POD', 'Identify the Points of Difference (POD) that set products apart from others in the market.', 'textarea', 8),
    ('PRODUCTS_SERVICES', 'PRODUCT_SERVICES_POP', 'Product / Services POP', 'Clarify the Points of Parity (POP) for products—attributes or benefits that are essential to meet industry standards or customer expectations.', 'textarea', 9),
    ('PRODUCTS_SERVICES', 'PRODUCT_SERVICE_DEVELOPMENT_STRATEGY_ROADMAP', 'Product / Service Development Strategy / Roadmap', 'Outline the development plan or roadmap for your products or services, including stages of innovation, testing, and market release.', 'textarea', 10),
    ('PRODUCTS_SERVICES', 'MARKETING_PLANS_AND_STRATEGY', 'Marketing Plans and Strategy', 'Outline your overall marketing plan and strategy—objectives, tactics, channels, budget, and measurement of success.', 'textarea', 11),
    ('PRODUCTS_SERVICES', 'SALES_STRATEGY', 'Sales Strategy', 'Provide details on your sales strategy—how you plan to convert leads into customers, pricing models, and sales team structure.', 'textarea', 12),
    ('CONTEXT', 'MARKET_OVERVIEW', 'Market Overview', 'Provide an overview of the market in which operates—size, growth rate, segmentation, and key opportunities.', 'textarea', 1),
    ('CONTEXT', 'MARKET_SIZE', 'Market Size', 'Estimate and describe the total market size for your brand, including potential customer base, sales volume, and revenue opportunity.', 'textarea', 2),
    ('CONTEXT', 'INDUSTRY_MARKET_TRENDS', 'Industry Market Trends', 'Summarize broader trends within your industry, such as technological advancements, regulatory changes, or shifts in customer expectations.', 'textarea', 3),
    ('CONTEXT', 'EVOLVING_MARKET_TRENDS', 'Evolving Market Trends', 'Describe current and emerging market trends relevant to your industry and how they might impact your brand.', 'textarea', 4),
    ('CONTEXT', 'COMPETITORS_MARKET_PLAYERS_MARKET_SHARE_DETAILS', 'Competitors & Market Players (Market Share Details)', 'List your main competitors and other significant market players, including their approximate market share and strengths.', 'textarea', 5),
    ('CONTEXT', 'ALTERNATIVE_SOLOUTIONS_ALTERNATE_COMPETITORS', 'alternative soloutions / alternate competitors', 'List alternate competitors and solutions that your user may choose them over you. These competors arent in the same sector or industy as you are.', 'textarea', 6),
    ('CONTEXT', 'UNIQUE_FEATURES_OF_THREE_MAIN_COMPETITORS', 'Unique Features of Three Main Competitors', 'Identify and describe unique features or strengths of three main competitors that differentiate them in the market.', 'textarea', 7),
    ('CONTEXT', 'COMPETITORS_MARKETING_STRATEGY', 'Competitors Marketing Strategy', 'Summarize how your main competitors approach marketing—key messages, channels used, and positioning techniques they employ.', 'textarea', 8),
    ('CONTEXT', 'COMPETITORS_SALES_STRATEGY', 'Competitors Sales Strategy', 'Describe the sales methods and distribution approaches competitors use, including pricing models, partnerships, and customer acquisition tactics.', 'textarea', 9),
    ('CONTEXT', 'EVENTS_AND_SEASONS_IMPACTING_DEMAND_AND_CONSUMER_BEHAVIOR', 'Events and Seasons Impacting Demand and Consumer Behavior', 'Identify events, holidays, or seasonal patterns that influence demand for your products or services and how consumer behavior changes.', 'textarea', 10),
    ('STYLE_TONE_OF_VOICE', 'STYLE_PILLARS', 'Style Pillars', 'Define the six style pillars that guide the design and presentation of products (e.g., minimalism, elegance, innovation).', 'textarea', 1),
    ('STYLE_TONE_OF_VOICE', 'DESIGN_PHILOSOPHY', 'Design Philosophy', 'Explain the guiding principles behind your design approach—how functionality, aesthetics, and emotion combine to express your brand’s values.', 'textarea', 2),
    ('STYLE_TONE_OF_VOICE', 'DESIGN_PERSONALITY', 'Design Personality', 'Describe the personality traits and persona of products and design as if they were characters (e.g., bold, sophisticated, friendly).', 'textarea', 3),
    ('STYLE_TONE_OF_VOICE', 'BRAND_MAIN_COLORS_HEX_CODE', 'Brand Main Colors (Hex Code)', 'Define the primary and secondary brand colors with their exact HEX codes. Explain the role of each color in representing the brand’s mood, hierarchy, and visual consistency across digital and physical materials.', 'textarea', 4),
    ('STYLE_TONE_OF_VOICE', 'VISUAL_IDENTITY_CORE', 'Visual Identity Core', 'Describe the core visual identity elements for products, such as logo usage, color palette, typography, and imagery.', 'textarea', 5),
    ('STYLE_TONE_OF_VOICE', 'PRODUCT_DESIGN_CONSIDERATION', 'Product Design consideration', 'Describe the overall design philosophy for products, including functional and aesthetic considerations.', 'textarea', 6),
    ('STYLE_TONE_OF_VOICE', 'PACKAGING_DESIGN_CONSIDERATION', 'Packaging Design consideration', 'Describe preferred packaging designs for products, including materials, formats, and design themes.', 'textarea', 7),
    ('STYLE_TONE_OF_VOICE', 'FASHION_DESIGN_CONSIDERATION', 'Fashion Design consideration', 'Describe the fashion design elements and aesthetics for products (colors, patterns, materials, style influences).', 'textarea', 8),
    ('STYLE_TONE_OF_VOICE', 'GRAPHIC_PRINT_DESIGN_CONSIDERATION', 'Graphic / Print Design consideration', 'Describe the design guidelines for print and graphic materials (brochures, flyers) used for products.', 'textarea', 9),
    ('STYLE_TONE_OF_VOICE', 'SPACE_DESIGN_CONSIDERATION', 'Space Design consideration', 'Describe how physical spaces (e.g., retail stores, trade booths) should be designed to reflect the brand.', 'textarea', 10),
    ('STYLE_TONE_OF_VOICE', 'PROMOTIONAL_ITEMS_AND_MERCHANDIZES_CONSIDERATION', 'Promotional Items and Merchandizes consideration', 'Describe preferred merchandizes and promotional items for products, including materials, formats, and design themes.', 'textarea', 11),
    ('STYLE_TONE_OF_VOICE', 'NON_NEGOTIABLE_STYLE_RULES_FOR_DESIGN', 'Non-Negotiable Style Rules for Design', 'Specify brand rules for products that are absolute and cannot be compromised (e.g., never use certain colors).', 'textarea', 12),
    ('STYLE_TONE_OF_VOICE', 'DEFINING_TONE_OF_VOICE', 'Defining Tone of Voice', 'Describe the overall tone of voice across communications—formal, casual, playful, authoritative, etc.', 'textarea', 13),
    ('STYLE_TONE_OF_VOICE', 'DEFINING_THE_BRAND_LANGUEAGE', 'Defining the Brand Langueage', 'Define the tone of voice that represents your brand, including key attributes and guidelines for consistency.', 'textarea', 14),
    ('STYLE_TONE_OF_VOICE', 'TONE_OF_VOICE_STYLE_STACK', 'Tone of Voice Style Stack', 'Outline a hierarchical stack of tone styles that guide how the brand communicates across different contexts.', 'textarea', 15),
    ('STYLE_TONE_OF_VOICE', 'GUIDELINES_FOR_PRODUCT_TONE_OF_VOICE_DOS_AND_DON_TS', 'Guidelines for Product Tone of Voice (Dos and Don’ts)', 'Provide specific guidelines for the tone of voice used for products—behaviors to follow and avoid.', 'textarea', 16),
    ('STYLE_TONE_OF_VOICE', 'SOCIAL_MEDIA_TONE_OF_VOICE_EXAMPLES', 'Social Media Tone of Voice Examples', 'Present examples of the tone of voice used on social media platforms, showing how the brand engages with audiences.', 'textarea', 17),
    ('STYLE_TONE_OF_VOICE', 'BLOG_POST_TONE_OF_VOICE_EXAMPLES', 'Blog Post Tone of Voice Examples', 'Provide examples of tone and style used in your blog posts to convey your brand’s personality.', 'textarea', 18),
    ('STYLE_TONE_OF_VOICE', 'PRODUCT_ADVERTORIAL_TONE_EXAMPLES', 'Product Advertorial Tone Examples', 'Provide examples of tone and style for advertorial content promoting products.', 'textarea', 19),
    ('STYLE_TONE_OF_VOICE', 'TONE_OF_VOICE_EXAMPLES_IN_PACKAGING', 'Tone of Voice Examples in Packaging', 'Provide examples of language and tone used on product packaging to communicate brand personality.', 'textarea', 20),
    ('STYLE_TONE_OF_VOICE', 'POINT_OF_SALE_TONE_EXAMPLES', 'Point of Sale Tone Examples', 'Provide examples of tone and messaging used at the point of sale to engage customers.', 'textarea', 21),
    ('STYLE_TONE_OF_VOICE', 'SHORT_COPYWRITING_TONE_EXAMPLES', 'Short Copywriting Tone Examples', 'Provide examples of tone and style for short copy (e.g., taglines, slogans) used to describe products.', 'textarea', 22)
) as v(section_key, key, question_text, help_text, input_type, order_index)
  on s.key = v.section_key
on conflict (key) do nothing;

-- ----- refresh PostgREST schema cache so new tables/rows are visible --------

notify pgrst, 'reload schema';
