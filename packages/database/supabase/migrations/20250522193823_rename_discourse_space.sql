ALTER TABLE public."DiscoursePlatform" RENAME TO "Platform";
ALTER TABLE public."Platform" RENAME CONSTRAINT "DiscoursePlatform_pkey" TO "Platform_pkey";

ALTER TABLE public."DiscourseSpace" RENAME TO "Space";
ALTER TABLE public."Space" RENAME CONSTRAINT "DiscourseSpace_pkey" TO "Space_pkey";
ALTER TABLE public."Space" RENAME COLUMN discourse_platform_id TO platform_id;
ALTER TABLE PUBLIC."Space" RENAME CONSTRAINT "DiscourseSpace_discourse_platform_id_fkey" TO "Space_platform_id_fkey";

COMMENT ON TABLE public."Space" IS
'A space on a platform representing a community engaged in a conversation';
COMMENT ON TABLE public."Account" IS 'A user account on a platform';
