const express      = require('express');
const cors         = require('cors');
const XLSX         = require('xlsx');
const path         = require('path');
const fs           = require('fs');
const jwt          = require('jsonwebtoken');
const bcrypt       = require('bcryptjs');
const cookieParser = require('cookie-parser');

const app  = express();
const PORT = process.env.PORT || 3000;

// Дозволуваме CORS за сите origin-и и праќање cookies
app.use(cors({ origin: true, credentials: true }));

app.use(express.json());
app.use(cookieParser());

// Сервирање на фронтенд статики
app.use(express.static(path.join(__dirname, 'public')));

const EXCEL_PATH = path.join(__dirname, 'uploads', 'products.xlsx');
const SECRET_KEY = 'tvoja_super_tajno_kljuce';

// Статички админ
const adminUser = {
    username: 'admin',
    passwordHash: bcrypt.hashSync('admin123', 8)
};

function loadProducts() {
    if (!fs.existsSync(EXCEL_PATH)) return [];
    const wb    = XLSX.readFile(EXCEL_PATH);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows  = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }).slice(1);
    return rows.map(r => ({
        id:      r[0],
        barcode: String(r[1]).trim(),
        name:    String(r[2]).trim(),
        unit:    r[4] || '',
        price:   Number(r[8]) || 0,
    }));
}

function saveProducts(products) {
    const wb     = XLSX.readFile(EXCEL_PATH);
    const sheet  = wb.Sheets[wb.SheetNames[0]];
    const header = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })[0];
    const data   = [header, ...products.map(p => [
        p.id, p.barcode, p.name, null, p.unit, null, null, null, p.price, null
    ])];
    const newSheet = XLSX.utils.aoa_to_sheet(data);
    const newWb    = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWb, newSheet, wb.SheetNames[0]);
    XLSX.writeFile(newWb, EXCEL_PATH);
}

let products = loadProducts();

function verifyAdmin(req, res, next) {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Нема овластување' });
    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        if (decoded.username === adminUser.username) {
            req.user = decoded;
            next();
        } else {
            res.status(403).json({ message: 'Нема овластување' });
        }
    } catch {
        res.status(401).json({ message: 'Невалиден токен' });
    }
}

// --- API Rute ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (
        username !== adminUser.username ||
        !bcrypt.compareSync(password, adminUser.passwordHash)
    ) {
        return res.status(401).json({ message: 'Грешно корисничко име или лозинка' });
    }
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '2h' });
    res.cookie('token', token, { httpOnly: true });
    res.json({ message: 'Најавен' });
});

app.get('/api/check-auth', verifyAdmin, (req, res) => {
    res.json({ username: req.user.username });
});

app.get('/api/products', (req, res) => {
    res.json(products);
});

app.post('/api/products', verifyAdmin, (req, res) => {
    const { barcode, name, price, unit } = req.body;
    if (!barcode || !name || isNaN(price)) {
        return res.status(400).json({ message: 'Невалидни полиња' });
    }
    if (products.some(p => p.barcode === barcode)) {
        return res.status(400).json({ message: 'Баркод постои' });
    }
    const newProduct = {
        id:      products.length ? Math.max(...products.map(p => p.id)) + 1 : 1,
        barcode: barcode.trim(),
        name:    name.trim(),
        unit:    unit || '',
        price:   Number(price),
    };
    products.push(newProduct);
    saveProducts(products);
    res.status(201).json(newProduct);
});

app.put('/api/products/:barcode', verifyAdmin, (req, res) => {
    const idx = products.findIndex(p => p.barcode === req.params.barcode);
    if (idx === -1) return res.status(404).json({ message: 'Не најден' });
    products[idx] = { ...products[idx], ...req.body };
    saveProducts(products);
    res.json(products[idx]);
});

app.delete('/api/products/:barcode', verifyAdmin, (req, res) => {
    const idx = products.findIndex(p => p.barcode === req.params.barcode);
    if (idx === -1) return res.status(404).json({ message: 'Не најден' });
    products.splice(idx, 1);
    saveProducts(products);
    res.json({ message: 'Избришан' });
});

// ➤ Фолбек, без path-to-regexp:
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Серверот работи на порт ${PORT}`);
});
