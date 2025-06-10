create table "access_token" (
  id bigint primary key generated always as identity,
  -- TODO encrypt this
  access_token text not null,
  code text,
  state text,
  platform_account_id bigint,
  created_date timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint access_token_code_state_check check (
    (code is not null) or (state is not null)
  ),
  constraint access_token_platform_account_id_fkey foreign key (platform_account_id)
    references public."PlatformAccount" (id) on update cascade on delete set null
);

create unique index access_token_access_token_idx on "access_token" ("access_token");
create index access_token_code_idx on "access_token" (code);
create index access_token_state_idx on "access_token" (state);
create index access_token_created_date_idx on "access_token" (created_date desc);
create index access_token_platform_account_id_idx on "access_token" (platform_account_id);

-- Revoke dangerous permissions from anon role
revoke delete on table "public"."access_token" from "anon";
revoke truncate on table "public"."access_token" from "anon";
revoke update on table "public"."access_token" from "anon";
revoke references on table "public"."access_token" from "anon";
revoke trigger on table "public"."access_token" from "anon";

-- Ensure only necessary permissions remain for anon role
grant select on table "public"."access_token" to "anon";
grant insert on table "public"."access_token" to "anon";