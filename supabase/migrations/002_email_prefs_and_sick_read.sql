ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE POLICY "sick_reviewer_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'sick-leave-attachments'
    AND EXISTS (
      SELECT 1
      FROM public.project_members reviewer
      JOIN public.project_members member
        ON member.project_id = reviewer.project_id
        AND member.user_id = ((storage.foldername(name))[1])::uuid
      WHERE reviewer.user_id = auth.uid()
        AND reviewer.role IN ('admin', 'lead')
    )
  );
