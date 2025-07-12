ALTER TABLE public.sync_info ADD COLUMN target_type public."EntityType" NOT NULL DEFAULT 'Space'::public."EntityType";
