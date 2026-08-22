import { describe, expect, it } from "vitest";
import { createServerSupabaseClient } from "../supabase";
import { getCustomerDossier, searchCustomers } from "../tools";

const hasSupabaseEnv =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SECRET_KEY);

const describeIntegration = hasSupabaseEnv ? describe : describe.skip;

describeIntegration("tools integration (live Supabase)", () => {
  it('searchCustomers("Shellstrop") returns Eleanor', async () => {
    const client = createServerSupabaseClient();
    const result = await searchCustomers(client, { query: "Shellstrop" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.length).toBeGreaterThan(0);
      const match = result.data.find((c) => c.last_name === "Shellstrop");
      expect(match).toBeDefined();
      expect(match?.first_name).toBe("Eleanor");
    }
  });

  it('searchCustomers("Peterson") returns empty list', async () => {
    const client = createServerSupabaseClient();
    const result = await searchCustomers(client, { query: "Peterson" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([]);
    }
  });

  it("getCustomerDossier includes subscriptions and invoices", async () => {
    const client = createServerSupabaseClient();
    const search = await searchCustomers(client, { query: "Shellstrop" });
    expect(search.success).toBe(true);
    if (!search.success || search.data.length === 0) {
      throw new Error("Expected Eleanor Shellstrop in search results");
    }

    const dossier = await getCustomerDossier(client, {
      customerId: search.data[0].id,
    });

    expect(dossier.success).toBe(true);
    if (dossier.success) {
      expect(dossier.data.subscriptions.length).toBeGreaterThan(0);
      expect(dossier.data.invoices.length).toBeGreaterThan(0);
    }
  });
});
