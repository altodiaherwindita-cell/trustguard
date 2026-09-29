import { test, expect } from '@playwright/test';
import { API_URL, ACCOUNTS, login, apiToken, createVendor, createAssessment } from './helpers';

/**
 * The vendor path used to be unreachable end to end: creating a vendor through
 * the UI never set owner_user_id, and no endpoint ever accepted an invitation,
 * so an invited vendor saw an empty dashboard forever. Every other spec hid this
 * because `createVendor` takes an optional ownerUserId and the specs that sign
 * in as the vendor always pass it. These specs deliberately do not.
 */
test.describe('Vendor invitation acceptance', () => {
  test('an invited vendor is bound to the vendor record by accepting', async ({ page, request }) => {
    const name = `E2E Accept Vendor ${Date.now()}`;

    const analystToken = await apiToken(request, 'analyst');
    // No ownerUserId — exactly what the Add Vendor form produces.
    const vendorId = await createVendor(request, name);
    const assessmentId = await createAssessment(request, vendorId);

    const inviteRes = await request.post(`${API_URL}/api/invitations`, {
      headers: { Authorization: `Bearer ${analystToken}` },
      data: {
        vendorId,
        assessmentId,
        email: ACCOUNTS.vendor.email,
        sendEmailNotification: false,
      },
    });
    expect(inviteRes.ok(), await inviteRes.text()).toBeTruthy();
    const token = (await inviteRes.json()).invitation.token;

    // Before accepting, the vendor cannot see it. This is the bug's symptom.
    const vendorToken = await apiToken(request, 'vendor');
    const before = await request.get(`${API_URL}/api/vendors/my-vendors`, {
      headers: { Authorization: `Bearer ${vendorToken}` },
    });
    const beforeIds = (await before.json()).vendors.map((v: { id: string }) => v.id);
    expect(beforeIds).not.toContain(vendorId);

    // Accept through the real UI, signed in as the invited account.
    await login(page, 'vendor');
    await page.goto(`/invite/${token}`);
    await page.waitForURL(`**/questionnaire/${assessmentId}`, { timeout: 30_000 });

    // And now the vendor owns it, so the questionnaire routes stop 403ing.
    const after = await request.get(`${API_URL}/api/vendors/my-vendors`, {
      headers: { Authorization: `Bearer ${vendorToken}` },
    });
    const afterIds = (await after.json()).vendors.map((v: { id: string }) => v.id);
    expect(afterIds).toContain(vendorId);

    const questionnaire = await request.get(`${API_URL}/api/assessments/${assessmentId}`, {
      headers: { Authorization: `Bearer ${vendorToken}` },
    });
    expect(questionnaire.status(), 'vendor must be able to open its own assessment').toBe(200);
  });

  test('accepting twice does not consume or break the invitation', async ({ request }) => {
    const analystToken = await apiToken(request, 'analyst');
    const vendorId = await createVendor(request, `E2E Reaccept Vendor ${Date.now()}`);
    const assessmentId = await createAssessment(request, vendorId);
    const inviteRes = await request.post(`${API_URL}/api/invitations`, {
      headers: { Authorization: `Bearer ${analystToken}` },
      data: { vendorId, assessmentId, email: ACCOUNTS.vendor.email, sendEmailNotification: false },
    });
    const token = (await inviteRes.json()).invitation.token;
    const vendorToken = await apiToken(request, 'vendor');
    const auth = { Authorization: `Bearer ${vendorToken}` };

    const first = await request.post(`${API_URL}/api/invitations/${token}/accept`, { headers: auth });
    expect(first.ok(), await first.text()).toBeTruthy();
    const second = await request.post(`${API_URL}/api/invitations/${token}/accept`, { headers: auth });
    expect(second.ok(), 're-opening the invite link must not fail').toBeTruthy();
  });

  test('a signed-in account that is not the invitee is refused', async ({ request }) => {
    const analystToken = await apiToken(request, 'analyst');
    const vendorId = await createVendor(request, `E2E Wrong Account Vendor ${Date.now()}`);
    const assessmentId = await createAssessment(request, vendorId);
    const inviteRes = await request.post(`${API_URL}/api/invitations`, {
      headers: { Authorization: `Bearer ${analystToken}` },
      data: {
        vendorId,
        assessmentId,
        email: 'someone-else@e2e.test',
        sendEmailNotification: false,
      },
    });
    const token = (await inviteRes.json()).invitation.token;

    const vendorToken = await apiToken(request, 'vendor');
    const res = await request.post(`${API_URL}/api/invitations/${token}/accept`, {
      headers: { Authorization: `Bearer ${vendorToken}` },
    });
    expect(res.status()).toBe(403);

    // The refusal must not have bound anything.
    const mine = await request.get(`${API_URL}/api/vendors/my-vendors`, {
      headers: { Authorization: `Bearer ${vendorToken}` },
    });
    const ids = (await mine.json()).vendors.map((v: { id: string }) => v.id);
    expect(ids).not.toContain(vendorId);
  });
});
