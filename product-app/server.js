const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// ➤ Ова го менуваме за да дозволува сите origin-и:
app.use(cors({
    origin: true,      // дозволува секаков origin
    credentials: true  // дозволува праќање и примање cookies
}));

app.use(express.json());
app.use(cookieParser());

// Сервирање на фронтенд статики
app.use(express.static(path.join(__dirname, 'public')));

// Потоа, API рутите…

const EXCEL_PATH = path.join(__dirname, 'uploads', 'products.xlsx');
const SECRET_KEY = 'tvoja_super_tajno_kljuce';

const adminUser = {
    username: 'admin',
    passwordHash: bcrypt.hashSync('admin123', 8),
};

const loadProducts = () => {
    if (!fs.existsSync(EXCEL_PATH)) return [];
    const wb = XLSX.readFile(EXCEL_PATH);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    return data.slice(1).map(row => ({
        id: row[0],
        barcode: String(row[1]).trim(),
        name: String(row[2]).trim(),
        unit: row[4] || '',
        price: Number(row[8]) || 0,
    }));
};

const saveProducts = products => {
    const wb = XLSX.readFile(EXCEL_PATH);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const header = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })[0];
    const aoa = [header, ...products.map(p => [
        p.id, p.barcode, p.name, null, p.unit, null, null, null, p.price, null
    ])];
    const newSheet = XLSX.utils.aoa_to_sheet(aoa);
    const newWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWb, newSheet, wb.SheetNames[0]);
    XLSX.writeFile(newWb, EXCEL_PATH);
};

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

// --- API маршрути ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username !== adminUser.username ||
        !bcrypt.compareSync(password, adminUser.passwordHash)) {
        return res.status(401).json({ message: 'Грешно корисничко име или лозинка' });
    }
    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '2h' });
    res.cookie('token', token, { httpOnly: true });
    res.json({ message: 'Најавен' });
});

app.get('/api/products', (req, res) => res.json(products));

app.post('/api/products', verifyAdmin, (req, res) => {
    const { barcode, name, price, unit } = req.body;
    if (!barcode || !name || isNaN(price)) {
        return res.status(400).json({ message: 'Невалидни полиња' });
    }
    if (products.some(p => p.barcode === barcode)) {
        return res.status(400).json({ message: 'Баркод постои' });
    }
    const newProduct = {
        id: products.length ? Math.max(...products.map(p=>p.id)) + 1 : 1,
        barcode: barcode.trim(),
        name: name.trim(),
        unit: unit || '',
        price: Number(price),
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

// Фолбек за SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер работи на порт ${PORT}`);
});
