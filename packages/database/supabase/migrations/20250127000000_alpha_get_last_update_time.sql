CREATE OR REPLACE FUNCTION public.alpha_get_last_update_time(p_space_name text)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    space_record RECORD;
    max_last_modified timestamp without time zone;
BEGIN
    -- Find the space by name
    SELECT id, name INTO space_record
    FROM public."DiscourseSpace"
    WHERE name = p_space_name;
    
    -- If space not found, return null for last_update_time
    IF NOT FOUND THEN
        RETURN json_build_object('last_update_time', NULL);
    END IF;
    
    -- Find the maximum last_modified time for all documents in this space
    SELECT MAX(d.last_modified) INTO max_last_modified
    FROM public."Document" d
    WHERE d.space_id = space_record.id;
    
    -- Return the result as JSON object
    RETURN json_build_object('last_update_time', max_last_modified);
END;
$$;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.alpha_get_last_update_time(text) TO authenticated;
-- Add comment for documentation
COMMENT ON FUNCTION public.alpha_get_last_update_time(text) IS 'Returns the latest last_modified timestamp for all documents in the specified discourse space as JSON object';
