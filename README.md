# Gallery Prints

I want to build a professional photography gallery and print-ordering website.

REFERENCE WEBSITES

Use these websites only as references for functionality and user flow:

WHCC
https://www.whcc.com/

Review WHCC for the types of professional photo products, print sizes, finishes, and general print-ordering concepts.

DynastyPix gallery
https://galleries.dynastypix.com/runway72026/

The CUSTOMER BUYING EXPERIENCE should work similarly to this gallery:
Gallery → Select Photo → Buy/Order Print → Select Product/Size → Add to Cart → Checkout.

Do NOT copy either website's design, branding, text, or assets. Build an original modern photography gallery interface.

CORE CONCEPT

This is a photography event gallery where customers can browse photos from an event and purchase physical prints.

Example:

Runway 7, 2026

Customer opens the event gallery and sees all photographs.

When the customer clicks a photograph, open it in a large lightbox/photo viewer.

The viewer should have:

Previous/Next photo

Favorite button

Download button if downloads are enabled

"Buy Print" / "Order Prints" button

Photo ID / image number

When the customer clicks "Buy Print", open the print ordering interface for THAT specific photograph.

PRINT ORDERING

The customer selects:

Product
Size
Quantity

For the initial MVP, create:

PRINTS

4x6
5x7
8x10
8x12
10x10
10x20
11x14
12x18
16x20
16x24
20x24
20x30

Products and sizes must NOT be hardcoded into the UI.

Create product data so an administrator can later control:

Product name

Category

Available sizes

Price

Description

Product image

Active/inactive

Sort order

Each size can have a different price.

Example:

Photographic Print

4x6  $X
5x7  $X
8x10  $X
11x14  $X

The selected gallery photograph should remain visible while configuring the print.

Show a preview of the selected photograph and selected crop/aspect ratio when possible.

Customer clicks:

ADD TO CART

CART

The cart should show:

Photo thumbnail
Photo ID
Product
Print size
Quantity
Unit price
Subtotal

Allow:

Change quantity
Remove item
Continue shopping
Proceed to checkout

A customer must be able to order multiple DIFFERENT photographs and different sizes/products in the same order.

Example:

IMG_1024
8x10 Print
Qty 2

IMG_1088
5x7 Print
Qty 1

IMG_1150
11x14 Print
Qty 1

CHECKOUT  VERY IMPORTANT

Checkout must have TWO fulfillment methods.

Display these prominently as two selectable cards:

[ SHIP MY ORDER ]

Have my prints shipped to my address.

[ STUDIO PICKUP ]

Pick up my finished prints directly from the photography studio.

Only ONE option can be selected.

OPTION 1  SHIPPING

If customer selects SHIPPING:

Display shipping address fields:

First Name
Last Name
Email
Phone

Address
Apartment/Suite
City
State
ZIP Code
Country

Then allow selection of shipping method.

For now structure the system to support:

Standard Shipping
Expedited Shipping

Shipping cost should be added to the order total.

Order summary:

Subtotal
Shipping
Tax
Total

The architecture should allow shipping rates to later come from an external shipping/fulfillment API instead of being permanently hardcoded.

OPTION 2  STUDIO PICKUP

If customer selects STUDIO PICKUP:

DO NOT ask for a shipping address.

Instead display:

STUDIO PICKUP
FREE

Your prints will be available for pickup at:

[Studio Name]
[Studio Address]
[City, State ZIP]

We will notify you by email when your order is ready for pickup.

Customer information required:

First Name
Last Name
Email
Phone

Shipping cost = $0.

Order summary should show:

Subtotal
Studio Pickup  FREE
Tax
Total

The database order must save:

fulfillment_method = "shipping"

OR

fulfillment_method = "studio_pickup"

If shipping is selected, save the shipping address.

If studio pickup is selected, shipping address should be NULL/not required.

PAYMENT

Create the checkout architecture for Stripe.

Flow:

Cart
↓
Customer Information
↓
Shipping OR Studio Pickup
↓
Payment
↓
Order Confirmation

Do not store raw credit card information in our database.

ORDER CONFIRMATION

After successful payment display:

THANK YOU FOR YOUR ORDER

Order #12345

Then display the appropriate fulfillment information.

For SHIPPING:

"Your order will be shipped to:"

[customer address]

For STUDIO PICKUP:

"You selected Studio Pickup."

"We'll email you when your prints are ready."

[Studio Name]
[Studio Address]

Also send an order confirmation email.

ADMIN DASHBOARD

Create a basic admin area.

Admin should be able to manage:

EVENTS / GALLERIES

Create event
Edit event
Upload photos
Delete photos
Publish/unpublish gallery
Set gallery cover image
Set event title
Set event date

PRODUCTS

Create product
Edit product
Product category
Available sizes
Price per size
Active/inactive

ORDERS

Show:

Order #
Date
Customer
Email
Total
Payment status
Fulfillment method
Order status

Make fulfillment method visually obvious:

SHIPPING

or

STUDIO PICKUP

Allow order statuses:

New
Processing
Sent to Lab
Ready for Pickup
Shipped
Completed
Cancelled

For pickup orders, admin should have:

"MARK READY FOR PICKUP"

When clicked, send the customer a "Your order is ready for pickup" email.

DATABASE STRUCTURE

Create a clean relational database structure approximately like:

events
photos
products
product_variants
customers
orders
order_items
shipping_addresses
payments

orders should contain at minimum:

id
order_number
customer_id
subtotal
shipping_cost
tax
total
fulfillment_method
payment_status
order_status
created_at

order_items should reference BOTH:

photo_id
product_variant_id

This is extremely important because every purchased print must remain connected to the exact high-resolution photograph that needs to be printed.

PHOTO FILES

Use two versions of uploaded photographs:

Web optimized preview

Original high-resolution file

Customers browse the optimized version.

The original high-resolution file must NOT be publicly accessible through an obvious URL.

The original should be used for print fulfillment.

Support large galleries containing hundreds or thousands of photographs.

Use:

Lazy loading
Pagination or infinite scroll
Optimized thumbnails
Responsive images

Do not load every full-resolution photograph when the gallery opens.

DESIGN

Create a premium, minimal photography-gallery aesthetic.

Prioritize the photographs.

Use:

Large photography
Lots of whitespace
Simple typography
Minimal navigation
Large responsive gallery grid
Elegant lightbox
Subtle animations
Excellent mobile experience

The interface should feel like a professional fashion/event photography gallery rather than a normal ecommerce store.

Desktop and mobile must both be fully responsive.

IMPORTANT ARCHITECTURE REQUIREMENT

Build the system so the PRINT LAB is separate from the customer order.

Customer places an order on OUR website.

Our system records:

Customer
Photo
Product
Size
Quantity
Shipping/Pickup
Payment

Later we may integrate WHCC or another professional photo lab for automatic fulfillment.

Therefore create a fulfillment abstraction/service layer.

For now it can use a mock/manual fulfillment provider.

Later we should be able to implement:

WHCC fulfillment
Another print lab
Manual studio printing

WITHOUT rebuilding checkout or the order database.

Do not attempt to scrape WHCC or depend on their website frontend.

MVP PRIORITY

Build in this order:

Event gallery

Photo lightbox

Buy Print interface

Product/size selection

Shopping cart

Checkout

Shipping vs Studio Pickup

Stripe-ready payment architecture

Order confirmation

Admin order management

Focus first on making the complete customer purchasing flow functional.

Use clean reusable components and production-quality architecture. Do not overengineer features outside this scope.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gallery-print-pro.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7cba22ff-ea00-4e47-bd95-e769a62276b9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm  [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
