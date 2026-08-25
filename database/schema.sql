create table if not exists customers(
 id bigserial primary key, name varchar(120) not null, phone varchar(20) not null,
 address text default '', vehicle_no varchar(30) not null, created_at timestamptz default now()
);
create table if not exists technicians(
 id bigserial primary key, name varchar(120) not null, phone varchar(20) not null,
 specialization varchar(120) default '', active boolean default true, created_at timestamptz default now()
);
create table if not exists service_requests(
 id bigserial primary key, customer_id bigint references customers(id) on delete set null,
 status varchar(30) default 'pending', location text default '', description text default '',
 assigned_technician varchar(120) default '', created_at timestamptz default now()
);
create table if not exists payments(
 id bigserial primary key, customer_id bigint references customers(id) on delete set null,
 amount numeric(12,2) not null default 4500, method varchar(30) default 'UPI',
 transaction_ref varchar(120) default '', paid_at timestamptz default now()
);
create table if not exists memberships(
 id bigserial primary key, customer_id bigint references customers(id) on delete cascade,
 amount numeric(12,2) not null default 4500, renewal_date date not null, created_at timestamptz default now()
);
create table if not exists receipts(
 id bigserial primary key, customer_id bigint references customers(id) on delete set null,
 payment_id bigint references payments(id) on delete set null,
 receipt_no varchar(50) unique not null, created_at timestamptz default now()
);
create table if not exists payment_settings(id bigserial primary key,business_name varchar(120) default 'NRORA',bank_name varchar(120) default '',account_holder varchar(120) default '',account_number varchar(60) default '',ifsc varchar(20) default '',branch varchar(120) default '',upi_id varchar(120) default '',qr_image_url text default '',show_bank_details boolean default false,show_upi boolean default true,updated_at timestamptz default now());

create table if not exists users(
 id bigserial primary key,
 username varchar(80) unique not null,
 password_hash text not null,
 role varchar(20) not null default 'employee',
 name varchar(120) not null,
 phone varchar(20) default '',
 active boolean default true,
 created_at timestamptz default now()
);
create index if not exists users_username_idx on users(username);
