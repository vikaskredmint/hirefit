
CREATE POLICY "Auth read resumes" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'resumes');
CREATE POLICY "Auth insert resumes" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resumes');
CREATE POLICY "Auth update resumes" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'resumes') WITH CHECK (bucket_id = 'resumes');
CREATE POLICY "Auth delete resumes" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'resumes');
