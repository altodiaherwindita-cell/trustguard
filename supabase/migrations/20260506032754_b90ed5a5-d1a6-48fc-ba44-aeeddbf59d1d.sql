
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'tprm_analyst', 'vendor');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_tprm(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','tprm_analyst')) $$;

CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  company TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_tprm(auth.uid()));
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admins manage profiles" ON public.profiles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Signup trigger: create profile + assign role (first user => admin, else vendor)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, company)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'company');

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count <= 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'vendor');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Vendors
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  industry TEXT,
  contact_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  current_risk_score INT,
  current_risk_level TEXT,
  last_assessment_at TIMESTAMPTZ,
  owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TPRM full access vendors" ON public.vendors FOR ALL TO authenticated
  USING (public.is_tprm(auth.uid())) WITH CHECK (public.is_tprm(auth.uid()));
CREATE POLICY "Vendor reads own vendor" ON public.vendors FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid());

-- Questions (data-driven)
CREATE TABLE public.questions (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  type TEXT NOT NULL,
  options JSONB,
  weight INT NOT NULL DEFAULT 5,
  risk_impact TEXT NOT NULL DEFAULT 'medium',
  display_order INT NOT NULL DEFAULT 0
);
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated reads questions" ON public.questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "TPRM manages questions" ON public.questions FOR ALL TO authenticated
  USING (public.is_tprm(auth.uid())) WITH CHECK (public.is_tprm(auth.uid()));

-- Assessments
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not-started',
  overall_score INT,
  risk_score INT,
  risk_level TEXT,
  ai_summary TEXT,
  strengths JSONB,
  weaknesses JSONB,
  recommendations JSONB,
  category_scores JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ
);
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TPRM full access assessments" ON public.assessments FOR ALL TO authenticated
  USING (public.is_tprm(auth.uid())) WITH CHECK (public.is_tprm(auth.uid()));
CREATE POLICY "Vendor sees own assessments" ON public.assessments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.owner_user_id = auth.uid()));
CREATE POLICY "Vendor updates own assessments" ON public.assessments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.owner_user_id = auth.uid()));

-- Responses
CREATE TABLE public.assessment_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  answer JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assessment_id, question_id)
);
ALTER TABLE public.assessment_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TPRM full access responses" ON public.assessment_responses FOR ALL TO authenticated
  USING (public.is_tprm(auth.uid())) WITH CHECK (public.is_tprm(auth.uid()));
CREATE POLICY "Vendor manages own responses" ON public.assessment_responses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessments a JOIN public.vendors v ON v.id = a.vendor_id
                  WHERE a.id = assessment_id AND v.owner_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.assessments a JOIN public.vendors v ON v.id = a.vendor_id
                  WHERE a.id = assessment_id AND v.owner_user_id = auth.uid()));

-- Invitations
CREATE TABLE public.assessment_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);
ALTER TABLE public.assessment_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "TPRM full access invitations" ON public.assessment_invitations FOR ALL TO authenticated
  USING (public.is_tprm(auth.uid())) WITH CHECK (public.is_tprm(auth.uid()));

-- Seed questions
INSERT INTO public.questions (id, category, question, type, options, weight, risk_impact, display_order) VALUES
('q1','Data Protection','Does your organization encrypt data at rest?','boolean',NULL,10,'high',1),
('q2','Data Protection','What encryption standards do you use for data in transit?','single-choice','["TLS 1.3","TLS 1.2","TLS 1.1 or lower","No encryption"]',10,'high',2),
('q3','Access Control','Do you implement multi-factor authentication (MFA)?','boolean',NULL,8,'high',3),
('q4','Access Control','How often do you review user access privileges?','single-choice','["Monthly","Quarterly","Annually","Never"]',6,'medium',4),
('q5','Incident Response','Do you have a documented incident response plan?','boolean',NULL,8,'high',5),
('q6','Incident Response','What is your average incident response time?','single-choice','["Under 1 hour","1-4 hours","4-24 hours","Over 24 hours"]',7,'medium',6),
('q7','Compliance','Which compliance certifications does your organization hold?','multiple-choice','["SOC 2","ISO 27001","GDPR","HIPAA","PCI DSS","None"]',9,'high',7),
('q8','Security Operations','Do you conduct regular penetration testing?','boolean',NULL,7,'medium',8),
('q9','Security Operations','How frequently do you perform vulnerability assessments?','single-choice','["Weekly","Monthly","Quarterly","Annually","Never"]',7,'medium',9),
('q10','Business Continuity','What is your Recovery Time Objective (RTO)?','single-choice','["Under 1 hour","1-4 hours","4-24 hours","Over 24 hours"]',6,'medium',10);
