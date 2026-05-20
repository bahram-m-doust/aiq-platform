alter table public.question_sections
  add column if not exists is_active boolean not null default true;

alter table public.question_sections
  add column if not exists updated_at timestamptz default now();

alter table public.questions
  add column if not exists is_active boolean not null default true;

alter table public.questions
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_question_sections_active_order
  on public.question_sections(is_active, order_index);

create index if not exists idx_questions_section_active_order
  on public.questions(section_id, is_active, order_index);
