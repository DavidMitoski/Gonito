const XLSX = require('xlsx');
const path = require('path');
const db = require('./db');

const EXCEL_PATH = path.join(__dirname, 'uploads', 'products.xlsx');

const workbook = XLSX.readFile(EXCEL_PATH);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

let count = 0;

const insert = db.prepare('INSERT INTO products (barcode, name, price, unit) VALUES (?, ?, ?, ?)');

for (const row of data) {
    const barcode = row['Unnamed: 1'];
    const name = row['Unnamed: 2'];
    const price = row['Unnamed: 6'];  // или 'Unnamed: 7' ако тоа е точната цена
    const unit = row['Unnamed: 4'];

    if (barcode && name && price !== undefined) {
        try {
            insert.run(String(barcode), String(name).trim(), Number(price), unit || '');
            count++;
        } catch (err) {
            console.log(`Error inserting product with barcode ${barcode}: ${err.message}`);
        }
    }
}

console.log(`✅ Успешно внесени ${count} продукти во базата.`);
