-- Create permanent support chat session (999999)
-- This session is always available but NEVER active (to avoid interfering with quiz system)
-- Run this script if the support chat session doesn't exist

-- Insert support session (or update if exists)
INSERT INTO quizSessions (
    id, 
    session_date, 
    name, 
    description, 
    sessionStatusId, 
    themeId, 
    hostUserId, 
    start_time
) VALUES (
    999999,                                          -- Fixed ID for support
    NOW(),                                            -- Session date
    'Support Chat',                                   -- Session name
    'Community support chat session - always available but NEVER active', -- Description
    1,                                                -- Status 1 = Inactive (MUST stay inactive!)
    1,                                                -- Theme (placeholder)
    1,                                                -- Host user (system user)
    NOW()                                             -- Start time
) ON DUPLICATE KEY UPDATE 
    sessionStatusId = 3,                              -- Keep it INACTIVE (never set to 2!) so 3, as 1 gets set to 2 by the quiz
    description = 'Community support chat session - always available but NEVER active';

-- Verify the session was created
SELECT 
    id, 
    name, 
    sessionStatusId, 
    themeId, 
    hostUserId,
    start_time 
FROM quizSessions 
WHERE id = 999999;
