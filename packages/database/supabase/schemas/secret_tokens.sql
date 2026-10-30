CREATE TABLE IF NOT EXISTS public.secret_token (
    id varchar PRIMARY KEY DEFAULT encode(extensions.gen_random_bytes(12), 'base64'),
    creator UUID NOT NULL DEFAULT auth.uid(),
    payload JSONB NOT NULL,
    expiry_date timestamp without time zone,
    one_time_use boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS secret_token_expiry_idx ON public.secret_token (expiry_date) WHERE expiry_date IS NOT null;

CREATE OR REPLACE FUNCTION public.create_secret_token(v_payload JSONB, v_one_time_use BOOLEAN DEFAULT true, expiry_interval INTERVAL DEFAULT '30d') RETURNS VARCHAR
SECURITY DEFINER
SET search_path = ''
LANGUAGE sql AS $$
    INSERT INTO public.secret_token (payload, expiry_date, one_time_use) VALUES (v_payload, now()+expiry_interval, v_one_time_use) RETURNING id;
$$;

-- Admin panels and the website call it after logging in; creator defaults to auth.uid(), which is NOT NULL.
REVOKE ALL ON FUNCTION public.create_secret_token FROM anon;

CREATE OR REPLACE FUNCTION public.get_secret_token(token VARCHAR) RETURNS JSONB
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql AS $$
DECLARE
v_payload JSONB;
v_one_time_use BOOLEAN;
BEGIN
    DELETE FROM public.secret_token WHERE expiry_date < now();
    DELETE FROM public.secret_token WHERE id=token AND one_time_use = true RETURNING payload INTO v_payload;
    IF v_payload IS NULL THEN
        SELECT payload INTO v_payload FROM public.secret_token WHERE id=token;
    END IF;
    RETURN v_payload;
END;
$$;

-- The website's /auth/token route hands a plugin's session to a browser that isn't logged in yet.
GRANT EXECUTE ON FUNCTION public.get_secret_token TO anon;

ALTER TABLE public.secret_token OWNER TO "postgres";

REVOKE ALL ON TABLE public.secret_token FROM anon;
GRANT ALL ON TABLE public.secret_token TO authenticated;
GRANT ALL ON TABLE public.secret_token TO service_role;

ALTER TABLE public.secret_token ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS concept_policy ON public.secret_token;
DROP POLICY IF EXISTS concept_select_policy ON public.secret_token;
CREATE POLICY concept_select_policy ON public.secret_token FOR SELECT USING (creator = (SELECT auth.uid()));
DROP POLICY IF EXISTS concept_delete_policy ON public.secret_token;
CREATE POLICY concept_delete_policy ON public.secret_token FOR DELETE USING (creator = (SELECT auth.uid()));
DROP POLICY IF EXISTS concept_insert_policy ON public.secret_token;
-- Do not allow insert except through create_secret_token
DROP POLICY IF EXISTS concept_update_policy ON public.secret_token;
CREATE POLICY concept_update_policy ON public.secret_token FOR UPDATE USING (creator = (SELECT auth.uid()));
