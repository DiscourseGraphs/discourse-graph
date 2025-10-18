-- on update content text trigger
CREATE OR REPLACE FUNCTION public.after_update_content_text_trigger ()
RETURNS TRIGGER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.text != NEW.text THEN
        DELETE FROM public."ContentEmbedding_openai_text_embedding_3_small_1536" WHERE target_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ ;

CREATE TRIGGER on_update_text_trigger AFTER UPDATE ON public."Content"
FOR EACH ROW EXECUTE FUNCTION public.after_update_content_text_trigger () ;
