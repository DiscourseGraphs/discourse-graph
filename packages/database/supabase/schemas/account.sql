


CREATE TABLE IF NOT EXISTS "public"."Account" (
    "id" bigint DEFAULT "nextval"('"public"."entity_id_seq"'::"regclass") NOT NULL,
    "platform_id" bigint NOT NULL,
    "person_id" bigint NOT NULL,
    "write_permission" boolean NOT NULL,
    "active" boolean DEFAULT true NOT NULL
);

ALTER TABLE "public"."Account" OWNER TO "postgres";

COMMENT ON TABLE "public"."Account" IS 'A user account on a discourse platform';


ALTER TABLE ONLY "public"."Account"
    ADD CONSTRAINT "Account_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "public"."Agent"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."Account"
    ADD CONSTRAINT "Account_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "public"."DiscoursePlatform"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY ("id");


CREATE TABLE IF NOT EXISTS "public"."SpaceAccess" (
    "id" bigint DEFAULT "nextval"('"public"."entity_id_seq"'::"regclass") NOT NULL,
    "space_id" bigint,
    "account_id" bigint NOT NULL,
    "editor" boolean NOT NULL
);

ALTER TABLE ONLY "public"."SpaceAccess"
    ADD CONSTRAINT "SpaceAccess_account_id_space_id_key" UNIQUE ("account_id", "space_id");

ALTER TABLE ONLY "public"."SpaceAccess"
    ADD CONSTRAINT "SpaceAccess_pkey" PRIMARY KEY ("id");


ALTER TABLE "public"."SpaceAccess" OWNER TO "postgres";

COMMENT ON TABLE "public"."SpaceAccess" IS 'An access control entry for a space';

COMMENT ON COLUMN "public"."SpaceAccess"."space_id" IS 'The space in which the content is located';



ALTER TABLE ONLY "public"."SpaceAccess"
    ADD CONSTRAINT "SpaceAccess_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."Account"("id") ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "public"."SpaceAccess"
    ADD CONSTRAINT "SpaceAccess_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."DiscourseSpace"("id") ON UPDATE CASCADE ON DELETE CASCADE;

GRANT ALL ON TABLE "public"."SpaceAccess" TO "anon";
GRANT ALL ON TABLE "public"."SpaceAccess" TO "authenticated";
GRANT ALL ON TABLE "public"."SpaceAccess" TO "service_role";


GRANT ALL ON TABLE "public"."Account" TO "anon";
GRANT ALL ON TABLE "public"."Account" TO "authenticated";
GRANT ALL ON TABLE "public"."Account" TO "service_role";
