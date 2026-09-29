import { Page, expect } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL || 'http://localhost:3000';

export const ACCOUNTS = {
  admin: { email: 'e2e-admin@trustguard.test', password: 'E2ePass@2026!' },
  analyst: { email: 'e2e-analyst@trustguard.test', password: 'E2ePass@2026!' },
  vendor: { email: 'e2e-vendor@trustguard.test', password: 'E2ePass@2026!' },
} as const;

export type Role = keyof typeof ACCOUNTS;

/** Log in through the real form and wait until the app leaves /auth. */
export async function login(page: Page, role: Role) {
  const { email, password } = ACCOUNTS[role];
  await page.goto('/auth');
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
}

/** Get a JWT straight from the API, for seeding data a spec needs. */
export async function apiToken(request: Page['request'], role: Role): Promise<string> {
  const { email, password } = ACCOUNTS[role];
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  });
  expect(res.ok(), `login for ${role} failed: ${res.status()}`).toBeTruthy();
  return (await res.json()).token;
}

/**
 * Create a vendor via the API and return its id.
 * Only admin/analyst may create vendors, so this always uses a TPRM token even
 * when the spec later signs in as the vendor.
 */
export async function createVendor(
  request: Page['request'],
  name: string,
  ownerUserId?: string,
): Promise<string> {
  const token = await apiToken(request, 'admin');
  const res = await request.post(`${API_URL}/api/vendors`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name,
      category: 'Cloud Services',
      contact_email: 'vendor@e2e.test',
      ...(ownerUserId ? { owner_user_id: ownerUserId } : {}),
    },
  });
  expect(res.ok(), `create vendor failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).vendor.id;
}

/** The vendor account's user id, for making it the owner of a vendor. */
export async function userIdOf(request: Page['request'], role: Role): Promise<string> {
  const token = await apiToken(request, role);
  const res = await request.get(`${API_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).user.id;
}

/** Create an assessment via the API and return its id. TPRM only. */
export async function createAssessment(
  request: Page['request'],
  vendorId: string,
): Promise<string> {
  const token = await apiToken(request, 'admin');
  const res = await request.post(`${API_URL}/api/assessments`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { vendor_id: vendorId },
  });
  expect(res.ok(), `create assessment failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()).assessment.id;
}

/**
 * A vendor owned by the seeded vendor account, plus an assessment for it.
 * The questionnaire routes check vendor ownership, so specs that sign in as the
 * vendor need this rather than a TPRM-owned vendor.
 */
export async function vendorOwnedAssessment(
  request: Page['request'],
  vendorName: string,
): Promise<string> {
  const ownerId = await userIdOf(request, 'vendor');
  const vendorId = await createVendor(request, vendorName, ownerId);
  return createAssessment(request, vendorId);
}

/** Answer every question via the API, then submit. */
export async function completeAssessment(
  request: Page['request'],
  assessmentId: string,
  asRole: Role = 'vendor',
  answerFor: (type: string, options: string[] | null) => unknown = (type, options) =>
    type === 'multiple-choice' ? [options?.[0] ?? 'None'] : (options?.[0] ?? 'Yes'),
) {
  const token = await apiToken(request, asRole);
  const auth = { Authorization: `Bearer ${token}` };
  const qRes = await request.get(`${API_URL}/api/questions`, { headers: auth });
  expect(qRes.ok()).toBeTruthy();
  const questions = (await qRes.json()).data as {
    id: string;
    type: string;
    options: string[] | null;
  }[];

  for (const q of questions) {
    const res = await request.post(`${API_URL}/api/assessments/${assessmentId}/responses`, {
      headers: auth,
      data: { question_id: q.id, answer: answerFor(q.type, q.options) },
    });
    expect(res.ok(), `answer ${q.id} failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  }

  const submit = await request.post(`${API_URL}/api/assessments/${assessmentId}/submit`, {
    headers: auth,
  });
  expect(submit.ok(), `submit failed: ${submit.status()} ${await submit.text()}`).toBeTruthy();
}
