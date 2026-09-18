-- Phase 4: restaurant logos storage + align branch management RLS with restaurant.manage

-- ---------------------------------------------------------------------------
-- Storage bucket (public read for logo URLs; write restricted by policies)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'restaurant-logos',
  'restaurant-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path convention: restaurant-logos/{restaurant_id}/{filename}
CREATE POLICY "restaurant_logos_select_member"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'restaurant-logos'
    AND public.is_restaurant_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "restaurant_logos_select_public"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'restaurant-logos');

CREATE POLICY "restaurant_logos_insert_owner_admin"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'restaurant-logos'
    AND public.has_restaurant_role(
      (storage.foldername(name))[1]::uuid,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "restaurant_logos_update_owner_admin"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'restaurant-logos'
    AND public.has_restaurant_role(
      (storage.foldername(name))[1]::uuid,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  )
  WITH CHECK (
    bucket_id = 'restaurant-logos'
    AND public.has_restaurant_role(
      (storage.foldername(name))[1]::uuid,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "restaurant_logos_delete_owner_admin"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'restaurant-logos'
    AND public.has_restaurant_role(
      (storage.foldername(name))[1]::uuid,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

-- ---------------------------------------------------------------------------
-- Branch management: only OWNER/ADMIN (matches restaurant.manage permission)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "branches_insert_manager_up" ON public.branches;
DROP POLICY IF EXISTS "branches_update_manager_up" ON public.branches;

CREATE POLICY "branches_insert_owner_admin"
  ON public.branches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );

CREATE POLICY "branches_update_owner_admin"
  ON public.branches
  FOR UPDATE
  TO authenticated
  USING (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  )
  WITH CHECK (
    public.has_restaurant_role(
      restaurant_id,
      ARRAY['OWNER', 'ADMIN']::public.member_role[]
    )
  );
