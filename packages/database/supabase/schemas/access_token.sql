create table "access-token" (
  id bigint primary key generated always as identity,
  "access-token" text not null,
  code text,
  state text,
  created_date timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint access_token_code_state_check check (
    (code is not null) or (state is not null)
  )
);

create unique index access_token_access_token_idx on "access-token" ("access-token");
create index access_token_code_idx on "access-token" (code);
create index access_token_state_idx on "access-token" (state);
create index access_token_created_date_idx on "access-token" (created_date desc);