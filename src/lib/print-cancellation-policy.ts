/** Print Cancellation Policy & Terms — customer-facing checkout copy. */

export const PRINT_CANCELLATION_POLICY_TITLE = "Print Cancellation Policy & Terms";

export const PRINT_CANCELLATION_POLICY_SECTIONS: Array<{
  heading: string;
  body: string;
}> = [
  {
    heading: "Cancellations and modifications",
    body: "Cancellation or modification requests are allowed within 30 minutes of placing your order. After 30 minutes, your order may enter production and cannot be canceled, modified, returned, or refunded.",
  },
  {
    heading: "Custom-made products",
    body: "Our prints and related products are custom-made. Once production begins, all sales are final.",
  },
  {
    heading: "Damaged or incorrect orders",
    body: "Damaged or incorrect orders must be reported within 3 days of delivery or pickup so we can review and resolve the issue.",
  },
  {
    heading: "Image selection and quality",
    body: "You are responsible for image selection and image quality. Please review your files carefully before ordering.",
  },
  {
    heading: "Color and cropping",
    body: "Minor differences in color, brightness, contrast, and cropping may occur between your screen and the finished print.",
  },
  {
    heading: "Shipping information",
    body: "You are responsible for providing correct shipping information. We are not responsible for delays or failed delivery caused by inaccurate address details.",
  },
];
