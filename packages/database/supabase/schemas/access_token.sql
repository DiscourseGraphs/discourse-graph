create table "access_token" (
    request_id varchar primary key,
    -- TODO encrypt this (look into supabase vault)
    access_token varchar not null,
    code varchar,
    platform_account_id bigint,
    created_date timestamp with time zone default timezone('utc'::text, now()) not null,
    constraint access_token_code_check check (
        code is not null
    ),
    constraint access_token_platform_account_id_fkey foreign key (platform_account_id)
    references public."PlatformAccount" (id) on update cascade on delete set null
);

create unique index access_token_access_token_idx on "access_token" ("access_token");
create index access_token_code_idx on "access_token" (code);
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

ALTER TABLE public.access_token ENABLE ROW LEVEL SECURITY ;

DROP POLICY IF EXISTS access_token_policy ON public.access_token ;
CREATE POLICY access_token_policy ON public.access_token FOR ALL USING (public.my_account(platform_account_id)) ;
