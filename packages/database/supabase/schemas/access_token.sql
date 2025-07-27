CREATE TABLE "access_token" (
    request_id varchar PRIMARY KEY,
    -- TODO encrypt this (look into supabase vault)
    access_token varchar NOT NULL,
    code varchar,
    platform_account_id bigint,
    created_date timestamp with time zone DEFAULT timezone(
        'utc'::text, now()
    ) NOT NULL,
    constraint access_token_code_check CHECK (
        code IS NOT null
    ),
    CONSTRAINT access_token_platform_account_id_fkey FOREIGN KEY (
        platform_account_id
    )
    REFERENCES public."PlatformAccount" (
        id
    ) ON UPDATE CASCADE ON DELETE SET NULL
);

CREATE UNIQUE INDEX access_token_access_token_idx ON "access_token" (
    "access_token"
);
CREATE INDEX access_token_code_idx ON "access_token" (code);
CREATE INDEX access_token_platform_account_id_idx ON "access_token" (
    platform_account_id
);

-- Revoke dangerous permissions from anon role
REVOKE DELETE ON TABLE "public"."access_token" FROM "anon";
REVOKE TRUNCATE ON TABLE "public"."access_token" FROM "anon";
REVOKE UPDATE ON TABLE "public"."access_token" FROM "anon";
REVOKE REFERENCES ON TABLE "public"."access_token" FROM "anon";
REVOKE TRIGGER ON TABLE "public"."access_token" FROM "anon";

-- Ensure only necessary permissions remain for anon role
GRANT SELECT ON TABLE "public"."access_token" TO "anon";
GRANT INSERT ON TABLE "public"."access_token" TO "anon";

ALTER TABLE public.access_token ENABLE row LEVEL SECURITY ;

DROP POLICY IF EXISTS access_token_policy ON public.access_token ;
CREATE POLICY access_token_policy ON public.access_token FOR ALL USING (public.my_account (platform_account_id)) ;
