const Database = require('better-sqlite3');
const path = require('path');
const xlsx = require('xlsx');

const db = new Database(path.join(__dirname, 'products.db'));

// 1. Креирање на табелата (ако не постои)
db.prepare(`
    CREATE TABLE IF NOT EXISTS products (
                                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                                            barcode TEXT UNIQUE NOT NULL,
                                            name TEXT NOT NULL,
                                            price REAL NOT NULL,
                                            unit TEXT,
                                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).run();

// 2. Функција за додавање нов производ
function addProduct(productData) {
    const { barcode, name, price, unit } = productData;

    // Проверка за задолжителни полиња
    if (!barcode || !name || price === undefined) {
        throw new Error('Баркод, име и цена се задолжителни!');
    }

    try {
        const stmt = db.prepare(`
            INSERT INTO products (barcode, name, price, unit)
            VALUES (?, ?, ?, ?)
        `);
        const result = stmt.run(barcode, name, parseFloat(price), unit || '');

        return {
            success: true,
            id: result.lastInsertRowid,
            barcode,
            name,
            price
        };
    } catch (error) {
        // Доколку баркодот веќе постои
        if (error.message.includes('UNIQUE constraint failed')) {
            throw new Error('Производ со овој баркод веќе постои!');
        }
        throw error;
    }
}

// 3. Пример за употреба (можеш да го тестираш)
try {
    const newProduct = {
        barcode: "123456789",
        name: "Тест производ",
        price: 99.99,
        unit: "парче"
    };

    const addedProduct = addProduct(newProduct);
    console.log('Додаден производ:', addedProduct);
} catch (error) {
    console.error('Грешка:', error.message);
}

module.exports = {
    addProduct,
    // Останатите функции (getAllProducts, updateProduct, итн.)
    ...require('./db.js')
};