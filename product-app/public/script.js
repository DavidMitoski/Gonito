let products = [];
let filteredProducts = [];
let sortAsc = true;

const tableBody = document.querySelector('#productsTable tbody');
const searchInput = document.getElementById('searchInput');
const sortBtn = document.getElementById('sortBtn');

const barcodeInput = document.getElementById('barcode');
const nameInput = document.getElementById('name');
const priceInput = document.getElementById('price');
const unitInput = document.getElementById('unit');
const submitBtn = document.getElementById('submitBtn');

let editMode = false;
let editBarcode = null;

function renderProducts(data) {
    tableBody.innerHTML = '';
    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5">Нема пронајдени продукти</td></tr>';
        return;
    }
    data.forEach(product => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${product.barcode}</td>
          <td>${product.name}</td>
          <td>${product.price.toFixed(2)}</td>
          <td>${product.unit || ''}</td>
          <td><button class="btn-delete" data-barcode="${product.barcode}">Избриши</button></td>
        `;
        tableBody.appendChild(tr);
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            const barcode = e.target.dataset.barcode;
            if (confirm(`Дали сте сигурни дека сакате да го избришете продуктот со баркод ${barcode}?`)) {
                await deleteProduct(barcode);
            }
        });
    });
}

async function fetchProducts() {
    try {
        const res = await fetch('/api/products');
        products = await res.json();
        filteredProducts = products.slice();
        sortAndRender();
    } catch (err) {
        console.error('Грешка при вчитување продукти:', err);
    }
}

function searchProducts() {
    const term = searchInput.value.trim().toLowerCase();
    filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.barcode.toString().includes(term)
    );
    sortAndRender();
}

function sortProducts() {
    sortAsc = !sortAsc;
    sortBtn.textContent = `Сортирај по име ${sortAsc ? '⬆️' : '⬇️'}`;
    sortAndRender();
}

function sortAndRender() {
    filteredProducts.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA < nameB) return sortAsc ? -1 : 1;
        if (nameA > nameB) return sortAsc ? 1 : -1;
        return 0;
    });
    renderProducts(filteredProducts);
}

async function deleteProduct(barcode) {
    try {
        const res = await fetch(`/api/products/${barcode}`, { method: 'DELETE' });
        if (res.ok) {
            alert('Продуктот е избришан.');
            await fetchProducts();
        } else {
            alert('Грешка при бришење.');
        }
    } catch (e) {
        alert('Грешка при поврзување со серверот.');
        console.error(e);
    }
}

document.getElementById('productForm').addEventListener('submit', async e => {
    e.preventDefault();

    const barcode = barcodeInput.value.trim();
    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value);
    const unit = unitInput.value.trim();

    if (!barcode || !name || isNaN(price)) {
        alert('Внеси валидни податоци!');
        return;
    }

    try {
        if (editMode) {
            // Ова е за уредување (не е обавезно за почеток)
            alert('Уредување не е имплементирано во овој пример.');
        } else {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ barcode, name, price, unit }),
            });
            if (res.ok) {
                alert('Продуктот е успешно додаден.');
                resetForm();
                await fetchProducts();
            } else {
                const err = await res.json();
                alert(err.message || 'Грешка при додавање.');
            }
        }
    } catch (e) {
        alert('Грешка при поврзување со серверот.');
        console.error(e);
    }
});

function resetForm() {
    barcodeInput.value = '';
    nameInput.value = '';
    priceInput.value = '';
    unitInput.value = '';
    editMode = false;
    editBarcode = null;
    barcodeInput.disabled = false;
    submitBtn.textContent = 'Додај продукт';
}

searchInput.addEventListener('input', searchProducts);
sortBtn.addEventListener('click', sortProducts);

// Првично вчитување
fetchProducts();
