create unique index if not exists idx_knowledge_files_brand_file_unique
on public.knowledge_files(brand_id, file_id);
