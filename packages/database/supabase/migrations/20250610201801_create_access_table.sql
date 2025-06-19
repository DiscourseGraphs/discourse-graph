create table "public"."access_token" (
    "request_id" character varying not null,
    "access_token" character varying not null,
    "code" character varying,
    "platform_account_id" bigint,
    "created_date" timestamp with time zone not null default timezone('utc'::text, now())
);


CREATE UNIQUE INDEX access_token_access_token_idx ON public.access_token USING btree (access_token);

CREATE INDEX access_token_code_idx ON public.access_token USING btree (code);

CREATE UNIQUE INDEX access_token_pkey ON public.access_token USING btree (request_id);

CREATE INDEX access_token_platform_account_id_idx ON public.access_token USING btree (platform_account_id);

alter table "public"."access_token" add constraint "access_token_pkey" PRIMARY KEY using index "access_token_pkey";

alter table "public"."access_token" add constraint "access_token_code_check" CHECK ((code IS NOT NULL)) not valid;

alter table "public"."access_token" validate constraint "access_token_code_check";

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


