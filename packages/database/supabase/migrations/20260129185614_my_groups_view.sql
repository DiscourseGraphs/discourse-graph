CREATE OR REPLACE VIEW public.my_groups AS
SELECT id, split_part(email,'@',1) AS name FROM auth.users
    JOIN public.group_membership ON (group_id=id)
    WHERE member_id = auth.uid();
