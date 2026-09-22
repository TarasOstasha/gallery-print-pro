/**
 * Transactional email abstraction. No email provider/domain is connected yet,
 * so messages are logged. Swap the body of `sendEmail` for a provider call
 * without touching any caller.
 */
export type OutgoingEmail = {
  to: string;
  subject: string;
  body: string;
};

export async function sendEmail(email: OutgoingEmail): Promise<{ sent: boolean }> {
  console.info("[email]", email.to, "|", email.subject, "\n", email.body);
  return { sent: false };
}

export function orderConfirmationEmail(params: {
  to: string;
  firstName: string;
  orderNumber: string;
  totalCents: number;
  fulfillmentMethod: "shipping" | "studio_pickup";
  pickupNote: string;
}): OutgoingEmail {
  const total = (params.totalCents / 100).toFixed(2);
  const closing =
    params.fulfillmentMethod === "studio_pickup"
      ? params.pickupNote
      : "You will receive tracking details as soon as your prints ship.";
  return {
    to: params.to,
    subject: `Order #${params.orderNumber} confirmed`,
    body: `Hi ${params.firstName},\n\nThank you for your order. Order #${params.orderNumber} totalling $${total} is now in production.\n\n${closing}\n\nAtelier Nord`,
  };
}

export function readyForPickupEmail(params: {
  to: string;
  firstName: string;
  orderNumber: string;
  studioAddress: string;
}): OutgoingEmail {
  return {
    to: params.to,
    subject: `Order #${params.orderNumber} is ready for pickup`,
    body: `Hi ${params.firstName},\n\nYour prints for order #${params.orderNumber} are ready to collect at:\n\n${params.studioAddress}\n\nAtelier Nord`,
  };
}
