import { mobileAuth, mobileJSON, mobileFailure, MobileError } from "@/lib/mobile/auth";
import { syncHiwayInvoices } from "@/lib/gmail/sync-invoices";
import { GMAIL_RECONNECT_REQUIRED_MESSAGE } from "@/lib/gmail/oauth-grant";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    const { client, userId } = await mobileAuth(request);
    const invoices = await syncHiwayInvoices(client, userId);
    return mobileJSON({ count: invoices.length });
  } catch (error) {
    return mobileFailure(error instanceof Error && error.message === GMAIL_RECONNECT_REQUIRED_MESSAGE
      ? new MobileError(409, "Reconnectez Gmail depuis la version web pour actualiser les factures Hiway.") : error);
  }
}
