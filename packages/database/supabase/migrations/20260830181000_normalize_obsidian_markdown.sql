CREATE OR REPLACE FUNCTION public.normalize_native_content_type() RETURNS TRIGGER
SET search_path = ''
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.content_type = 'text/obsidian+markdown' THEN
    NEW.content_type := 'text/markdown';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS normalize_content_native_type ON public."Content";
CREATE TRIGGER normalize_content_native_type
BEFORE INSERT OR UPDATE OF content_type ON public."Content"
FOR EACH ROW EXECUTE FUNCTION public.normalize_native_content_type();

DROP TRIGGER IF EXISTS normalize_document_native_type ON public."Document";
CREATE TRIGGER normalize_document_native_type
BEFORE INSERT OR UPDATE OF content_type ON public."Document"
FOR EACH ROW EXECUTE FUNCTION public.normalize_native_content_type();

UPDATE public."Content" AS legacy
SET content_type = 'text/markdown'
WHERE legacy.content_type = 'text/obsidian+markdown'
  AND NOT EXISTS (
    SELECT 1
    FROM public."Content" AS canonical_native
    WHERE canonical_native.space_id = legacy.space_id
      AND canonical_native.source_local_id = legacy.source_local_id
      AND canonical_native.variant = legacy.variant
      AND canonical_native.content_type = 'text/markdown'
  );

UPDATE public."Document"
SET content_type = 'text/markdown'
WHERE content_type = 'text/obsidian+markdown';
