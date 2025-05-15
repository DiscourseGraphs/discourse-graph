CREATE TABLE IF NOT EXISTS "public"."DiscoursePlatform" (
    "id" bigint DEFAULT "nextval"('"public"."entity_id_seq"'::"regclass") NOT NULL,
    "name" character varying NOT NULL,
    "url" character varying NOT NULL
);

ALTER TABLE "public"."DiscoursePlatform" OWNER TO "postgres";

COMMENT ON TABLE "public"."DiscoursePlatform" IS 'A data platform where discourse happens';

CREATE TABLE IF NOT EXISTS "public"."DiscourseSpace" (
    "id" bigint DEFAULT "nextval"('"public"."entity_id_seq"'::"regclass") NOT NULL,
    "url" character varying,
    "name" character varying NOT NULL,
    "discourse_platform_id" bigint NOT NULL
);

ALTER TABLE "public"."DiscourseSpace" OWNER TO "postgres";

COMMENT ON TABLE "public"."DiscourseSpace" IS 'A space on a discourse platform representing a community engaged in a conversation';

ALTER TABLE ONLY "public"."DiscoursePlatform"
    ADD CONSTRAINT "DiscoursePlatform_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."DiscourseSpace"
    ADD CONSTRAINT "DiscourseSpace_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."DiscourseSpace"
    ADD CONSTRAINT "DiscourseSpace_discourse_platform_id_fkey" FOREIGN KEY ("discourse_platform_id") REFERENCES "public"."DiscoursePlatform"("id") ON UPDATE CASCADE ON DELETE CASCADE;

GRANT ALL ON TABLE "public"."DiscoursePlatform" TO "anon";
GRANT ALL ON TABLE "public"."DiscoursePlatform" TO "authenticated";
GRANT ALL ON TABLE "public"."DiscoursePlatform" TO "service_role";

GRANT ALL ON TABLE "public"."DiscourseSpace" TO "anon";
GRANT ALL ON TABLE "public"."DiscourseSpace" TO "authenticated";
GRANT ALL ON TABLE "public"."DiscourseSpace" TO "service_role";
