AMBLE FRONTEND — COMMERCE PHASE 4A
===================================

This is a plain HTML/CSS/JavaScript frontend. It requires no npm install or build step.

New commerce features
---------------------
- Size/colour variant selection and variant stock
- Shipping-address form and saved address selection
- Shipping method, fee and free-shipping display
- Account page with password change and address book
- Forgot/reset password pages
- Order tracking timeline, search, status filter and pagination
- Eligible order cancellation
- Existing visual polish, reliability states, dark mode and responsive layout preserved

Run locally
-----------
1. Start Django at http://127.0.0.1:8000.
2. From this frontend folder run:

   py -m http.server 5500

3. Open http://127.0.0.1:5500/.

Use 127.0.0.1 for both servers. Do not open the HTML files with file://.

Important
---------
Checkout still creates a demo unpaid order. It does not collect or process card details. Local confirmation and password-reset emails print in the Django terminal.
