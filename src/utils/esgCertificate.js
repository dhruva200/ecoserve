// Generates a printable CSR & ESG Impact Certificate PDF
export function downloadEsgCertificate({ currentUser, batches }) {
  const totalMealsRescued = batches.reduce((s, b) => s + Number(b.servings || 0), 0);
  const totalKgCo2 = batches
    .reduce((s, b) => s + Number(b.co2_saved_kg || 0), 0)
    .toFixed(1);
  const certId = `ESG-${new Date().getFullYear()}-${Math.floor(
    10000 + Math.random() * 90000
  )}`;
  const todayDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const win = window.open('', '_blank', 'width=850,height=650');
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>EcoServe ESG Impact Certificate - ${currentUser?.name}</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f8fafc; padding: 30px; color: #0f172a; }
          .cert { border: 8px double #059669; background: #ffffff; padding: 40px; border-radius: 20px; text-align: center; max-width: 720px; margin: 0 auto; }
          .badge { display: inline-block; background: #d1fae5; color: #065f46; font-weight: bold; padding: 6px 16px; border-radius: 99px; font-size: 13px; }
          h1 { color: #065f46; font-size: 28px; margin: 16px 0 6px; }
          .org { font-size: 26px; font-weight: 800; color: #0f172a; margin: 18px 0; text-decoration: underline; }
          .stats { display: flex; justify-content: center; gap: 24px; margin: 28px 0; }
          .box { border: 2px solid #e2e8f0; border-radius: 14px; padding: 16px 24px; background: #f8fafc; }
          .num { font-size: 26px; font-weight: 800; color: #059669; }
          .lbl { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold; }
          .footer { margin-top: 30px; font-size: 12px; color: #64748b; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 16px; }
        </style>
      </head>
      <body>
        <div class="cert">
          <div class="badge">🌱 OFFICIAL CSR & ESG SUSTAINABILITY REPORT</div>
          <h1>Certificate of Zero-Waste Food Impact</h1>
          <p>This certifies that the institutional partner</p>
          <div class="org">${currentUser?.name || 'EcoServe Partner'}</div>
          <p>has actively contributed to hunger relief and carbon footprint reduction via the <b>EcoServe AI Food Redistribution Network</b>.</p>
          <div class="stats">
            <div class="box">
              <div class="num">${totalMealsRescued} Meals</div>
              <div class="lbl">Surplus Meals Tracked & Rescued</div>
            </div>
            <div class="box">
              <div class="num">${totalKgCo2} kg CO₂e</div>
              <div class="lbl">Greenhouse Emissions Prevented</div>
            </div>
          </div>
          <div class="footer">
            <span><b>Certificate ID:</b> ${certId}</span>
            <span><b>Issued Date:</b> ${todayDate}</span>
            <span><b>Verified by:</b> EcoServe AI Network</span>
          </div>
        </div>
        <script>window.onload = () => { window.print(); };</script>
      </body>
    </html>
  `);
  win.document.close();
}
