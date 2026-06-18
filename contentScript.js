// Wait for the page to finish loading
window.addEventListener('load', () => {

  // Helper: parse weight string into pounds
  function parseWeightToPounds(str) {
    if (!str) return NaN;
    const m = str.match(/([\d.]+)\s*([a-zA-Zµ]+)/);
    if (!m) return NaN;
    const v = parseFloat(m[1]);
    const unit = m[2].toLowerCase();

    // catch kilograms first
    if (unit.includes('kg') || unit.includes('kilogram')) {
      return v * 2.20462;
    }
    // then grams
    if (unit.includes('g') && !unit.includes('kg') && unit.includes('gram')) {
      return v / 453.592;
    }
    // pounds
    if (unit.includes('lb') || unit.includes('pound')) {
      return v;
    }
    // ounces
    if (unit.includes('oz') || unit.includes('ounce')) {
      return v / 16;
    }
    return NaN;
  }

  // Helper: compute dim weight (L W H)/139 from dimension string
  function parseDimWeight(str) {
    if (!str) return NaN;
    // remove quotes and letters, leave numbers, dots, and spaces
    const cleaned = str.replace(/["A-Za-z]+/g, ' ').trim();
    const m = cleaned.match(/([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    if (!m) return NaN;
    const a = parseFloat(m[1]), b = parseFloat(m[2]), c = parseFloat(m[3]);
    return (a * b * c) / 139;
  }

  // 0. Create the “Show Info” button
  const btn = document.createElement('button');
  btn.id = 'amazonInfoBtn';
  btn.innerText = 'SHOW INFO';
  Object.assign(btn.style, {
    position:    'fixed',
    top:         '110px',
    right:       '10px',
    zIndex:      1000000,
    padding:     '6px 10px',
    border:      'none',
    borderRadius:'4px',
    background:  '#FFBF00', // Amber yellow
    color:       '#000',
    fontFamily:  'sans-serif',
    fontSize:    '14px',
    fontWeight:  'bold',
    textTransform: 'uppercase',
    cursor:      'pointer',
    boxShadow:   '0 2px 4px rgba(0,0,0,0.2)'
  });
  document.body.appendChild(btn);

  // 1. On click, toggle the info box
  btn.addEventListener('click', () => {
    const old = document.getElementById('amazonInfoBox');
    if (old) {
      old.remove();
      return;
    }

    // --- existing scraping logic ---

    // Price selectors list
    const priceSelectors = [
      '#newAccordionRow_0 > div > div.a-accordion-row-a11y.a-accordion-row.a-declarative.a-accordion-sr.accordion-header.mobb-header-css',
      '#corePriceDisplay_desktop_feature_div > div.a-section.a-spacing-none.aok-align-center.aok-relative',
      '#apex_desktop_newAccordionRow > div',
      '#corePriceDisplay_desktop_feature_div > div.a-section.a-spacing-none.aok-align-center.aok-relative',
      '#apex_desktop > div > div',
      '#addToCart > div > div > div',
      '#corePrice_feature_div > div > div',
      '#addToCart > div > div > div > div',
      '#corePriceDisplay_desktop_feature_div > div.a-section.a-spacing-none.aok-align-center.aok-relative',
      '#apex_desktop > div > div',
      '#usedOnlyBuybox > div.a-row.a-spacing-medium > div > div',
      '#usedBuySection > div.a-row.a-grid-vertical-align.a-grid-center > div'
    ];

    let price = 'N/A';
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText) {
        const m = el.innerText.trim().match(/[\$\₹\£\€]\s?[\d,]+(\.\d{1,2})?/);
        if (m) {
          price = m[0];
          break;
        }
      }
    }

    // Weight & Dimensions scraping
    const detailDiv = document.querySelector('#productDetails_feature_div');
    let weight     = 'N/A';
    let dimensions = 'N/A';

    if (detailDiv) {
      detailDiv.querySelectorAll('tr').forEach(row => {
        const th = row.querySelector('th');
        const td = row.querySelector('td');
        if (th && td) {
          const key   = th.innerText.trim().toLowerCase();
          const value = td.innerText.trim();
          if (key.includes('weight'))     weight     = value;
          if (key.includes('dimension'))  dimensions = value;
        }
      });
    }

    // 2. Build extra info for amazon.com
    let extraHTML = '';
    if (window.location.hostname.includes('amazon.com')) {
      // calculate dim weight & choose greater
      const dimWtRaw = parseDimWeight(dimensions);
      const wtRaw    = parseWeightToPounds(weight);
      const chosen   = Math.max(isNaN(dimWtRaw) ? 0 : dimWtRaw, isNaN(wtRaw) ? 0 : wtRaw);
      const formulaWt = chosen > 0 ? Math.ceil(chosen) : 1;

      // parse numeric price (USD)
      const priceVal = parseFloat(price.replace(/[^0-9.]/g,''));
      // base INR cost
      const base = (priceVal * 95 * 1.20 + formulaWt * 5 * 95 + formulaWt * 200) * 1.025 * 1.025 * 1.18;

      // generate markups with Indian comma formatting
      const markups = [5,10,15,20,25,30].map(p => {
        const val = base * (1 + p/100);
        return {
          percent: p,
          price:   val.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2
                    })
        };
      });

      extraHTML = `
        <div style="margin-top:8px;">
          <table style="border-collapse:collapse; font-family:sans-serif;">
            <tr>
              <td style="padding:2px 8px; text-align:right;">Dim Weight (lbs):</td>
              <td style="padding:2px 8px; text-align:left;">${isNaN(dimWtRaw) ? 'N/A' : dimWtRaw.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding:2px 8px; text-align:right;">Formula Weight (lbs):</td>
              <td style="padding:2px 8px; text-align:left;">${formulaWt}</td>
            </tr>
            ${markups.map(m => `
              <tr>
                <td style="padding:2px 8px; text-align:right;">${m.percent}% Markup Price:</td>
                <td style="padding:2px 8px; text-align:left;">₹ ${m.price}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `;
    }

    // 3. Inject the info box
    const infoBox = document.createElement('div');
    infoBox.id = 'amazonInfoBox';
    Object.assign(infoBox.style, {
      position:   'fixed',
      top:        '150px',
      right:      '10px',
      background: '#f5f5f5',
      border:     '1px solid #ccc',
      padding:    '8px 12px',
      fontFamily: 'sans-serif',
      fontSize:   '14px',
      zIndex:     1000000,
      boxShadow:  '0 2px 6px rgba(0,0,0,0.2)'
    });
    infoBox.innerHTML = `
      <strong>Price:</strong> ${price}<br>
      <strong>Weight:</strong> ${weight}<br>
      <strong>Dimensions:</strong> ${dimensions}
      ${extraHTML}
    `;
    document.body.appendChild(infoBox);

    // --- end of existing logic ---
  });

});
