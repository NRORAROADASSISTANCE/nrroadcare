create table if not exists salary_records(
 id bigserial primary key,
 employee_id bigint references users(id) on delete cascade,
 salary_month date not null,
 basic numeric(12,2) not null default 0,
 hra numeric(12,2) not null default 0,
 allowances numeric(12,2) not null default 0,
 incentives numeric(12,2) not null default 0,
 overtime numeric(12,2) not null default 0,
 deductions numeric(12,2) not null default 0,
 gross_salary numeric(12,2) not null default 0,
 net_salary numeric(12,2) not null default 0,
 created_at timestamptz default now(),
 unique(employee_id,salary_month)
);
create index if not exists salary_records_employee_idx on salary_records(employee_id,salary_month desc);
