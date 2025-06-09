create table "public"."access-token" (
    "id" bigint generated always as identity not null,
    "access-token" text not null,
    "code" text,
    "state" text,
    "created_date" timestamp with time zone not null default timezone('utc'::text, now())
);


CREATE UNIQUE INDEX "access-token_pkey" ON public."access-token" USING btree (id);

CREATE UNIQUE INDEX access_token_access_token_idx ON public."access-token" USING btree ("access-token");

CREATE INDEX access_token_code_idx ON public."access-token" USING btree (code);

CREATE INDEX access_token_created_date_idx ON public."access-token" USING btree (created_date DESC);

CREATE INDEX access_token_state_idx ON public."access-token" USING btree (state);

alter table "public"."access-token" add constraint "access-token_pkey" PRIMARY KEY using index "access-token_pkey";

alter table "public"."access-token" add constraint "access_token_code_state_check" CHECK (((code IS NOT NULL) OR (state IS NOT NULL))) not valid;

alter table "public"."access-token" validate constraint "access_token_code_state_check";

grant delete on table "public"."access-token" to "anon";

grant insert on table "public"."access-token" to "anon";

grant references on table "public"."access-token" to "anon";

grant select on table "public"."access-token" to "anon";

grant trigger on table "public"."access-token" to "anon";

grant truncate on table "public"."access-token" to "anon";

grant update on table "public"."access-token" to "anon";

grant delete on table "public"."access-token" to "authenticated";

grant insert on table "public"."access-token" to "authenticated";

grant references on table "public"."access-token" to "authenticated";

grant select on table "public"."access-token" to "authenticated";

grant trigger on table "public"."access-token" to "authenticated";

grant truncate on table "public"."access-token" to "authenticated";

grant update on table "public"."access-token" to "authenticated";

grant delete on table "public"."access-token" to "service_role";

grant insert on table "public"."access-token" to "service_role";

grant references on table "public"."access-token" to "service_role";

grant select on table "public"."access-token" to "service_role";

grant trigger on table "public"."access-token" to "service_role";

grant truncate on table "public"."access-token" to "service_role";

grant update on table "public"."access-token" to "service_role";


