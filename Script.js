// --- UTILITY: Number to Words ---
function numToWords(num) {
  const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function words(n) {
    if (n === 0) return '';
    if (n < 20) return a[n] + ' ';
    if (n < 100) return b[Math.floor(n/10)] + ' ' + a[n%10] + ' ';
    return a[Math.floor(n/100)] + ' Hundred ' + words(n % 100);
  }
  num = Math.floor(num);
  if (num === 0) return 'Zero';
  let result = '';
  if (Math.floor(num / 10000000) > 0) { result += words(Math.floor(num/10000000)) + 'Crore '; num %= 10000000; }
  if (Math.floor(num / 100000) > 0) { result += words(Math.floor(num/100000)) + 'Lakh '; num %= 100000; }
  if (Math.floor(num / 1000) > 0) { result += words(Math.floor(num/1000)) + 'Thousand '; num %= 1000; }
  result += words(num);
  return result.trim();
}

// --- CORE DATA MODEL ---
function getBlankState() {
  return {
    id: null,
    meta: { invoiceNo: "", issueDate: "", paymentMode: "RTGS" },
    seller: { name: "", address: "", gstin: "" },
    buyer: { name: "", address: "", gstin: "" },
    items: [],
    adjustments: { freight: 0 },
    taxConfig: { mode: "cgst_sgst", rate: 18 },
    logoBase64: "",
    signatureBase64: ""
  };
}

class InvoiceManager {
  constructor(initialState) { this.state = initialState; }
  addItem(item) { this.state.items.push(item); this.calculateTotals(); }
  removeItem(itemId) { this.state.items = this.state.items.filter(i => i.id !== itemId); this.calculateTotals(); }
  
  calculateTotals() {
    let subtotal = 0;
    this.state.items.forEach(item => subtotal += (item.qty * item.rate));
    let taxableAmount = subtotal + this.state.adjustments.freight;
    
    let cgst = 0, sgst = 0, igst = 0;
    if (this.state.taxConfig.mode === 'cgst_sgst') {
      cgst = taxableAmount * (this.state.taxConfig.rate / 2) / 100;
      sgst = taxableAmount * (this.state.taxConfig.rate / 2) / 100;
    } else if (this.state.taxConfig.mode === 'igst') {
      igst = taxableAmount * (this.state.taxConfig.rate) / 100;
    }
    
    const grandTotal = taxableAmount + cgst + sgst + igst;
    const finalRounded = Math.round(grandTotal);
    
    return { subtotal, taxableAmount, taxes: { cgst, sgst, igst }, roundOff: finalRounded - grandTotal, finalRounded };
  }
}

const invoiceApp = new InvoiceManager(getBlankState());

// --- DOM BINDING & EVENT LISTENERS ---
function attachInputListeners() {
  const textMappings = {
    'invoiceNumber': { obj: 'meta', key: 'invoiceNo' },
    'invoiceDate': { obj: 'meta', key: 'issueDate' },
    'paymentMode': { obj: 'meta', key: 'paymentMode' },
    'sellerName': { obj: 'seller', key: 'name' },
    'sellerAddress': { obj: 'seller', key: 'address' },
    'sellerGST': { obj: 'seller', key: 'gstin' },
    'buyerName': { obj: 'buyer', key: 'name' },
    'buyerAddress': { obj: 'buyer', key: 'address' },
    'buyerGST': { obj: 'buyer', key: 'gstin' }
  };

  Object.entries(textMappings).forEach(([elemId, path]) => {
    document.getElementById(elemId).addEventListener('input', (e) => {
      invoiceApp.state[path.obj][path.key] = e.target.value;
      renderPreview();
    });
  });

  document.getElementById('taxRate').addEventListener('input', (e) => {
    invoiceApp.state.taxConfig.rate = parseFloat(e.target.value) || 0;
    updateTotalsUI();
  });

  document.getElementById('freightCharges').addEventListener('input', (e) => {
    invoiceApp.state.adjustments.freight = parseFloat(e.target.value) || 0;
    updateTotalsUI();
  });

  document.getElementsByName('gstMode').forEach(radio => {
    radio.addEventListener('change', (e) => {
      invoiceApp.state.taxConfig.mode = e.target.value;
      updateTotalsUI();
    });
  });
}

function handleImageUpload(inputId, stateKey, previewId) {
  document.getElementById(inputId).addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const b64 = event.target.result;
      invoiceApp.state[stateKey] = b64;
      document.getElementById(previewId).src = b64;
      document.getElementById(previewId).style.display = 'block';
    };
    reader.readAsDataURL(file);
  });
}

// --- RENDERING ---
function renderPreview() {
  document.getElementById('prev-invoiceNumber').textContent = invoiceApp.state.meta.invoiceNo;
  document.getElementById('prev-invoiceDate').textContent = invoiceApp.state.meta.issueDate;
  document.getElementById('prev-paymentMode').textContent = invoiceApp.state.meta.paymentMode;
  document.getElementById('prev-sellerName').textContent = invoiceApp.state.seller.name || 'Seller Name';
  document.getElementById('prev-authName').textContent = invoiceApp.state.seller.name;
  document.getElementById('prev-sellerAddress').textContent = invoiceApp.state.seller.address;
  document.getElementById('prev-sellerGST').textContent = invoiceApp.state.seller.gstin;
  document.getElementById('prev-buyerName').textContent = invoiceApp.state.buyer.name;
  document.getElementById('prev-buyerAddress').textContent = invoiceApp.state.buyer.address;
  document.getElementById('prev-buyerGST').textContent = invoiceApp.state.buyer.gstin;
}

function renderItems() {
  const edContainer = document.getElementById('editor-items-container');
  const prevContainer = document.getElementById('preview-items-tbody');
  edContainer.innerHTML = ''; prevContainer.innerHTML = '';

  invoiceApp.state.items.forEach((item, i) => {
    // Editor Row
    const er = document.createElement('div');
    er.className = 'editor-item-row';
    er.innerHTML = `
      <input type="text" data-id="${item.id}" data-field="desc" value="${item.desc}" placeholder="Item Desc">
      <input type="text" data-id="${item.id}" data-field="hsn" value="${item.hsn}" placeholder="HSN">
      <input type="number" data-id="${item.id}" data-field="qty" value="${item.qty}" placeholder="Qty">
      <input type="number" data-id="${item.id}" data-field="rate" value="${item.rate}" placeholder="Rate">
      <button class="btn-danger btn-delete-item" data-id="${item.id}">X</button>
    `;
    edContainer.appendChild(er);

    // Preview Row
    const amt = (item.qty * item.rate).toFixed(2);
    const pr = document.createElement('tr');
    pr.innerHTML = `<td>${i+1}</td><td><strong>${item.desc}</strong></td><td>${item.hsn}</td><td>${item.qty}</td><td>${item.rate.toFixed(2)}</td><td style="text-align:right">${amt}</td>`;
    prevContainer.appendChild(pr);
  });
  updateTotalsUI();
}

function updateTotalsUI() {
  const totals = invoiceApp.calculateTotals();
  const tm = invoiceApp.state.taxConfig.mode;
  const tr = invoiceApp.state.taxConfig.rate;

  document.getElementById('prev-taxable').textContent = `₹ ${totals.taxableAmount.toFixed(2)}`;
  document.getElementById('prev-total').textContent = `₹ ${totals.finalRounded.toFixed(2)}`;
  document.getElementById('prev-roundoff').textContent = `₹ ${totals.roundOff.toFixed(2)}`;
  document.getElementById('prev-words').textContent = `INR ${numToWords(totals.finalRounded)} Only`;

  const bCon = document.getElementById('tax-breakup-container');
  if (tm === 'none' || tr === 0 || invoiceApp.state.items.length === 0) {
    bCon.innerHTML = '';
    document.getElementById('line-cgst').style.display = 'none';
    document.getElementById('line-sgst').style.display = 'none';
    document.getElementById('line-igst').style.display = 'none';
  } else {
    let tHTML = `<table class="inv-tax-table">`;
    if (tm === 'cgst_sgst') {
      document.getElementById('line-cgst').style.display = 'flex';
      document.getElementById('line-sgst').style.display = 'flex';
      document.getElementById('line-igst').style.display = 'none';
      document.getElementById('prev-cgst').textContent = `₹ ${totals.taxes.cgst.toFixed(2)}`;
      document.getElementById('prev-sgst').textContent = `₹ ${totals.taxes.sgst.toFixed(2)}`;
      
      const hr = tr / 2;
      tHTML += `<thead><tr><th>HSN</th><th>Taxable<br>Value</th><th>CGST<br>%</th><th>CGST<br>Amt</th><th>SGST<br>%</th><th>SGST<br>Amt</th><th>Total<br>Tax</th></tr></thead><tbody>`;
      invoiceApp.state.items.forEach(i => {
        const tx = i.qty * i.rate; const c = tx*(hr/100); const s = tx*(hr/100);
        tHTML += `<tr><td>${i.hsn}</td><td>${tx.toFixed(2)}</td><td>${hr}%</td><td>${c.toFixed(2)}</td><td>${hr}%</td><td>${s.toFixed(2)}</td><td>${(c+s).toFixed(2)}</td></tr>`;
      });
      tHTML += `<tr class="bold"><td>Total</td><td>${totals.taxableAmount.toFixed(2)}</td><td></td><td>${totals.taxes.cgst.toFixed(2)}</td><td></td><td>${totals.taxes.sgst.toFixed(2)}</td><td>${(totals.taxes.cgst+totals.taxes.sgst).toFixed(2)}</td></tr>`;
    } else {
      document.getElementById('line-cgst').style.display = 'none';
      document.getElementById('line-sgst').style.display = 'none';
      document.getElementById('line-igst').style.display = 'flex';
      document.getElementById('prev-igst').textContent = `₹ ${totals.taxes.igst.toFixed(2)}`;
      
      tHTML += `<thead><tr><th>HSN</th><th>Taxable<br>Value</th><th>IGST<br>%</th><th>IGST<br>Amt</th><th>Total<br>Tax</th></tr></thead><tbody>`;
      invoiceApp.state.items.forEach(i => {
        const tx = i.qty * i.rate; const ig = tx*(tr/100);
        tHTML += `<tr><td>${i.hsn}</td><td>${tx.toFixed(2)}</td><td>${tr}%</td><td>${ig.toFixed(2)}</td><td>${ig.toFixed(2)}</td></tr>`;
      });
      tHTML += `<tr class="bold"><td>Total</td><td>${totals.taxableAmount.toFixed(2)}</td><td></td><td>${totals.taxes.igst.toFixed(2)}</td><td>${totals.taxes.igst.toFixed(2)}</td></tr>`;
    }
    bCon.innerHTML = tHTML + `</tbody></table>`;
  }
}

// --- ITEM DELEGATION ---
document.getElementById('btn-add-item').addEventListener('click', () => {
  invoiceApp.addItem({ id: Date.now(), desc: '', hsn: '', qty: 1, rate: 0 });
  renderItems();
});

document.getElementById('editor-items-container').addEventListener('input', (e) => {
  const id = e.target.getAttribute('data-id'); if (!id) return;
  const field = e.target.getAttribute('data-field');
  const item = invoiceApp.state.items.find(i => i.id == id);
  if (item) {
    item[field] = (field === 'qty' || field === 'rate') ? parseFloat(e.target.value) || 0 : e.target.value;
    invoiceApp.calculateTotals();
    renderItems();
  }
});

document.getElementById('editor-items-container').addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-delete-item')) {
    invoiceApp.removeItem(parseFloat(e.target.getAttribute('data-id')));
    renderItems();
  }
});

// --- STORAGE PIPELINE ---
function getHistory() { return JSON.parse(localStorage.getItem('gst_invoices_v2')) || []; }
function saveHistory(arr) { localStorage.setItem('gst_invoices_v2', JSON.stringify(arr)); renderHistoryTable(); }

function saveCurrentInvoice() {
  if (!invoiceApp.state.id) invoiceApp.state.id = Date.now();
  const hist = getHistory();
  const idx = hist.findIndex(i => i.id === invoiceApp.state.id);
  if (idx >= 0) hist[idx] = JSON.parse(JSON.stringify(invoiceApp.state));
  else hist.push(JSON.parse(JSON.stringify(invoiceApp.state)));
  saveHistory(hist);
  alert('Invoice saved successfully.');
}

function loadInvoice(id) {
  const inv = getHistory().find(i => i.id === id);
  if (inv) {
    invoiceApp.state = JSON.parse(JSON.stringify(inv));
    document.getElementById('invoiceNumber').value = inv.meta.invoiceNo;
    document.getElementById('invoiceDate').value = inv.meta.issueDate;
    document.getElementById('sellerName').value = inv.seller.name;
    document.getElementById('buyerName').value = inv.buyer.name;
    document.getElementsByName('gstMode').forEach(r => r.checked = (r.value === inv.taxConfig.mode));
    
    if (inv.logoBase64) { document.getElementById('prev-logo').src = inv.logoBase64; document.getElementById('prev-logo').style.display = 'block'; }
    if (inv.signatureBase64) { document.getElementById('prev-signature').src = inv.signatureBase64; document.getElementById('prev-signature').style.display = 'block'; }
    
    renderPreview(); renderItems();
  }
}

function deleteInvoice(id) {
  if (confirm("Delete this invoice?")) saveHistory(getHistory().filter(i => i.id !== id));
}

function renderHistoryTable() {
  const tb = document.getElementById('history-tbody'); tb.innerHTML = '';
  const hist = getHistory();
  if (hist.length === 0) { tb.innerHTML = '<tr><td colspan="3">No records</td></tr>'; return; }
  for (let i = hist.length - 1; i >= 0; i--) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${hist[i].meta.invoiceNo || 'Draft'}</td><td>${hist[i].meta.issueDate || '-'}</td>
    <td><button onclick="loadInvoice(${hist[i].id})" class="btn-outline">Load</button> <button onclick="deleteInvoice(${hist[i].id})" class="btn-danger">X</button></td>`;
    tb.appendChild(tr);
  }
}

// --- UTILITIES (PDF, PRINT, CLEAR) ---
document.getElementById('btn-download-pdf').addEventListener('click', () => {
  const el = document.getElementById('invoice-document');
  const opt = { margin: 0, filename: `${invoiceApp.state.meta.invoiceNo || 'invoice'}.pdf`, image: { type: 'jpeg', quality: 1.0 }, html2canvas: { scale: 2, useCORS: true, windowWidth: 794 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } };
  html2pdf().set(opt).from(el).save();
});

document.getElementById('btn-print').addEventListener('click', () => window.print());

document.getElementById('btn-save-invoice').addEventListener('click', saveCurrentInvoice);

document.getElementById('btn-clear-form').addEventListener('click', () => {
  if (confirm("Clear form?")) {
    invoiceApp.state = getBlankState();
    document.querySelectorAll('input[type="text"], input[type="date"]').forEach(i => i.value = '');
    document.getElementById('prev-logo').style.display = 'none';
    document.getElementById('prev-signature').style.display = 'none';
    renderPreview(); renderItems();
  }
});

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
  attachInputListeners();
  handleImageUpload('uploadLogo', 'logoBase64', 'prev-logo');
  handleImageUpload('uploadSignature', 'signatureBase64', 'prev-signature');
  renderPreview(); renderItems(); renderHistoryTable();
});
                 
