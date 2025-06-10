create table "public"."access_token" (
    "id" bigint generated always as identity not null,
    "access_token" text not null,
    "code" text,
    "state" text,
    "platform_account_id" bigint,
    "created_date" timestamp with time zone not null default timezone('utc'::text, now())
);


CREATE UNIQUE INDEX access_token_access_token_idx ON public.access_token USING btree (access_token);

CREATE INDEX access_token_code_idx ON public.access_token USING btree (code);

CREATE INDEX access_token_created_date_idx ON public.access_token USING btree (created_date DESC);

CREATE UNIQUE INDEX access_token_pkey ON public.access_token USING btree (id);

CREATE INDEX access_token_platform_account_id_idx ON public.access_token USING btree (platform_account_id);

CREATE INDEX access_token_state_idx ON public.access_token USING btree (state);

alter table "public"."access_token" add constraint "access_token_pkey" PRIMARY KEY using index "access_token_pkey";

alter table "public"."access_token" add constraint "access_token_code_state_check" CHECK (((code IS NOT NULL) OR (state IS NOT NULL))) not valid;

alter table "public"."access_token" validate constraint "access_token_code_state_check";

alter table "public"."access_token" add constraint "access_token_platform_account_id_fkey" FOREIGN KEY (platform_account_id) REFERENCES "PlatformAccount"(id) ON UPDATE CASCADE ON DELETE SET NULL not valid;

alter table "public"."access_token" validate constraint "access_token_platform_account_id_fkey";

grant insert on table "public"."access_token" to "anon";

grant select on table "public"."access_token" to "anon";

grant delete on table "public"."access_token" to "authenticated";

grant insert on table "public"."access_token" to "authenticated";

grant references on table "public"."access_token" to "authenticated";

grant select on table "public"."access_token" to "authenticated";

grant trigger on table "public"."access_token" to "authenticated";

grant truncate on table "public"."access_token" to "authenticated";

grant update on table "public"."access_token" to "authenticated";

grant delete on table "public"."access_token" to "service_role";

grant insert on table "public"."access_token" to "service_role";

grant references on table "public"."access_token" to "service_role";

grant select on table "public"."access_token" to "service_role";

grant trigger on table "public"."access_token" to "service_role";

grant truncate on table "public"."access_token" to "service_role";

grant update on table "public"."access_token" to "service_role";


