import sqlite3
import os
from datetime import datetime, timedelta

def create_sample_db(db_path="sample.db"):
    # Delete the database if it already exists to start fresh
    if os.path.exists(db_path):
        os.remove(db_path)
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # Create tables
    cursor.execute("""
    CREATE TABLE customers (
        customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        country TEXT NOT NULL,
        join_date TEXT NOT NULL
    );
    """)
    
    cursor.execute("""
    CREATE TABLE products (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER NOT NULL
    );
    """)
    
    cursor.execute("""
    CREATE TABLE orders (
        order_id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        order_date TEXT NOT NULL,
        total_amount REAL NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    );
    """)
    
    cursor.execute("""
    CREATE TABLE order_items (
        item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        price_per_unit REAL NOT NULL,
        FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(product_id)
    );
    """)
    
    # Insert Customers
    customers_data = [
        ("Alice Smith", "alice@example.com", "USA", "2025-01-15"),
        ("Bob Jones", "bob@example.com", "UK", "2025-02-20"),
        ("Charlie Brown", "charlie@example.com", "Canada", "2025-03-10"),
        ("Diana Prince", "diana@example.com", "Germany", "2025-04-05"),
        ("Ethan Hunt", "ethan@example.com", "USA", "2025-05-12"),
        ("Fiona Gallagher", "fiona@example.com", "Australia", "2025-06-01")
    ]
    cursor.executemany(
        "INSERT INTO customers (name, email, country, join_date) VALUES (?, ?, ?, ?);",
        customers_data
    )
    
    # Insert Products
    products_data = [
        ("Laptop", "Electronics", 1200.00, 15),
        ("Smartphone", "Electronics", 800.00, 25),
        ("Headphones", "Audio", 150.00, 40),
        ("Bluetooth Speaker", "Audio", 99.99, 30),
        ("Wireless Mouse", "Accessories", 49.99, 100),
        ("Mechanical Keyboard", "Accessories", 119.99, 50),
        ("Coffee Maker", "Appliances", 89.99, 8),
        ("Blender", "Appliances", 59.99, 12),
        ("Desk Lamp", "Furniture", 39.99, 0), # Out of stock
        ("Office Chair", "Furniture", 199.99, 5)
    ]
    cursor.executemany(
        "INSERT INTO products (name, category, price, stock) VALUES (?, ?, ?, ?);",
        products_data
    )
    
    # Insert Orders (We will generate them with relative dates)
    orders_data = [
        (1, "2026-05-10", 1400.00), # Alice: Laptop + Mouse
        (2, "2026-05-15", 150.00),  # Bob: Headphones
        (3, "2026-05-20", 919.99),  # Charlie: Smartphone + Keyboard
        (4, "2026-06-02", 89.99),   # Diana: Coffee Maker
        (5, "2026-06-10", 299.98),  # Ethan: Speaker + Chair
        (6, "2026-06-12", 249.99),  # Fiona: Mouse + Chair
        (1, "2026-06-15", 1200.00), # Alice: Laptop
        (2, "2026-06-20", 300.00)   # Bob: 2x Headphones
    ]
    cursor.executemany(
        "INSERT INTO orders (customer_id, order_date, total_amount) VALUES (?, ?, ?);",
        orders_data
    )
    
    # Insert Order Items
    # format: (order_id, product_id, quantity, price_per_unit)
    order_items_data = [
        (1, 1, 1, 1200.00), # Order 1: Laptop
        (1, 5, 4, 49.99),   # Order 1: 4x Mouse (adjusting total slightly)
        (2, 3, 1, 150.00),  # Order 2: Headphones
        (3, 2, 1, 800.00),  # Order 3: Smartphone
        (3, 6, 1, 119.99),  # Order 3: Keyboard
        (4, 7, 1, 89.99),   # Order 4: Coffee Maker
        (5, 4, 1, 99.99),   # Order 5: Speaker
        (5, 10, 1, 199.99), # Order 5: Chair
        (6, 5, 1, 49.99),   # Order 6: Mouse
        (6, 10, 1, 199.99), # Order 6: Chair
        (7, 1, 1, 1200.00), # Order 7: Laptop
        (8, 3, 2, 150.00)   # Order 8: 2x Headphones
    ]
    cursor.executemany(
        "INSERT INTO order_items (order_id, product_id, quantity, price_per_unit) VALUES (?, ?, ?, ?);",
        order_items_data
    )
    
    # Commit and close
    conn.commit()
    conn.close()
    print(f"Sample SQLite database '{db_path}' created successfully with realistic data!")

if __name__ == "__main__":
    create_sample_db()
