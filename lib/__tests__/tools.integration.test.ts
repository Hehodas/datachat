import { describe, expect, it } from "vitest";
import { createServerSupabaseClient } from "../supabase";
import { getCustomerDossier, searchByTopic, searchCustomers } from "../tools";

const hasSupabaseEnv =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SECRET_KEY);

const describeIntegration = hasSupabaseEnv ? describe : describe.skip;

const PAYMENT_METHOD_KEYS = ["provider", "payment_type", "last_four_digits", "is_default"];

describeIntegration("tools integration (live Supabase)", () => {
  it('searchCustomers("Shellstrop") returns Eleanor', async () => {
    const client = createServerSupabaseClient();
    const result = await searchCustomers(client, { query: "Shellstrop" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.matches.length).toBeGreaterThan(0);
      const match = result.data.matches.find((hit) => hit.customer.last_name === "Shellstrop");
      expect(match).toBeDefined();
      expect(match?.customer.first_name).toBe("Eleanor");
    }
  });

  it('searchCustomers("Eleanor Shellstrop") returns Eleanor as a full match', async () => {
    const client = createServerSupabaseClient();
    const result = await searchCustomers(client, { query: "Eleanor Shellstrop" });

    expect(result.success).toBe(true);
    if (result.success) {
      const match = result.data.matches.find(
        (hit) => hit.customer.last_name === "Shellstrop",
      );
      expect(match).toBeDefined();
      expect(match?.customer.first_name).toBe("Eleanor");
      expect(match?.match).toBe("full");
    }
  });

  it('searchCustomers("Peterson") returns empty list', async () => {
    const client = createServerSupabaseClient();
    const result = await searchCustomers(client, { query: "Peterson" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.matches).toEqual([]);
    }
  });

  it('searchCustomers("O\'Brien") does not 500', async () => {
    const client = createServerSupabaseClient();
    const result = await searchCustomers(client, { query: "O'Brien" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Array.isArray(result.data.matches)).toBe(true);
    }
  });

  it('searchByTopic("unpaid") returns invoices', async () => {
    const client = createServerSupabaseClient();
    const result = await searchByTopic(client, { query: "unpaid" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.invoices.length).toBeGreaterThan(0);
    }
  });

  it('searchByTopic("unpaid,customer_id.not.is.null") succeeds without dumping all incidents', async () => {
    const client = createServerSupabaseClient();
    const result = await searchByTopic(client, { query: "unpaid,customer_id.not.is.null" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.incidents.length).toBeLessThan(50);
    }
  });

  it("getCustomerDossier includes subscriptions and invoices", async () => {
    const client = createServerSupabaseClient();
    const search = await searchCustomers(client, { query: "Shellstrop" });
    expect(search.success).toBe(true);
    if (!search.success || search.data.matches.length === 0) {
      throw new Error("Expected Eleanor Shellstrop in search results");
    }

    const dossier = await getCustomerDossier(client, {
      customerId: search.data.matches[0].customer.id,
    });

    expect(dossier.success).toBe(true);
    if (dossier.success) {
      expect(dossier.data.subscriptions.length).toBeGreaterThan(0);
      expect(dossier.data.invoices.length).toBeGreaterThan(0);
    }
  });

  it("getCustomerDossier payment_methods rows only expose allow-listed keys", async () => {
    const client = createServerSupabaseClient();
    const search = await searchCustomers(client, { query: "Shellstrop" });
    expect(search.success).toBe(true);
    if (!search.success || search.data.matches.length === 0) {
      throw new Error("Expected Eleanor Shellstrop in search results");
    }

    const dossier = await getCustomerDossier(client, {
      customerId: search.data.matches[0].customer.id,
    });

    expect(dossier.success).toBe(true);
    if (dossier.success && dossier.data.payment_methods.length > 0) {
      for (const method of dossier.data.payment_methods) {
        expect(Object.keys(method).sort()).toEqual(PAYMENT_METHOD_KEYS.sort());
      }
    }
  });
});
