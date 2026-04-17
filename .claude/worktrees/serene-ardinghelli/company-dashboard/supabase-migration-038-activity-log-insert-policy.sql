-- Allow authenticated users to insert into activity_log
-- (for news collection, briefing, etc. from the dashboard)

-- Check existing policies
-- SELECT * FROM pg_policies WHERE tablename = 'activity_log';

-- Add insert policy for authenticated users
CREATE POLICY "authenticated_insert_activity_log"
ON activity_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also allow update (for future use)
CREATE POLICY "authenticated_update_activity_log"
ON activity_log
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
