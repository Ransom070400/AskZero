-- Scope chat-attachments reads to the owner.
--
-- The original SELECT policy only checked bucket_id, so any signed-in user
-- could storage.list() another user's folder and enumerate their files.
-- Reads through the API (list/download) are now limited to the caller's own
-- folder. The bucket stays public so stored attachment URLs keep working for
-- the UI and for model providers fetching images; those URLs are unguessable
-- bearer links (random file names, see api/upload and api/image).

DROP POLICY IF EXISTS "Anyone can read chat attachments" ON storage.objects;

CREATE POLICY "Users can read own attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
