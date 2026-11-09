# 📱 Extract Mobile App (React Native & Expo)

The native iOS and Android companion app for **Extract Autonomous Web & Document Intelligence Platform**.

---

## 🌟 Key Features

1. **⚡ 1-Tap Mobile Scraper (`Extract` Tab)**:
   - Extract e-commerce prices, product catalogs, directory leads, and custom websites.
   - 1-tap flagship presets: *E-Commerce Product Tracker* & *Business Lead Scraper*.

2. **📸 Camera Invoice Scanner (`Scan` Tab)**:
   - Snap photos of paper receipts or invoices using your phone's camera or photo library.
   - Automatically extracts **Invoice #**, **Date**, **Vendor Name**, **Total Amount**, and line items.

3. **✏️ Live In-App Cell Editor (`Editor` Tab)**:
   - **Edit directly on your phone:** Tap any extracted row/cell to edit prices, product titles, contact details, or CRM status.
   - **Auto-Sync Excel Generator:** Tapping **"Save & Sync Excel"** immediately calls `/api/export-custom-data` on your backend and regenerates a fresh, executive-styled `.xlsx` and `.csv` deliverable!

4. **📥 Files & Recent Activity (`Files` Tab)**:
   - Complete timeline of your past extractions.
   - 1-tap **Native Share Sheet** to send `.xlsx` directly via WhatsApp, Slack, Gmail, or save to your phone's Files.

5. **⚙️ Backend Connection (`Config` Tab)**:
   - Real-time LAN connection status indicator (`🟢 Online LAN`).
   - Defaults to `http://10.228.155.159:8080` (auto-configurable).

---

## 🚀 How to Run on Your Phone in 30 Seconds

1. **Install Expo Go on your mobile phone**:
   - **Android:** [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
   - **iPhone:** [Apple App Store](https://apps.apple.com/app/expo-go/id982107779)

2. **Launch the Mobile Dev Server**:
   Double-click `start_mobile.bat` in the project root, or run:
   ```bash
   cd mobile_app
   npx expo start
   ```

3. **Open on your phone**:
   - **Android:** Open the **Expo Go** app and tap **"Scan QR code"** to scan the terminal QR code.
   - **iPhone:** Open your phone's **Camera** app, point it at the QR code, and tap the **Expo Go** notification banner.

---

## 🔄 How Edits Work

- **Backend Edits:** When you update scraper rules or openpyxl styling on your PC, the mobile app immediately receives the updated data over the Wi-Fi API (`/api/scrape`, `/api/extract-pdf`) with **zero app reinstallation**.
- **In-App Data Edits:** When you edit rows directly on your phone, the app sends the modified rows to `/api/export-custom-data`, generating a freshly styled `.xlsx` file on your server on the fly!
- **Mobile UI Code Edits:** When you edit `App.js`, your phone's screen instantly updates via **Fast Refresh** in under a second!
