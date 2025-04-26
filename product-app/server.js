const express = require('express');
const cors = require('cors');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = 3000;

app.use(cors({
    origin: 'http://localhost:5173', // prilagoden na Vite dev server
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

const EXCEL_PATH = path.join(__dirname, 'uploads', 'products.xlsx');
const SECRET_KEY = 'tvoja_super_tajno_kljuce';

const adminUser = {
    username: 'admin',
    passwordHash: bcrypt.hashSync('admin123', 8),
};

const loadProducts = () => {
    if (!fs.existsSync(EXCEL_PATH)) return [];

    const workbook = XLSX.readFile(EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    const products = data.slice(1).map(row => ({
        id: row[0],
        barcode: String(row[1]).trim(),
        name: String(row[2]).trim(),
        unit: row[4] || '',
        price: Number(row[8]) || 0,
    }));
    return products;
};

const saveProducts = (products) => {
    const workbook = XLSX.readFile(EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const header = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })[0];

    const data = [header];
    products.forEach(p => {
        data.push([
            p.id,
            p.barcode,
            p.name,
            null,
            p.unit,
            null,
            null,
            null,
            p.price,
            null
        ]);
    });

    const newSheet = XLSX.utils.aoa_to_sheet(data);
    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newSheet, sheetName);

    XLSX.writeFile(newWorkbook, EXCEL_PATH);
};

let products = loadProducts();

function verifyAdmin(req, res, next) {
    const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Нема овластување' });

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        if (decoded.username === adminUser.username) {
            req.user = decoded;
            return next();
        } else {
            return res.status(403).json({ message: 'Нема овластување' });
        }
    } catch (e) {
        return res.status(401).json({ message: 'Невалиден токен' });
    }
}

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username !== adminUser.username || !bcrypt.compareSync(password, adminUser.passwordHash)) {
        return res.status(401).json({ message: 'Грешно корисничко име или лозинка' });
    }

    const token = jwt.sign({ username: adminUser.username }, SECRET_KEY, { expiresIn: '2h' });
    res.cookie('token', token, { httpOnly: true });
    res.json({ message: 'Најавен', token });
});

app.get('/api/check-auth', verifyAdmin, (req, res) => {
    res.json({ username: req.user.username });
});

app.get('/api/products', (req, res) => {
    res.json(products);
});

app.post('/api/products', verifyAdmin, (req, res) => {
    const { barcode, name, price, unit } = req.body;
    if (!barcode || !name || price === undefined || isNaN(price)) {
        return res.status(400).json({ message: 'Недостасуваат полиња или се невалидни' });
    }

    const exists = products.find(p => p.barcode === barcode);
    if (exists) {
        return res.status(400).json({ message: 'Производ со истиот баркод веќе постои' });
    }

    const newProduct = {
        id: products.length ? Math.max(...products.map(p => p.id)) + 1 : 1,
        barcode: String(barcode).trim(),
        name: String(name).trim(),
        unit: unit || '',
        price: Number(price),
    };

    products.push(newProduct);
    saveProducts(products);
    res.status(201).json({ message: 'Производот е додаден', product: newProduct });
});

app.put('/api/products/:barcode', verifyAdmin, (req, res) => {
    const { barcode } = req.params;
    const updated = req.body;

    const index = products.findIndex(p => p.barcode === barcode);
    if (index === -1) return res.status(404).json({ message: 'Производот не е најден' });

    products[index] = { ...products[index], ...updated };
    saveProducts(products);
    res.json({ message: 'Производот е ажуриран', product: products[index] });
});

app.delete('/api/products/:barcode', verifyAdmin, (req, res) => {
    const { barcode } = req.params;
    const index = products.findIndex(p => p.barcode === barcode);
    if (index === -1) return res.status(404).json({ message: 'Производот не е најден' });

    products.splice(index, 1);
    saveProducts(products);
    res.json({ message: 'Производот е избришан' });
});

app.listen(PORT, () => {
    console.log(`🚀 Серверот работи на http://localhost:${PORT}`);
});