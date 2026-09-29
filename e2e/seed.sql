-- E2E fixtures. Idempotent: safe to re-run before every suite.
-- Password for every seeded account: E2ePass@2026!
-- Admin must_change_password is false so the login goes straight to the app;
-- the change-password flow is exercised explicitly by its own spec.

INSERT INTO users (email, password_hash, full_name, company, must_change_password) VALUES
  ('e2e-admin@trustguard.test',   '$2b$12$YetlBf1Gv1bFNoRwGSWnaev.8ElaA9ZXa2Oco8yfnXTb4R3rIHDPu', 'E2E Admin',   'TrustGuard', false),
  ('e2e-analyst@trustguard.test', '$2b$12$YetlBf1Gv1bFNoRwGSWnaev.8ElaA9ZXa2Oco8yfnXTb4R3rIHDPu', 'E2E Analyst', 'TrustGuard', false),
  ('e2e-vendor@trustguard.test',  '$2b$12$YetlBf1Gv1bFNoRwGSWnaev.8ElaA9ZXa2Oco8yfnXTb4R3rIHDPu', 'E2E Vendor',  'Acme',       false)
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  must_change_password = false,
  is_active = true;

INSERT INTO user_roles (user_id, role)
SELECT id, 'admin' FROM users WHERE email = 'e2e-admin@trustguard.test'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT id, 'tprm_analyst' FROM users WHERE email = 'e2e-analyst@trustguard.test'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role)
SELECT id, 'vendor' FROM users WHERE email = 'e2e-vendor@trustguard.test'
ON CONFLICT DO NOTHING;

-- Vendor owned by the vendor user, so the vendor can fill in the questionnaire.
-- vendors.name has no unique constraint, so guard with NOT EXISTS rather than
-- ON CONFLICT (which would insert a duplicate row on every run).
INSERT INTO vendors (name, category, industry, contact_email, status, owner_user_id)
SELECT 'E2E Acme Cloud', 'Cloud Services', 'Technology', 'e2e-vendor@trustguard.test', 'active', u.id
FROM users u
WHERE u.email = 'e2e-vendor@trustguard.test'
  AND NOT EXISTS (SELECT 1 FROM vendors WHERE name = 'E2E Acme Cloud');

-- Remove any assessment/invitation leftovers for the seeded vendor so each run
-- starts from a clean slate (cascades to responses, evidence, review history).
DELETE FROM assessments
WHERE vendor_id IN (SELECT id FROM vendors WHERE name = 'E2E Acme Cloud');
