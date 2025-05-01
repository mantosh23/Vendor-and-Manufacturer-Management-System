const express = require("express");
const app = express();
const mysql = require('mysql2');
const session = require('express-session');
const path = require("path");
const ejsMate = require('ejs-mate');
const { v4: uuidv4 } = require('uuid');
const methodOverride = require('method-override');
const fs = require('fs');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const bcrypt = require('bcrypt');
const axios = require('axios');
const connection = require('./db')


app.use(session({
    secret: 'your_secret_key', // Change this to something secure
    resave: false,
    saveUninitialized: true
}));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, 'vendor-' + Date.now() + path.extname(file.originalname))
  });


const port = 3000;
app.use(express.json()); // This is needed to parse JSON in the body


app.use(express.urlencoded({extended : true}))
app.use(methodOverride('_method'));
app.set("view engine","ejs");
app.set("views", (path.join(__dirname,"/views")));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.engine('ejs',ejsMate);
app.use(express.static (path.join(__dirname,"/public")));
fs.mkdirSync('./public/uploads', { recursive: true });


const query = (sql, params = []) => {
    return new Promise((resolve, reject) => {
      connection.execute(sql, params, (err, results, fields) => {
        if (err) return reject(err);
        resolve([results, fields]);
      });
    });
  };

//======================
//LOGIN AND REGISTRATION


app.get('/', (req, res) => {
    res.redirect('/vendor_login');
});

// Route for Vendor Login Page
app.get('/vendor_login', (req, res) => {
    res.render('vendor/vendor_login.ejs');
});

// Route for Manufacturer Login Page
app.get('/manufacturer_login', (req, res) => {
    res.render('manufacturer/manufacturer_login');
});

// Route for Vendor Registration Page
app.get('/vendor_registration', (req, res) => {
    res.render('vendor/vendor_registration');
});

// Route for Manufacturer Registration Page
app.get('/manufacturer_registration', (req, res) => {
    res.render('manufacturer/manufacturer_registration');
});

// Handle Vendor Registration form submission
// Login Routes
app.post('/login_vendor', (req, res) => {
  const { username, password } = req.body;

  connection.query(
      'SELECT * FROM vendor_login WHERE username = ? AND password = ?',
      [username, password],
      (err, results) => {
          if (err) {
              console.error(err);
              return res.redirect('/vendor_login?error=Server%20error%20occurred');
          }

          if (results.length > 0) {
              // Store vendor_id in the session after login
              req.session.vendorId = results[0].id;
              return res.redirect('/vendor_dashboard?success=Login%20successful');
          } else {
              return res.redirect('/vendor_login?error=Invalid%20username%20or%20password');
          }
      }
  );
});

  
  // Vendor registration route
  app.get('/vendor_registration', (req, res) => {
    res.render('vendor/vendor_registration');
  });
  
  app.post('/register_vendor', (req, res) => {
    const { username, password, shop_name, owner_name, phone_number, address, email } = req.body;
  
    const query = 'INSERT INTO vendor_login (username, password) VALUES (?, ?)';
    connection.query(query, [username, password], (err, result) => {
      if (err) {
        console.log('Error registering vendor login:', err);
        return res.redirect('/vendor_registration?error=Username%20already%20exists%20or%20invalid%20input');
      }
  
      const vendorId = result.insertId;
      const detailsQuery = 'INSERT INTO vendor_details (vendor_id, shop_name, owner_name, phone_number, address, email) VALUES (?, ?, ?, ?, ?, ?)';
      connection.query(detailsQuery, [vendorId, shop_name, owner_name, phone_number, address, email], (err) => {
        if (err) {
          console.log('Error adding vendor details:', err);
          return res.redirect('/vendor_registration?error=Error%20adding%20vendor%20details');
        }
  
        console.log('Vendor registered successfully');
        return res.redirect('/vendor_login?success=Registration%20successful.%20You%20can%20now%20login.');
      });
    });
  });
  
  app.post('/login_manufacturer', (req, res) => {
    const { username, password } = req.body;
  
    const query = 'SELECT * FROM manufacturer_login WHERE username = ? AND password = ?';
    connection.query(query, [username, password], (err, result) => {
      if (err) {
        console.error(err);
        return res.redirect('/manufacturer_login');
      }
  
      if (result.length > 0) {
        // Store manufacturer ID in the session
        req.session.manufacturerId = result[0].id;  // Correct session assignment
  
        console.log('Manufacturer logged in successfully');
        return res.redirect('/manufacturer_dashboard');  // Redirect to the dashboard
      } else {
        console.log('Invalid credentials for manufacturer');
        return res.redirect('/manufacturer_login');
      }
    });
  });
  
  
  
  // Manufacturer registration route

  
  app.post('/register_manufacturer', (req, res) => {
    const { username, password, company_name, owner_name, phone_number, address, email } = req.body;
  
    const query = 'INSERT INTO manufacturer_login (username, password) VALUES (?, ?)';
    connection.query(query, [username, password], (err, result) => {
      if (err) {
        console.log('Error registering manufacturer login:', err);
        return res.redirect('/manufacturer_registration');
      }
  
      console.log('Manufacturer registered successfully');
      const manufacturerId = result.insertId;
      const detailsQuery = 'INSERT INTO manufacturer_details (manufacturer_id, company_name, owner_name, phone_number, address, email) VALUES (?, ?, ?, ?, ?, ?)';
      connection.query(detailsQuery, [manufacturerId, company_name, owner_name, phone_number, address, email], (err) => {
        if (err) {
          console.log('Error adding manufacturer details:', err);
          return res.redirect('/manufacturer_registration');
        }
  
        console.log('Manufacturer details added successfully');
        return res.redirect('/manufacturer_login');
      });
    });
  });

//=================
//VENDOR DASHBOARD
//=================

app.get("/vendor_dashboard",(req,res)=>{
    res.render('vendor/vendor_dashboard');
})
app.get('/profile', async (req, res) => {
    const vendorId = req.session.vendorId;
    if (!vendorId) return res.redirect('/vendor/login');
  
    try {
      const [loginRows] = await query('SELECT * FROM vendor_login WHERE id = ?', [vendorId]);
      const [detailsRows] = await query('SELECT * FROM vendor_details WHERE vendor_id = ?', [vendorId]);
      const [photoRows] = await query('SELECT * FROM vendor_profile_photos WHERE vendor_id = ?', [vendorId]);
  
      res.render('vendor/vendor_profile', {
        loginData: loginRows[0],
        vendorData: detailsRows[0],
        photoData: photoRows[0] || {},
      });
    } catch (err) {
      console.log(err);
      res.status(500).send('Error loading profile');
    }
  });
  
  app.post('/vendor/profile/upload-photo', upload.single('profile_photo'), (req, res) => {
    const vendorId = req.session.vendorId;
    if (!vendorId) return res.redirect('/vendor/login');
    
    const photoUrl = '/uploads/' + req.file.filename;
  
    // Query the database
    connection.query('SELECT * FROM vendor_profile_photos WHERE vendor_id = ?', [vendorId], (err, existingRows) => {
      if (err) {
        console.log(err);
        return res.status(500).send('Database query failed');
      }
  
      // Check if the vendor already has a photo
      if (existingRows.length > 0) {
        // Update the existing photo URL
        connection.query('UPDATE vendor_profile_photos SET photo_url = ? WHERE vendor_id = ?', [photoUrl, vendorId], (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send('Failed to update photo');
          }
          res.redirect('/profile');
        });
      } else {
        // Insert a new photo URL for the vendor
        connection.query('INSERT INTO vendor_profile_photos (vendor_id, photo_url) VALUES (?, ?)', [vendorId, photoUrl], (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send('Failed to insert photo');
          }
          res.redirect('/profile');
        });
      }
    });
  });
  
  
  
  app.post('/vendor/profile/update', async (req, res) => {
    const vendorId = req.session.vendorId;
    if (!vendorId) return res.redirect('/vendor/login');
  
    const { username, email, phone_number, shop_name, owner_name, address } = req.body;
  
    try {
      await query('UPDATE vendor_login SET username = ? WHERE id = ?', [username, vendorId]);
      await query(`
        UPDATE vendor_details
        SET email = ?, phone_number = ?, shop_name = ?, owner_name = ?, address = ?
        WHERE vendor_id = ?
      `, [email, phone_number, shop_name, owner_name, address, vendorId]);
  
      res.redirect('/profile');
    } catch (err) {
      console.log(err);
      res.status(500).send('Update failed');
    }
  });
  
  app.post('/vendor/profile/change-password', async (req, res) => {
    const vendorId = req.session.vendorId;
    if (!vendorId) return res.redirect('/vendor/login');
  
    const { current_password, new_password, confirm_password } = req.body;
  
    try {
      // Fetch the stored password (plain text) from the database
      connection.query('SELECT password FROM vendor_login WHERE id = ?', [vendorId], (err, rows) => {
        if (err) {
          console.log(err);
          return res.status(500).send('Error fetching password');
        }
  
        if (!rows.length) return res.send('User not found');
  
        // Check if the current password matches the stored password (plain text comparison)
        if (current_password !== rows[0].password) return res.send('Incorrect current password');
  
        // Check if new passwords match
        if (new_password !== confirm_password) return res.send('Passwords do not match');
  
        // Update the password with the new plain text password
        connection.query('UPDATE vendor_login SET password = ? WHERE id = ?', [new_password, vendorId], (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send('Password update failed');
          }
  
          res.redirect('/profile');
        });
      });
    } catch (err) {
      console.log(err);
      res.status(500).send('Password change failed');
    }
  });
  
// Logout Route
app.get('/logout', (req, res) => {
  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send('Error while logging out');
    }

    // Redirect to login page or any other page after logout
    res.redirect('/vendor_login');
  });
});

  
//==============
//MANAGE STOCK
//=============

// View stock with search


  // Route to view stock
  app.get('/stock', (req, res) => {
    const search = req.query.search || '';
    const filter = req.query.filter || 'all'; // Use 'all' by default
    const vendorId = req.session.vendorId; // Ensure this is set when the vendor logs in
  
    if (!vendorId) {
      return res.status(401).send('Unauthorized: Vendor not logged in');
    }
  
    // Create the SQL query dynamically based on the filter
    let sql = `
      SELECT 
        s.id AS stock_id, 
        p.product_id AS product_id_display, 
        p.product_name, 
        p.product_image, 
        s.quantity, 
        s.price, 
        s.description
      FROM stock s
      INNER JOIN products p ON s.product_id = p.id
      WHERE s.vendor_id = ? AND 
            (p.product_name LIKE ? OR CAST(p.product_id AS CHAR) LIKE ?)
    `;
    
    // Apply filter for low stock if necessary
    if (filter === 'low') {
      sql += " AND s.quantity <= 5"; // Filter for low stock items
    }
  
    sql += " ORDER BY s.id DESC"; // Always order by stock ID
    
    const searchTerm = `%${search}%`; // Prepare the search term
  
    connection.query(sql, [vendorId, searchTerm, searchTerm], (err, results) => {
      if (err) {
        console.error("Database error:", err.sqlMessage);
        return res.status(500).send('Database query error');
      }
  
      const message = req.session.message || '';
      req.session.message = ''; // Clear message after reading
  
      // Render the stock page, passing stock, search, and message
      res.render('vendor/stock', {
        stock: results,
        search,
        message,
        filter
      });
    });
  });
  
  // File upload config
const stockUpload = multer({ storage }).single('product_image');

// Add new stock
app.post('/vendor/stock/add', stockUpload, (req, res) => {
    const vendorId = req.session.vendorId;
    const { product_id, product_name, quantity, price, description } = req.body;
    const imageUrl = req.file ? `uploads/${req.file.filename}` : null;

    // Log the uploaded file and form data for debugging
    console.log(req.file);
    console.log(req.body);
  
    // Check if stock already has this product for the vendor
    connection.query(
      'SELECT product_id FROM stock WHERE product_id = (SELECT id FROM products WHERE product_id = ?) AND vendor_id = ?',
      [product_id, vendorId],
      (err, rows) => {
        if (err) {
          console.error(err);
          req.session.message = "Error checking existing stock.";
          return res.redirect('/stock');
        }
  
        if (rows.length > 0) {
          req.session.message = "Product ID already exists in your stock!";
          return res.redirect('/stock');
        }
  
        // Check if product exists in products table
        connection.query('SELECT id FROM products WHERE product_id = ?', [product_id], (err, rows) => {
          if (err) {
            console.error(err);
            req.session.message = "Error checking product.";
            return res.redirect('/stock');
          }
  
          let productId;
  
          if (rows.length === 0) {
            // Insert new product
            connection.query(
              'INSERT INTO products (product_id, product_name, product_image) VALUES (?, ?, ?)',
              [product_id, product_name, imageUrl],
              (err, result) => {
                if (err) {
                  console.error(err);
                  req.session.message = "Error inserting new product.";
                  return res.redirect('/stock');
                }
  
                productId = result.insertId;
                insertStock(productId);
              }
            );
          } else {
            productId = rows[0].id;
            insertStock(productId);
          }
  
          function insertStock(productId) {
            connection.query(
              'INSERT INTO stock (product_id, vendor_id, quantity, price, description) VALUES (?, ?, ?, ?, ?)',
              [productId, vendorId, quantity, price, description],
              (err) => {
                if (err) {
                  console.error(err);
                  req.session.message = "Error inserting stock.";
                  return res.redirect('/stock');
                }
  
                req.session.message = "Stock added successfully!";
                res.redirect('/stock');
              }
            );
          }
        });
      }
    );
  });
  



app.get('/vendor/stock/edit/:id', (req, res) => {
    const stockId = req.params.id;
  
    const sql = `
      SELECT s.*, p.product_name, p.product_id
      FROM stock s
      JOIN products p ON s.product_id = p.id
      WHERE s.id = ?
    `;
  
    connection.query(sql, [stockId], (err, results) => {
      if (err || results.length === 0) {
        return res.status(404).send('Stock not found');
      }
  
      res.render('vendor/edit_stock', { stock: results[0] });
    });
  });
  
  // Handle Update
  app.patch('/vendor/stock/:id', (req, res) => {
    const stockId = req.params.id;
    const { quantity, price, description } = req.body;
  
    const sql = `
      UPDATE stock SET quantity = ?, price = ?, description = ?
      WHERE id = ?
    `;
  
    connection.query(sql, [quantity, price, description, stockId], (err) => {
      if (err) {
        return res.status(500).send('Error updating stock');
      }
      req.session.message = "Stock updated successfully!";
      res.redirect('/stock');
    });
  });
  app.delete('/vendor/stock/:id', (req, res) => {
    const id = req.params.id;
  
    // First, get the product_id from stock
    connection.query('SELECT product_id FROM stock WHERE id = ?', [id], (err, results) => {
      if (err) {
        console.error('Error fetching product_id:', err);
        return res.status(500).send("Error fetching product_id");
      }
  
      if (results.length === 0) {
        return res.status(404).send("Stock not found");
      }
  
      const productId = results[0].product_id;
  
      // Step 1: Delete from bill_items first
      connection.query('DELETE FROM bill_items WHERE product_id = ?', [productId], (err) => {
        if (err) {
          console.error('Error deleting from bill_items:', err);
          return res.status(500).send("Error deleting from bill_items");
        }
  
        // Step 2: Now delete from products
        connection.query('DELETE FROM products WHERE id = ?', [productId], (err) => {
          if (err) {
            console.error('Error deleting from products:', err);
            return res.status(500).send("Error deleting product");
          }
  
          // Step 3: Now delete from stock
          connection.query('DELETE FROM stock WHERE id = ?', [id], (err) => {
            if (err) {
              console.error('Error deleting stock:', err);
              return res.status(500).send("Error deleting stock");
            }
  
            req.session.message = "Stock, Product, and related Bill Items deleted successfully";
            res.redirect('/stock');
          });
        });
      });
    });
  });
  
  
    

//=================
//MANAGE EMPLOYEE
//================


// Show All Employees
// Route: View all employees (not deleted)
app.get('/vendor/employees', (req, res) => {
  const vendorId = req.session.vendorId;

  if (!vendorId) {
    return res.status(401).send('Unauthorized: Vendor not logged in');
  }

  const sql = `SELECT * FROM vendor_employees WHERE deleted = 0 AND vendor_id = ?`;

  connection.query(sql, [vendorId], (err, employees) => {
    if (err) {
      console.error("Database error:", err.sqlMessage);
      return res.status(500).send('Database query error');
    }

    res.render('vendor/employee', { employees, search: '' });
  });
});

// Route: Search employees
app.get('/vendor/employees/search', (req, res) => {
  const vendorId = req.session.vendorId;
  const searchQuery = req.query.search || '';

  if (!vendorId) {
    return res.status(401).send('Unauthorized: Vendor not logged in');
  }

  const sql = `
    SELECT * FROM vendor_employees 
    WHERE deleted = 0 
      AND vendor_id = ?
      AND (name LIKE ? OR email LIKE ? OR phone_number LIKE ? OR position LIKE ?)
  `;

  const searchTerm = `%${searchQuery}%`;

  connection.query(sql, [vendorId, searchTerm, searchTerm, searchTerm, searchTerm], (err, employees) => {
    if (err) {
      console.error("Database error:", err.sqlMessage);
      return res.status(500).send('Database query error');
    }

    res.render('vendor/employee', { employees, search: searchQuery });
  });
});

  
  // Add Employee
  app.post('/vendor/employees/add', upload.single('photo'), (req, res) => {
    const { name, phone_number, email, position, joining_date, salary, account_number, bank_name, ifsc_code } = req.body;
    const photo_url = req.file.filename;
    const vendor_id = req.session.vendorId;

    if (!vendor_id) {
        return res.status(401).send('Unauthorized: Please log in first');
    }

    // Check if vendor exists
    connection.query('SELECT id FROM vendor_login WHERE id = ?', [vendor_id], (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Database error');
        }

        if (results.length === 0) {
            return res.status(400).send('Invalid vendor_id');
        }

        // Insert employee basic info
        connection.query(
            'INSERT INTO vendor_employees (vendor_id, name, photo_url, phone_number, email, position, joining_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [vendor_id, name, photo_url, phone_number, email, position, joining_date],
            (err, result) => {
                if (err) {
                    console.error(err);
                    return res.status(500).send('Error inserting employee');
                }

                const employeeId = result.insertId;

                // Optional: Insert bank details if provided
                if (account_number || bank_name || ifsc_code) {
                    connection.query(
                        'INSERT INTO vendor_employee_bank (employee_id, account_number, bank_name, ifsc_code) VALUES (?, ?, ?, ?)',
                        [employeeId, account_number || null, bank_name || null, ifsc_code || null],
                        (err) => {
                            if (err) {
                                console.error('Error inserting bank details:', err);
                                // Continue anyway
                            }
                        }
                    );
                }

                // Optional: Insert salary if provided
                if (salary) {
                    const currentMonthYear = `${new Date().getMonth() + 1}-${new Date().getFullYear()}`;
                    connection.query(
                        'INSERT INTO vendor_employee_salary (employee_id, month_year, salary, status) VALUES (?, ?, ?, ?)',
                        [employeeId, currentMonthYear, salary, 'Unpaid'],
                        (err) => {
                            if (err) {
                                console.error('Error inserting salary:', err);
                                // Continue anyway
                            }
                            res.redirect('/vendor/employees');
                        }
                    );
                } else {
                    res.redirect('/vendor/employees');
                }
            }
        );
    });
});

  
  // View Single Employee
  app.get('/vendor/employees/view/:id', (req, res) => {
    const id = req.params.id;
    connection.query('SELECT * FROM vendor_employees WHERE id = ?', [id], (err, emp) => {
      if (err) throw err;
      connection.query('SELECT * FROM vendor_employee_bank WHERE employee_id = ?', [id], (err, bank) => {
        if (err) throw err;
        connection.query('SELECT * FROM vendor_employee_salary WHERE employee_id = ?', [id], (err, salary) => {
          if (err) throw err;
          connection.query('SELECT * FROM vendor_employee_attendance WHERE employee_id = ?', [id], (err, attendance) => {
            if (err) throw err;
            res.render('vendor/view_employee', {
              employee: emp[0],
              bank: bank[0],
              salary,
              attendance
            });
          });
        });
      });
    });
  });

  app.post('/vendor/employees/delete/:id', async (req, res) => {
    const employeeId = req.params.id;
  
    try {
      await connection.promise().query(
        'UPDATE vendor_employees SET deleted = 1 WHERE id = ?', [employeeId]
      );
  
      await connection.promise().query(
        'UPDATE vendor_employee_bank SET deleted = 1 WHERE employee_id = ?', [employeeId]
      );
  
      await connection.promise().query(
        'UPDATE vendor_employee_salary SET deleted = 1 WHERE employee_id = ?', [employeeId]
      );
  
      await connection.promise().query(
        'UPDATE vendor_employee_attendance SET deleted = 1 WHERE employee_id = ?', [employeeId]
      );
  
      res.redirect('/vendor/employees');
    } catch (err) {
      console.error(err);
      res.status(500).send('Error deleting employee.');
    }
  });
  
  // Handle DELETE request for deleting an employee (without updating any details)

  app.post('/vendor/employees/update/:id', upload.single('photo'), async (req, res) => {
    const employeeId = req.params.id;
    const {
      name, position, email, phone_number, joining_date,
      account_number, bank_name, ifsc_code,
      attendance = [],
      salary = []
    } = req.body;
  
    try {
      await connection.promise().query(
        `UPDATE vendor_employees SET name = ?, position = ?, email = ?, phone_number = ?, joining_date = ? WHERE id = ?`,
        [name, position, email, phone_number, joining_date, employeeId]
      );
  
      if (req.file) {
        await connection.promise().query(
          `UPDATE vendor_employees SET photo_url = ? WHERE id = ?`,
          [req.file.filename, employeeId]
        );
      }
  
      const [bankRows] = await connection.promise().query(
        `SELECT * FROM vendor_employee_bank WHERE employee_id = ?`, [employeeId]
      );
  
      if (account_number && bank_name && ifsc_code) {
        if (bankRows.length > 0) {
          await connection.promise().query(
            `UPDATE vendor_employee_bank SET account_number = ?, bank_name = ?, ifsc_code = ? WHERE employee_id = ?`,
            [account_number, bank_name, ifsc_code, employeeId]
          );
        } else {
          await connection.promise().query(
            `INSERT INTO vendor_employee_bank (employee_id, account_number, bank_name, ifsc_code) VALUES (?, ?, ?, ?)`,
            [employeeId, account_number, bank_name, ifsc_code]
          );
        }
      }
  
      if (Array.isArray(salary)) {
        for (const s of salary) {
          if (s.month_year && s.salary && s.status) {
            const [result] = await connection.promise().query(
              `UPDATE vendor_employee_salary
               SET salary = ?, status = ?
               WHERE employee_id = ? AND month_year = ?`,
              [s.salary, s.status, employeeId, s.month_year]
            );
      
            // If not found, insert new
            if (result.affectedRows === 0) {
              await connection.promise().query(
                `INSERT INTO vendor_employee_salary (employee_id, month_year, salary, status)
                 VALUES (?, ?, ?, ?)`,
                [employeeId, s.month_year, s.salary, s.status]
              );
            }
          }
        }
      }
      


      
      if (Array.isArray(attendance)) {
        for (const a of attendance) {
          if (a.date && a.status) {
            const formattedDate = a.date;  // Ensure this is in "YYYY-MM-DD" format.
      
            // Log to confirm the date being passed
            console.log(`Updating attendance for date: ${formattedDate}`);
            
            // Use DATE() to make sure we're comparing just the date part (ignore time)
            const [updateResult] = await connection.promise().query(
              `UPDATE vendor_employee_attendance
               SET status = ?
               WHERE employee_id = ? AND DATE(date) = ?`, // Ensure MySQL compares only the date part
              [a.status, employeeId, formattedDate] // Passing only the date
            );
      
            // If no rows were affected, insert a new record (i.e., no attendance exists for that date)
            if (updateResult.affectedRows === 0) {
              console.log(`No record found for ${formattedDate}, inserting new record.`);
              
              await connection.promise().query(
                `INSERT INTO vendor_employee_attendance (employee_id, date, status)
                 VALUES (?, ?, ?)`,
                [employeeId, formattedDate, a.status]
              );
            } else {
              console.log(`Attendance updated for ${formattedDate}`);
            }
          }
        }
      }
      
      
      
      
      
  
      res.redirect(`/vendor/employees/view/${employeeId}`);
    } catch (err) {
      console.error(err);
      res.status(500).send('Error updating employee.');
    }
  });
  
  
  // Attendance Page
  app.get('/vendor/employees/attendance', (req, res) => {
    connection.query('SELECT * FROM vendor_employees WHERE deleted = 0', (err, employees) => {
      if (err) throw err;
      res.render('vendor/attendance', { employees });
    });
  });
  
  // Submit Attendance
  app.post('/vendor/employees/attendance', (req, res) => {
    const date = new Date().toISOString().slice(0, 10);
    const entries = Object.entries(req.body);
  
    entries.forEach(([key, value]) => {
      const empId = key.split('_')[1];
      connection.query('INSERT INTO vendor_employee_attendance (employee_id, date, status) VALUES (?, ?, ?)', [empId, date, value], (err) => {
        if (err) console.log(err);
      });
    });
  
    res.redirect('/vendor/employees');
  });

  app.get('/vendor/employee/dashboard', async (req, res) => {
    // Get the vendor_id from the session
    const vendorId = req.session.vendorId;
  
    // If no vendor_id exists in the session, redirect to login page
    if (!vendorId) {
      return res.redirect('/vendor_login');
    }
  
    try {
      // Query to get the total number of employees
      const [totalEmployees] = await connection.promise().query(
        'SELECT COUNT(*) AS total FROM vendor_employees WHERE vendor_id = ? AND deleted = 0', [vendorId]);
  
      // Query to get the count of employees present today
      const [presentToday] = await connection.promise().query(
        'SELECT COUNT(*) AS present FROM vendor_employee_attendance a JOIN vendor_employees e ON a.employee_id = e.id WHERE a.date = CURDATE() AND a.status = "Present" AND e.vendor_id = ?', [vendorId]);
  
      // Query to get the total number of employees marked today
      const [totalMarkedToday] = await connection.promise().query(
        'SELECT COUNT(*) AS total FROM vendor_employee_attendance a JOIN vendor_employees e ON a.employee_id = e.id WHERE a.date = CURDATE() AND e.vendor_id = ?', [vendorId]);
  
      // Calculate attendance rate
      const attendanceRate = totalMarkedToday[0].total ? Math.round((presentToday[0].present / totalMarkedToday[0].total) * 100) : 0;
  
      // Query to get the list of absentees today
      const [absentees] = await connection.promise().query(
        `SELECT e.name FROM vendor_employee_attendance a
         JOIN vendor_employees e ON a.employee_id = e.id
         WHERE a.date = CURDATE() AND a.status = 'Absent' AND e.vendor_id = ?`, [vendorId]);
  
      // Render the dashboard view with the statistics and absentees
      res.render('vendor/employee_dashboard', {
        stats: {
          totalEmployees: totalEmployees[0].total,
          presentToday: presentToday[0].present,
          attendanceRate
        },
        absentees
      });
  
    } catch (err) {
      console.error(err);
      res.status(500).send('Error retrieving dashboard data');
    }
  });

//================
//billling
//===============


  app.get('/billing', (req, res) => {
    const vendor_id = req.session.vendorId;
    if (!vendor_id) {
        return res.redirect('/vendor_login');
    }

    connection.query('SELECT * FROM vendor_details WHERE vendor_id = ?', [vendor_id], (err, vendorDetails) => {
        if (err) {
            console.log(err);
            return res.send('Error fetching vendor details');
        }

        res.render('vendor/billing_dashboard', { vendor: vendorDetails[0] });
    });
});

// Assuming you already have 'connection' as your connection connection

// SEARCH PRODUCTS Route
app.get('/search-products', (req, res) => {
    const q = req.query.q;
  
    connection.query(
      `SELECT products.id, products.product_name, stock.price 
      FROM products 
      JOIN stock ON products.id = stock.product_id 
      WHERE products.product_name LIKE ?
      LIMIT 10;`, 
      [`%${q}%`], 
      (err, results) => {
        if (err) {
          console.error(err);
          return res.json({ success: false, products: [] });
        }
        res.json({ success: true, products: results });
      }
    );
  });
  
  


app.post('/generate-bill', (req, res) => {
    const { products, totalAmount } = req.body;
  
    // Take vendorId from session
    const vendorId = req.session.vendorId;
  
    if (!vendorId) {
      return res.status(401).json({ success: false, message: "Unauthorized. Please login first." });
    }
  
    if (!products || products.length === 0) {
      return res.json({ success: false, message: "No products selected." });
    }
  
    // Check if the stock for each product is sufficient
    let stockCheckPromises = products.map(item => {
      return new Promise((resolve, reject) => {
        connection.query(
          'SELECT quantity FROM stock WHERE vendor_id = ? AND product_id = ?',
          [vendorId, item.productId],
          (err, result) => {
            if (err) {
              reject(err);
            } else if (result.length === 0) {
              reject(new Error(`Product with ID ${item.productId} not found in stock.`));
            } else if (result[0].quantity < item.quantity) {
              reject(new Error(`Insufficient stock for product ${item.productId}. Only ${result[0].quantity} available.`));
            } else {
              resolve(); // Sufficient stock for this product
            }
          }
        );
      });
    });
  
    // Wait for all stock checks to pass
    Promise.all(stockCheckPromises)
      .then(() => {
        // If all stock checks are successful, create the bill and insert items
        connection.query('INSERT INTO bills (vendor_id, total_amount) VALUES (?, ?)', [vendorId, totalAmount], (err, billResult) => {
          if (err) {
            console.error("❌ Error creating bill:", err);
            return res.json({ success: false, message: "Error creating bill." });
          }
  
          const billId = billResult.insertId;
          console.log('✅ Bill created with ID:', billId);
  
          const billItemsData = [];
  
          for (const item of products) {
            if (!item.productId) {
              console.error("Invalid productId:", item);
              return res.status(400).json({ success: false, message: "Invalid productId." });
            }
            billItemsData.push([billId, item.productId, item.quantity, item.price * item.quantity]);
          }
  
          // Insert bill items
          connection.query(
            'INSERT INTO bill_items (bill_id, product_id, quantity, total_price) VALUES ?',
            [billItemsData],
            (err) => {
              if (err) {
                console.error("❌ Error inserting bill items:", err);
                return res.json({ success: false, message: "Error inserting bill items." });
              }
  
              console.log('✅ Bill items inserted');
  
              // Update stock
              let updatePromises = products.map(item => {
                return new Promise((resolve, reject) => {
                  connection.query(
                    'UPDATE stock SET quantity = quantity - ? WHERE vendor_id = ? AND product_id = ?',
                    [item.quantity, vendorId, item.productId],
                    (err, result) => {
                      if (err) {
                        reject(err);
                      } else {
                        resolve();
                      }
                    }
                  );
                });
              });
  
              Promise.all(updatePromises)
                .then(() => {
                  console.log('✅ Stock updated successfully');
                  return res.json({
                    success: true,
                    billId: billId,
                    message: 'Bill generated and stock updated successfully.'
                  });
                })
                .catch(err => {
                  console.error("❌ Error updating stock:", err);
                  return res.json({ success: false, message: "Error updating stock." });
                });
  
            }
          );
        });
      })
      .catch(err => {
        console.error("❌ Stock validation failed:", err.message);
        return res.json({ success: false, message: err.message }); // Send error message from stock validation
      });
});

//////////////
//CREATE ORDER
//////////////
app.get('/make_order', (req, res) => {
    const sql = `
        SELECT 
            m.id, 
            md.company_name, 
            md.owner_name, 
            md.phone_number, 
            md.address, 
            md.email, 
            mf.photo_url AS image
        FROM manufacturer_details md
        JOIN manufacturer_login m ON md.manufacturer_id = m.id
        LEFT JOIN manufacturer_profile_photos mf ON mf.manufacturer_id = m.id
    `;
    
    connection.query(sql, (err, results) => {
        if (err) throw err;

        res.render('vendor/make_orders', {
            manufacturers: results
        });
    });
});

// Example of querying products from a specific manufacturer
app.get('/make_order/products/:manufacturer_id', (req, res) => {
    const manufacturerId = req.params.manufacturer_id;
    const vendorId = req.session.vendorId;

    // Ensure vendor is logged in
    if (!vendorId) {
        return res.redirect('/vendor_login');
    }

    const sql = `
        SELECT mp.id, mp.product_name, mp.product_image, ms.quantity, ms.price, ms.description
        FROM manufacturer_products mp
        JOIN manufacturer_stock ms ON mp.id = ms.product_id
        WHERE ms.manufacturer_id = ?
    `;

    // Execute the query with a callback
    connection.query(sql, [manufacturerId], (err, results) => {
        if (err) {
            console.error('Error fetching products:', err);
            return res.status(500).send('Error fetching products');
        }

        // Render the products page and pass the products data
        res.render('vendor/products', {
            products: results,
            manufacturerId: manufacturerId,
            vendorId : vendorId,
            success: req.query.success
        });
    });
});

app.post('/make_order/add_to_cart', (req, res) => {
    const { product_id, quantity, manufacturer_id, vendor_id } = req.body;

    // Log the product_id to check if it's being passed correctly
    console.log('Product ID:', product_id);

    // Step 1: Check if the product exists
    const checkProductSql = 'SELECT * FROM manufacturer_products WHERE id = ?';
    connection.query(checkProductSql, [product_id], (err, productResults) => {
        if (err) {
            console.error('Error checking product existence:', err);
            return res.status(500).send('Error checking product');
        }

        console.log('Product Query Results:', productResults);  // Log the results

        if (productResults.length === 0) {
            return res.status(400).send('Product not found');
        }

        const product = productResults[0];

        // Step 2: Check if the requested quantity is available
        if (quantity > product.quantity) {
            return res.status(400).send(`Not enough stock available! Only ${product.quantity} left.`);
        }

        // Step 3: Add product to cart
        const sql = `
            INSERT INTO cart (vendor_id, product_id, quantity, manufacturer_id)
            VALUES (?, ?, ?, ?)
        `;

        connection.query(sql, [vendor_id, product_id, quantity, manufacturer_id], (err, result) => {
            if (err) {
                console.error('Error adding product to cart:', err);
                return res.status(500).json({ success: false, message: 'Error adding to cart' });
            }

            // Return success message
            res.redirect(`/make_order/products/${manufacturer_id}?success=1`);
        });
    });
});

// Display Cart
// Display Cart
app.get('/cart', (req, res) => {
  const vendorId = req.session.vendorId; // Vendor ID from session

  // Ensure vendor is logged in
  if (!vendorId) {
    return res.redirect('/vendor_login');
  }

  // Fetch cart items from the database, including manufacturer_id
  connection.query(
    `SELECT c.id as cart_id, mp.product_name, mp.product_image, c.quantity, ms.price, c.manufacturer_id
     FROM cart c
     JOIN manufacturer_products mp ON c.product_id = mp.id
     JOIN manufacturer_stock ms ON ms.product_id = mp.id
     WHERE c.vendor_id = ?`,
    [vendorId],
    (err, results) => {
      if (err) {
        console.error('Error fetching cart items:', err);
        return res.status(500).send('Error fetching cart items');
      }

      if (results.length === 0) {
        // If cart is empty, render with empty cart
        return res.render('vendor/cart', {
          vendorId: vendorId,
          manufacturerId: null,   // No manufacturer
          cartItems: [],
          totalAmount: 0
        });
      }

      // Calculate total amount
      let totalAmount = 0;
      results.forEach(item => {
        totalAmount += item.price * item.quantity;
      });

      // Since all cart items must be from the same manufacturer, get manufacturerId from first item
      const manufacturerId = results[0].manufacturer_id;

      // Render cart view
      res.render('vendor/cart', {
        vendorId: vendorId,
        manufacturerId: manufacturerId, // Taken from cart table
        cartItems: results,
        totalAmount: totalAmount
      });
    }
  );
});






app.post('/cart/clear', async (req, res) => {
    const vendorId = req.user.id;

    // Clear the cart
    await connection.query('DELETE FROM cart WHERE vendor_id = ?', [vendorId]);

    res.redirect('/cart');
});

// Update quantity in cart (increase or decrease)
app.post('/cart/update_quantity/:cartId/:action', (req, res) => {
    const { cartId, action } = req.params;
    const query = action === 'increase' 
        ? 'UPDATE cart SET quantity = quantity + 1 WHERE id = ?'
        : 'UPDATE cart SET quantity = quantity - 1 WHERE id = ?';

    connection.query(query, [cartId], (err, result) => {
        if (err) {
            console.error('Error updating quantity:', err);
            return res.status(500).json({ success: false });
        }
        return res.json({ success: true });
    });
});

// Remove item from cart
app.post('/cart/remove_item/:cartId', (req, res) => {
    const { cartId } = req.params;

    connection.query('DELETE FROM cart WHERE id = ?', [cartId], (err, result) => {
        if (err) {
            console.error('Error removing item from cart:', err);
            return res.status(500).json({ success: false });
        }
        return res.json({ success: true });
    });
});

// Place order (dummy function, replace with actual order placing logic)
app.post('/cart/place_order', (req, res) => { 
  const { vendorId, manufacturerId, totalAmount } = req.body;

  // Fetch all cart items for this vendor
  console.log('Fetching cart items for vendorId:', vendorId);
  const fetchCartItemsQuery = `
  SELECT c.*, mp.product_name, mp.product_image, ms.price
  FROM cart c
  JOIN manufacturer_products mp ON c.product_id = mp.id
  JOIN manufacturer_stock ms ON mp.id = ms.product_id
  WHERE c.vendor_id = ?
`;


  console.log('SQL Query:', fetchCartItemsQuery);
  console.log('Vendor ID:', vendorId);
  // Fetch cart items
connection.query(fetchCartItemsQuery, [vendorId], (err, cartItems) => {
  if (err) {
    return res.status(500).send('Error fetching cart items');
  }

  if (cartItems.length === 0) {
    return res.status(400).send('Cart is empty');
  }

  // Calculate the total price
  let totalAmount = 0;
  const validCartItems = cartItems.map(item => {
    const price = parseFloat(item.price); // Ensure price is a number
    const quantity = parseInt(item.quantity, 10); // Ensure quantity is an integer

    if (isNaN(price) || isNaN(quantity)) {
      console.log(`Invalid price or quantity for item: ${JSON.stringify(item)}`);
      return null; // Skip invalid items
    }

    // Calculate subtotal for the item and add to the total amount
    const subtotal = price * quantity;
    totalAmount += subtotal;

    // Return the valid cart item with the computed subtotal
    return { ...item, subtotal };
  }).filter(item => item !== null); // Filter out invalid items

  if (validCartItems.length === 0) {
    return res.status(400).send('Invalid cart items');
  }

  // Now you can use the valid cart items and totalAmount to place the order
  const orderQuery = `INSERT INTO orders (vendor_id, manufacturer_id, total_amount) VALUES (?, ?, ?)`;
  connection.query(orderQuery, [vendorId, manufacturerId, totalAmount], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).send('Error placing order');
    }

    const orderId = result.insertId;

    // Insert each cart item into the order_items table
    const insertCartItems = validCartItems.map(item => {
      return new Promise((resolve, reject) => {
        const cartItemQuery = `INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)`;
        connection.query(cartItemQuery, [orderId, item.product_id, item.quantity, item.price], (err, result) => {
          if (err) reject(err);
          resolve(result);
        });
      });
    });

    Promise.all(insertCartItems)
      .then(() => {
        // After order items inserted, clear the cart
        const deleteQuery = `DELETE FROM cart WHERE vendor_id = ?`;
        connection.query(deleteQuery, [vendorId], (err, result) => {
          if (err) {
            return res.status(500).send('Error clearing cart');
          }
          res.redirect('/vendor_dashboard');  // Redirect after successful order
        });
      })
      .catch(err => {
        return res.status(500).send('Error placing order items');
      });
  });
});

});





//ORDERS
// Get all orders
app.get('/vendor/orders', (req, res) => {
  const vendorId = req.session.vendorId; // assuming session has vendorId
  if (!vendorId) {
    return res.redirect('/vendor_login');
  }
  const sql = `SELECT * FROM orders WHERE vendor_id = ? ORDER BY order_date DESC`;
  connection.query(sql, [vendorId], (err, orders) => {
      if (err) throw err;
      res.render('vendor/orders', { orders });
  });
});

// Get order details
app.get('/vendor/orders/:orderId', (req, res) => {
  const orderId = req.params.orderId;

  const orderQuery = `SELECT * FROM orders WHERE id = ?`;
  const itemsQuery = `
    SELECT oi.quantity, oi.price, mp.product_name, mp.product_image
    FROM order_items oi
    JOIN manufacturer_products mp ON oi.product_id = mp.id
    WHERE oi.order_id = ?
  `;

  connection.query(orderQuery, [orderId], (err, orderResult) => {
    if (err) {
      console.error('Error fetching order:', err);
      return res.status(500).send('Error fetching order');
    }

    if (orderResult.length === 0) {
      return res.status(404).send('Order not found');
    }

    const order = orderResult[0]; // Extract order object

    connection.query(itemsQuery, [orderId], (err, itemResults) => {
      if (err) {
        console.error('Error fetching order items:', err);
        return res.status(500).send('Error fetching order items');
      }

      // Format items properly
      const formattedItems = itemResults.map(item => ({
        ...item,
        price: parseFloat(item.price),
        quantity: parseInt(item.quantity)
      }));

      // Pass the order and items to EJS
      res.render('vendor/order_details', {
        order: {
          ...order,
          total_amount: parseFloat(order.total_amount), // Ensure total_amount is a number
          order_status: order.order_status // Pass status cleanly
        },
        orderItems: formattedItems
      });
    });
  });
});






//PROFILE

// Manufacturer logout route
app.get('/logout_manufacturer', (req, res) => {
    // Destroy the session to log the user out
    req.session.destroy((err) => {
      if (err) {
        console.log(err);
        return res.status(500).send('Error while logging out');
      }
  
      // Redirect to login page after successful logout
      res.redirect('/manufacturer_login');
    });
  });
  
app.get("/manufacturer_dashboard", (req, res) => {
    res.render("manufacturer/manufacturer_dashboard");
  });
  
  // Manufacturer profile route (GET)
  app.get('/manufacturer/profile', async (req, res) => {
    const manufacturerId = req.session.manufacturerId;  // Using the correct session key
  
    if (!manufacturerId) {
      return res.redirect('/manufacturer_login');  // If no manufacturer ID in session, redirect to login
    }
  
    try {
      const [loginRows] = await query('SELECT * FROM manufacturer_login WHERE id = ?', [manufacturerId]);
      const [detailsRows] = await query('SELECT * FROM manufacturer_details WHERE manufacturer_id = ?', [manufacturerId]);
      const [photoRows] = await query('SELECT * FROM manufacturer_profile_photos WHERE manufacturer_id = ?', [manufacturerId]);
  
      res.render('manufacturer/manufacturer_profile', {
        loginData: loginRows[0],
        manufacturerData: detailsRows[0],
        photoData: photoRows[0] || {},
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Error loading manufacturer profile');
    }
  });
  
  // Manufacturer photo upload route
  app.post('/manufacturer/profile/upload-photo', upload.single('profile_photo'), (req, res) => {
    const manufacturerId = req.session.manufacturerId;
    if (!manufacturerId) return res.redirect('/manufacturer_login');
  
    const photoUrl = '/uploads/' + req.file.filename;
  
    connection.query('SELECT * FROM manufacturer_profile_photos WHERE manufacturer_id = ?', [manufacturerId], (err, existingRows) => {
      if (err) {
        console.log(err);
        return res.status(500).send('Database query failed');
      }
  
      if (existingRows.length > 0) {
        // Update the existing photo URL
        connection.query('UPDATE manufacturer_profile_photos SET photo_url = ? WHERE manufacturer_id = ?', [photoUrl, manufacturerId], (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send('Failed to update photo');
          }
          res.redirect('/manufacturer/profile');
        });
      } else {
        // Insert a new photo URL for the manufacturer
        connection.query('INSERT INTO manufacturer_profile_photos (manufacturer_id, photo_url) VALUES (?, ?)', [manufacturerId, photoUrl], (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send('Failed to insert photo');
          }
          res.redirect('/manufacturer/profile');
        });
      }
    });
  });
  
  // Manufacturer profile update route
  app.post('/manufacturer/profile/update', async (req, res) => {
    const manufacturerId = req.session.manufacturerId;
    if (!manufacturerId) return res.redirect('/manufacturer_login');
  
    const { username, email, phone_number, company_name, owner_name, address } = req.body;
  
    try {
      await query('UPDATE manufacturer_login SET username = ? WHERE id = ?', [username, manufacturerId]);
      await query(`
        UPDATE manufacturer_details
        SET email = ?, phone_number = ?, company_name = ?, owner_name = ?, address = ?
        WHERE manufacturer_id = ?
      `, [email, phone_number, company_name, owner_name, address, manufacturerId]);
  
      res.redirect('/manufacturer/profile');
    } catch (err) {
      console.log(err);
      res.status(500).send('Update failed');
    }
  });
  
  // Manufacturer password change route
  app.post('/manufacturer/profile/change-password', async (req, res) => {
    const manufacturerId = req.session.manufacturerId;
    if (!manufacturerId) return res.redirect('/manufacturer_login');
  
    const { current_password, new_password, confirm_password } = req.body;
  
    try {
      // Fetch the stored password from the database
      connection.query('SELECT password FROM manufacturer_login WHERE id = ?', [manufacturerId], (err, rows) => {
        if (err) {
          console.log(err);
          return res.status(500).send('Error fetching password');
        }
  
        if (!rows.length) return res.send('User not found');
  
        // Check if the current password matches
        if (current_password !== rows[0].password) return res.send('Incorrect current password');
  
        // Check if new passwords match
        if (new_password !== confirm_password) return res.send('Passwords do not match');
  
        // Update the password
        connection.query('UPDATE manufacturer_login SET password = ? WHERE id = ?', [new_password, manufacturerId], (err) => {
          if (err) {
            console.log(err);
            return res.status(500).send('Password update failed');
          }
  
          res.redirect('/manufacturer/profile');
        });
      });
    } catch (err) {
      console.log(err);
      res.status(500).send('Password change failed');
    }
  });

  
//==================
//EMPLOYEES
//==================

// Route: Get all employees
app.get('/manufacturer/employees', (req, res) => {
  const manufacturerId = req.session.manufacturerId;
  
  // Check if manufacturer is logged in (session control)
  if (!manufacturerId) {
    req.session.message = "Please login first!";
    return res.redirect('/manufacturer_login');
  }

  const searchQuery = req.query.search || '';

  const sql = `
    SELECT * FROM manufacturer_employees 
    WHERE deleted = 0 
    AND manufacturer_id = ? 
    AND (name LIKE ? OR email LIKE ? OR phone_number LIKE ? OR position LIKE ?)
    ORDER BY id DESC
  `;

  const searchTerm = `%${searchQuery}%`;

  connection.query(sql, [manufacturerId, searchTerm, searchTerm, searchTerm, searchTerm], (err, employees) => {
    if (err) {
      console.error("Error fetching manufacturer employees:", err);
      return res.status(500).send("Database query error.");
    }

    res.render('manufacturer/manufacturer_employee', {
      employees,
      search: searchQuery
    });
  });
});

  // Route: Search employees
  app.get('/manufacturer/employees/search', (req, res) => {
    const searchQuery = req.query.search || '';
    
    const sql = `
      SELECT * FROM manufacturer_employees 
      WHERE deleted = 0 
      AND (name LIKE ? OR email LIKE ? OR phone_number LIKE ? OR position LIKE ?)
    `;
  
    const searchTerm = `%${searchQuery}%`;
  
    connection.query(sql, [searchTerm, searchTerm, searchTerm, searchTerm], (err, employees) => {
      if (err) throw err;
      res.render('manufacturer/manufacturer_employee', { employees, search: searchQuery }); // <-- send back search term
    });
  });
  
  // Add Employee
  app.post('/manufacturer/employees/add', upload.single('photo'), (req, res) => {
    const { name, phone_number, email, position, joining_date, salary, account_number, bank_name, ifsc_code } = req.body;
    const photo_url = req.file.filename;
    const manufacturer_id = req.session.manufacturerId;
  
    if (!manufacturer_id) {
      return res.status(401).send('Unauthorized: Please log in first');
    }
  
    // Check if manufacturer exists
    connection.query('SELECT id FROM manufacturer_login WHERE id = ?', [manufacturer_id], (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Database error');
      }
  
      if (results.length === 0) {
        return res.status(400).send('Invalid manufacturer_id');
      }
  
      // Insert employee basic info
      connection.query(
        'INSERT INTO manufacturer_employees (manufacturer_id, name, photo_url, phone_number, email, position, joining_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [manufacturer_id, name, photo_url, phone_number, email, position, joining_date],
        (err, result) => {
          if (err) {
            console.error(err);
            return res.status(500).send('Error inserting employee');
          }
  
          const employeeId = result.insertId;
  
          // Optional: Insert bank details if provided
          if (account_number || bank_name || ifsc_code) {
            connection.query(
              'INSERT INTO manufacturer_employee_bank (employee_id, account_number, bank_name, ifsc_code) VALUES (?, ?, ?, ?)',
              [employeeId, account_number || null, bank_name || null, ifsc_code || null],
              (err) => {
                if (err) {
                  console.error('Error inserting bank details:', err);
                  // Continue anyway
                }
              }
            );
          }
  
          // Optional: Insert salary if provided
          if (salary) {
            const currentMonthYear = `${new Date().getMonth() + 1}-${new Date().getFullYear()}`;
            connection.query(
              'INSERT INTO manufacturer_employee_salary (employee_id, month_year, salary, status) VALUES (?, ?, ?, ?)',
              [employeeId, currentMonthYear, salary, 'Unpaid'],
              (err) => {
                if (err) {
                  console.error('Error inserting salary:', err);
                  // Continue anyway
                }
                res.redirect('/manufacturer/employees');
              }
            );
          } else {
            res.redirect('/manufacturer/employees');
          }
        }
      );
    });
  });
  
  // View Single Employee
  app.get('/manufacturer/employees/view/:id', (req, res) => {
    const id = req.params.id;
    connection.query('SELECT * FROM manufacturer_employees WHERE id = ?', [id], (err, emp) => {
      if (err) throw err;
      connection.query('SELECT * FROM manufacturer_employee_bank WHERE employee_id = ?', [id], (err, bank) => {
        if (err) throw err;
        connection.query('SELECT * FROM manufacturer_employee_salary WHERE employee_id = ?', [id], (err, salary) => {
          if (err) throw err;
          connection.query('SELECT * FROM manufacturer_employee_attendance WHERE employee_id = ?', [id], (err, attendance) => {
            if (err) throw err;
            res.render('manufacturer/view_employee', {
              employee: emp[0],
              bank: bank[0],
              salary,
              attendance
            });
          });
        });
      });
    });
  });
  
  // Delete Employee
  app.post('/manufacturer/employees/delete/:id', async (req, res) => {
    const employeeId = req.params.id;
  
    try {
      await connection.promise().query(
        'UPDATE manufacturer_employees SET deleted = 1 WHERE id = ?', [employeeId]
      );
  
      await connection.promise().query(
        'UPDATE manufacturer_employee_bank SET deleted = 1 WHERE employee_id = ?', [employeeId]
      );
  
      await connection.promise().query(
        'UPDATE manufacturer_employee_salary SET deleted = 1 WHERE employee_id = ?', [employeeId]
      );
  
      await connection.promise().query(
        'UPDATE manufacturer_employee_attendance SET deleted = 1 WHERE employee_id = ?', [employeeId]
      );
  
      res.redirect('/manufacturer/employees');
    } catch (err) {
      console.error(err);
      res.status(500).send('Error deleting employee.');
    }
  });
  
  // Update Employee Details
  app.post('/manufacturer/employees/update/:id', upload.single('photo'), async (req, res) => {
    const employeeId = req.params.id;
    const {
        name, position, email, phone_number, joining_date,
        account_number, bank_name, ifsc_code,
        attendance = [],
        salary = []
    } = req.body;

    try {
        // Validate required fields
        if (!name || !position || !email || !phone_number || !joining_date) {
            return res.status(400).send('Missing required fields.');
        }

        // Update basic employee info
        await connection.promise().query(
            `UPDATE manufacturer_employees SET name = ?, position = ?, email = ?, phone_number = ?, joining_date = ? WHERE id = ?`,
            [name, position, email, phone_number, joining_date, employeeId]
        );

        // Update photo if new file is uploaded
        if (req.file) {
            await connection.promise().query(
                `UPDATE manufacturer_employees SET photo_url = ? WHERE id = ?`,
                [req.file.filename, employeeId]
            );
        }

        // Handle bank details update or insert
        if (account_number && bank_name && ifsc_code) {
            const [bankRows] = await connection.promise().query(
                `SELECT * FROM manufacturer_employee_bank WHERE employee_id = ?`, [employeeId]
            );

            if (bankRows.length > 0) {
                await connection.promise().query(
                    `UPDATE manufacturer_employee_bank SET account_number = ?, bank_name = ?, ifsc_code = ? WHERE employee_id = ?`,
                    [account_number, bank_name, ifsc_code, employeeId]
                );
            } else {
                await connection.promise().query(
                    `INSERT INTO manufacturer_employee_bank (employee_id, account_number, bank_name, ifsc_code) VALUES (?, ?, ?, ?)`,
                    [employeeId, account_number, bank_name, ifsc_code]
                );
            }
        }

        // Update salary details (if any)
        if (Array.isArray(salary) && salary.length > 0) {
            for (const s of salary) {
                const { month_year, salary: salaryAmount, status } = s;
                if (month_year && salaryAmount && status) {
                    const [result] = await connection.promise().query(
                        `UPDATE manufacturer_employee_salary SET salary = ?, status = ? WHERE employee_id = ? AND month_year = ?`,
                        [salaryAmount, status, employeeId, month_year]
                    );

                    // If no rows were affected, insert new record
                    if (result.affectedRows === 0) {
                        await connection.promise().query(
                            `INSERT INTO manufacturer_employee_salary (employee_id, month_year, salary, status) VALUES (?, ?, ?, ?)`,
                            [employeeId, month_year, salaryAmount, status]
                        );
                    }
                }
            }
        }

        // Handle attendance update or insert
        if (Array.isArray(attendance)) {
            for (const a of attendance) {
              if (a.date && a.status) {
                const formattedDate = a.date;  // Ensure this is in "YYYY-MM-DD" format.
          
                // Log to confirm the date being passed
                console.log(`Updating attendance for date: ${formattedDate}`);
                
                // Use DATE() to make sure we're comparing just the date part (ignore time)
                const [updateResult] = await connection.promise().query(
                  `UPDATE manufacturer_employee_attendance
                   SET status = ?
                   WHERE employee_id = ? AND DATE(date) = ?`, // Ensure MySQL compares only the date part
                  [a.status, employeeId, formattedDate] // Passing only the date
                );
          
                // If no rows were affected, insert a new record (i.e., no attendance exists for that date)
                if (updateResult.affectedRows === 0) {
                  console.log(`No record found for ${formattedDate}, inserting new record.`);
                  
                  await connection.promise().query(
                    `INSERT INTO manufacturer_employee_attendance (employee_id, date, status)
                     VALUES (?, ?, ?)`,
                    [employeeId, formattedDate, a.status]
                  );
                } else {
                  console.log(`Attendance updated for ${formattedDate}`);
                }
              }
            }
          }

        res.redirect(`/manufacturer/employees/view/${employeeId}`);
    } catch (err) {
        console.error('Error updating employee:', err);
        res.status(500).send('Error updating employee.');
    }
});

  
// Show the attendance page with the list of employees
app.get('/manufacturer/employees/attendance', (req, res) => {
  const date = new Date().toISOString().slice(0, 10); // Get today's date

  // Query to get employees who don't have attendance for today
  const query = `
    SELECT * FROM manufacturer_employees
    WHERE deleted = 0 AND id NOT IN (
      SELECT employee_id FROM manufacturer_employee_attendance
      WHERE date = ?
    )
  `;

  connection.query(query, [date], (err, employees) => {
    if (err) {
      console.error('Error fetching employees:', err);
      return res.status(500).render('error', { message: 'Error fetching employee data.' });
    }
    res.render('manufacturer/attendance', { employees });
  });
});

// Submit Attendance
app.post('/manufacturer/employees/attendance', (req, res) => {
  const date = new Date().toISOString().slice(0, 10);
  const entries = Object.entries(req.body);

  // Start a transaction to ensure all attendance records are inserted correctly
  connection.beginTransaction((err) => {
    if (err) {
      console.error('Error starting transaction:', err);
      return res.status(500).send('Error starting transaction.');
    }

    let attendanceRecorded = false; // Flag to check if any attendance is recorded

    // Loop through each attendance entry and insert into the database
    entries.forEach(([key, value], index) => {
      const empId = key.split('_')[1];

      // Skip if "No Attendance" is selected
      if (value === 'No Attendance') return;

      connection.query('INSERT INTO manufacturer_employee_attendance (employee_id, date, status) VALUES (?, ?, ?)', [empId, date, value], (err) => {
        if (err) {
          console.error('Error inserting attendance for employee:', empId, err);
          return connection.rollback(() => {
            res.status(500).send('Error inserting attendance.');
          });
        }

        attendanceRecorded = true;

        // Commit transaction after all queries are successful
        if (index === entries.length - 1) {
          connection.commit((err) => {
            if (err) {
              console.error('Error committing transaction:', err);
              return connection.rollback(() => {
                res.status(500).send('Error committing transaction.');
              });
            }

            if (attendanceRecorded) {
              res.redirect('/manufacturer/employees?attendance=success');
            } else {
              res.redirect('/manufacturer/employees?attendance=nothing');
            }
          });
        }
      });
    });
  });
});

  
  // Manufacturer Dashboard
  app.get('/manufacturer/employee/dashboard', async (req, res) => {
    const manufacturerId = req.session.manufacturerId;
  
    if (!manufacturerId) {
      return res.redirect('/manufacturer_login');
    }
  
    try {
      const [totalEmployees] = await connection.promise().query(
        'SELECT COUNT(*) AS total FROM manufacturer_employees WHERE manufacturer_id = ? AND deleted = 0', [manufacturerId]);
  
      const [presentToday] = await connection.promise().query(
        'SELECT COUNT(*) AS present FROM manufacturer_employee_attendance a JOIN manufacturer_employees e ON a.employee_id = e.id WHERE a.date = CURDATE() AND a.status = "Present" AND e.manufacturer_id = ?', [manufacturerId]);
  
      const [totalMarkedToday] = await connection.promise().query(
        'SELECT COUNT(*) AS total FROM manufacturer_employee_attendance a JOIN manufacturer_employees e ON a.employee_id = e.id WHERE a.date = CURDATE() AND e.manufacturer_id = ?', [manufacturerId]);
  
      const attendanceRate = totalMarkedToday[0].total ? Math.round((presentToday[0].present / totalMarkedToday[0].total) * 100) : 0;
  
      const [absentees] = await connection.promise().query(
        `SELECT e.name FROM manufacturer_employee_attendance a
         JOIN manufacturer_employees e ON a.employee_id = e.id
         WHERE a.date = CURDATE() AND a.status = 'Absent' AND e.manufacturer_id = ?`, [manufacturerId]);
  
      res.render('manufacturer/manufacturer_employee_dashboard', {
        stats: {
          totalEmployees: totalEmployees[0].total,
          presentToday: presentToday[0].present,
          attendanceRate
        },
        absentees
      });
  
    } catch (err) {
      console.error(err);
      res.status(500).send('Error fetching dashboard data');
    }
  });

  
// ======================
// MANUFACTURER STOCK ROUTES (IDENTICAL TO VENDOR VERSION)
// ======================

// Route to view products for Manufacturer with search
// Manufacturer Stock Page
app.get('/manufacturer/stock', (req, res) => {
  const search = req.query.search || '';
  const manufacturerId = req.session.manufacturerId; // Make sure this is set at login

  if (!manufacturerId) {
    return res.redirect('/manufacturer_login');
  }

  const sql = `
    SELECT 
      s.id AS stock_id, 
      p.product_id AS product_id_display, 
      p.product_name, 
      p.product_image, 
      s.quantity, 
      s.price, 
      s.description
    FROM manufacturer_stock s
    INNER JOIN manufacturer_products p ON s.product_id = p.id
    WHERE s.manufacturer_id = ? 
      AND (p.product_name LIKE ? OR CAST(p.product_id AS CHAR) LIKE ?)
    ORDER BY s.id DESC
  `;

  const searchTerm = `%${search}%`;

  connection.query(sql, [manufacturerId, searchTerm, searchTerm], (err, results) => {
    if (err) {
      console.error("Database error:", err.sqlMessage);
      return res.status(500).send('Database query error');
    }

    const message = req.session.message || '';
    req.session.message = '';

    res.render('manufacturer/stock', {
      stock: results,
      search,
      message
    });
  });
});


// Add new manufacturer stock
// File upload config for manufacturer
const manufacturerUpload = multer({ storage }).single('product_image');

app.post('/manufacturer/products/add', manufacturerUpload, (req, res) => {
  const manufacturerId = req.session.manufacturerId;

  if (!manufacturerId) {
    req.session.message = "Please login first!";
    return res.redirect('/manufacturer/login');
  }

  const { product_id, product_name, quantity, price, description } = req.body;
  const imageUrl = req.file ? `uploads/${req.file.filename}` : null;

  // Step 1: Check if product exists in manufacturer_products
  connection.query(
    'SELECT id FROM manufacturer_products WHERE product_id = ?',
    [product_id],
    (err, productRows) => {
      if (err) {
        console.error(err);
        req.session.message = "Error checking manufacturer product.";
        return res.redirect('/manufacturer/stock');
      }

      let productId;

      if (productRows.length === 0) {
        // Step 2: Product doesn't exist, insert it
        connection.query(
          'INSERT INTO manufacturer_products (product_id, product_name, product_image) VALUES (?, ?, ?)',
          [product_id, product_name, imageUrl],
          (err, result) => {
            if (err) {
              console.error(err);
              req.session.message = "Error inserting new manufacturer product.";
              return res.redirect('/manufacturer/stock');
            }

            productId = result.insertId;
            insertManufacturerStock(productId);
          }
        );
      } else {
        // Step 3: Product exists, check if it's already in stock for this manufacturer
        productId = productRows[0].id;

        connection.query(
          'SELECT * FROM manufacturer_stock WHERE product_id = ? AND manufacturer_id = ?',
          [productId, manufacturerId],
          (err, stockRows) => {
            if (err) {
              console.error(err);
              req.session.message = "Error checking existing manufacturer stock.";
              return res.redirect('/manufacturer/stock');
            }

            if (stockRows.length > 0) {
              req.session.message = "Product ID already exists in your stock!";
              return res.redirect('/manufacturer/stock');
            }

            insertManufacturerStock(productId);
          }
        );
      }

      function insertManufacturerStock(productId) {
        connection.query(
          'INSERT INTO manufacturer_stock (product_id, manufacturer_id, quantity, price, description) VALUES (?, ?, ?, ?, ?)',
          [productId, manufacturerId, quantity, price, description],
          (err) => {
            if (err) {
              console.error(err);
              req.session.message = "Error inserting manufacturer stock.";
              return res.redirect('/manufacturer/stock');
            }

            req.session.message = "Manufacturer stock added successfully!";
            res.redirect('/manufacturer/stock');
          }
        );
      }
    }
  );
});

// Handle Update
app.patch('/manufacturer/stock/:id', (req, res) => {
    const stockId = req.params.id;
    const { quantity, price, description } = req.body;

    const sql = `
      UPDATE manufacturer_stock SET quantity = ?, price = ?, description = ?
      WHERE id = ?
    `;

    connection.query(sql, [quantity, price, description, stockId], (err) => {
        if (err) {
            return res.status(500).send('Error updating stock');
        }
        req.session.message = "Stock updated successfully!";
        res.redirect('/manufacturer/stock');
    });
});

// Delete stock
app.delete('/manufacturer/stock/:id', (req, res) => {
    const id = req.params.id;

    connection.query('SELECT product_id FROM manufacturer_stock WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error('Error fetching product_id:', err);
            return res.status(500).send("Error fetching product_id");
        }

        if (results.length === 0) {
            return res.status(404).send("Stock not found");
        }

        const productId = results[0].product_id;

        // Step 1: Delete related bill_items first (assuming manufacturer bills exist, otherwise skip this)
        connection.query('DELETE FROM bill_items WHERE product_id = ?', [productId], (err) => {
            if (err) {
                console.error('Error deleting from bill_items:', err);
                return res.status(500).send("Error deleting from bill_items");
            }

            // Step 2: Delete from manufacturer_products
            connection.query('DELETE FROM manufacturer_products WHERE id = ?', [productId], (err) => {
                if (err) {
                    console.error('Error deleting from manufacturer_products:', err);
                    return res.status(500).send("Error deleting product");
                }

                // Step 3: Delete from manufacturer_stock
                connection.query('DELETE FROM manufacturer_stock WHERE id = ?', [id], (err) => {
                    if (err) {
                        console.error('Error deleting manufacturer_stock:', err);
                        return res.status(500).send("Error deleting stock");
                    }

                    req.session.message = "Stock, Product, and related Bill Items deleted successfully";
                    res.redirect('/manufacturer/stock');
                });
            });
        });
    });
});

// View Edit Product Page
// GET - Load the Edit Product Page
app.get('/manufacturer/products/edit/:id', (req, res) => {
    const stockId = req.params.id;

    const manufacturerId = req.session.manufacturerId;

  // Session Control
  if (!manufacturerId) {
    req.session.message = "Please login first!";
    return res.redirect('/manufacturer_login');
  }
  
    const fetchSql = `
      SELECT p.product_id AS product_id_display, p.product_name, s.id, s.quantity, s.price, s.description
    FROM manufacturer_stock s
    JOIN manufacturer_products p ON s.product_id = p.id
    WHERE s.id = ?
    `;
  
    connection.query(fetchSql, [stockId], (err, results) => {
      if (err) {
        console.error('Error fetching product for edit:', err);
        return res.status(500).send('Server error while fetching product.');
      }
  
      if (results.length === 0) {
        return res.status(404).send('Product not found.');
      }
  
      const product = results[0];
  
      res.render('manufacturer/edit_stock', { product });
    });
  });
  
///ORDERS

// Route to view all orders for the manufacturer
// Route to view all orders for the manufacturer
app.get('/manufacturer/orders', (req, res) => {
  const manufacturerId = req.session.manufacturerId;

  // Session Control
  if (!manufacturerId) {
    req.session.message = "Please login first!";
    return res.redirect('/manufacturer_login');
  }

  // Query to get only 'Order Placed' orders for this manufacturer
  const ordersQuery = `
    SELECT o.id AS order_id, o.vendor_id, o.manufacturer_id, o.total_amount, o.order_status, o.order_date, 
           v.shop_name, v.owner_name, v.phone_number, v.email
    FROM orders o
    JOIN vendor_details v ON o.vendor_id = v.vendor_id
    WHERE o.manufacturer_id = ? AND o.order_status = 'Order Placed'
  `;

  connection.query(ordersQuery, [manufacturerId], (err, orders) => {
    if (err) {
      return res.status(500).send('Error fetching orders');
    }

    // If no orders are found, render the orders page with an empty list
    if (orders.length === 0) {
      return res.render('manufacturer/orders', {
        orders: [],
        groupedOrderItems: {}
      });
    }

    // Fetch the items for each order (only for orders with status 'Order Placed')
    const orderItemsQuery = `
      SELECT oi.order_id, oi.product_id, mp.product_name, oi.quantity, oi.price, oi.total_price
      FROM order_items oi
      JOIN manufacturer_products mp ON oi.product_id = mp.id
      WHERE oi.order_id IN (?)
    `;

    // Get all order IDs from the previous query
    const orderIds = orders.map(order => order.order_id);

    connection.query(orderItemsQuery, [orderIds], (err, orderItems) => {
      if (err) {
        return res.status(500).send('Error fetching order items');
      }

      // Group order items by order_id
      const groupedOrderItems = orderItems.reduce((acc, item) => {
        if (!acc[item.order_id]) {
          acc[item.order_id] = [];
        }
        acc[item.order_id].push(item);
        return acc;
      }, {});

      // Render orders page with all details
      res.render('manufacturer/orders', {
        orders,
        groupedOrderItems
      });
    });
  });
});


// Route to update the order status to 'Accepted'
// Route to update the order status to 'Accepted'
app.post('/manufacturer/order/accept/:orderId', (req, res) => {
  const manufacturerId = req.session.manufacturerId;

  // Session Control
  if (!manufacturerId) {
    req.session.message = "Please login first!";
    return res.redirect('/manufacturer_login');
  }
  const orderId = req.params.orderId;
  const status = 'Order Accepted';

  const getOrderItemsQuery = `
    SELECT oi.product_id, oi.quantity 
    FROM order_items oi 
    WHERE oi.order_id = ?
  `;

  connection.query(getOrderItemsQuery, [orderId], (err, orderItems) => {
    if (err) {
      console.error('Error fetching order items:', err);
      return res.status(500).send('Error fetching order items');
    }

    if (orderItems.length === 0) {
      return res.status(400).send('No order items found');
    }

    // Step 1: Fetch current stock for all products
    const productIds = orderItems.map(item => item.product_id);

    const getStockQuery = `
      SELECT product_id, quantity 
      FROM manufacturer_stock 
      WHERE product_id IN (?)
    `;

    connection.query(getStockQuery, [productIds], (err, stockResults) => {
      if (err) {
        console.error('Error fetching stock:', err);
        return res.status(500).send('Error fetching stock');
      }

      // Step 2: Check if stock is enough for each item
      const stockMap = {};
      stockResults.forEach(stock => {
        stockMap[stock.product_id] = stock.quantity;
      });

      const insufficientStock = orderItems.find(item => {
        return stockMap[item.product_id] === undefined || stockMap[item.product_id] < item.quantity;
      });

      if (insufficientStock) {
        return res.status(400).send('Cannot accept order: Insufficient stock for one or more products.');
      }

      // Step 3: Update stock for each product
      const updateStockPromises = orderItems.map(item => {
        const updateStockQuery = `
          UPDATE manufacturer_stock 
          SET quantity = quantity - ? 
          WHERE product_id = ?
        `;
        return new Promise((resolve, reject) => {
          connection.query(updateStockQuery, [item.quantity, item.product_id], (err, result) => {
            if (err) {
              return reject(err);
            }
            resolve(result);
          });
        });
      });

      Promise.all(updateStockPromises)
        .then(() => {
          // Step 4: Update order status
          const updateOrderStatusQuery = `
            UPDATE orders 
            SET order_status = ? 
            WHERE id = ?
          `;
          connection.query(updateOrderStatusQuery, [status, orderId], (err, result) => {
            if (err) {
              console.error('Error updating order status:', err);
              return res.status(500).send('Error updating order status');
            }

            res.redirect('/manufacturer/orders');
          });
        })
        .catch(err => {
          console.error('Error updating stock:', err);
          res.status(500).send('Error updating stock');
        });
    });
  });
});

// Route to update the order status to 'Rejected'
app.post('/manufacturer/order/reject/:orderId', (req, res) => {
  const orderId = req.params.orderId;
  const status = 'Order Rejected'; // Change status to 'Rejected'

  // Update order status in the database
  const updateStatusQuery = `
    UPDATE orders
    SET order_status = ?
    WHERE id = ?
  `;

  connection.query(updateStatusQuery, [status, orderId], (err, result) => {
    if (err) {
      return res.status(500).send('Error updating order status');
    }

    res.redirect('/manufacturer/orders'); // Redirect back to orders page
  });
});

app.get('/manufacturer/manage-orders', (req, res) => {
  const manufacturerId = req.session.manufacturerId;

  // Session Control
  if (!manufacturerId) {
    req.session.message = "Please login first!";
    return res.redirect('/manufacturer_login');
  }
  const { search = '', statusFilter = '' } = req.query;

  let query = `
    SELECT o.id AS order_id, o.total_amount, o.order_status, o.order_date,
           v.shop_name, v.owner_name, v.phone_number, v.address, v.email
    FROM orders o
    JOIN vendor_details v ON o.vendor_id = v.vendor_id
    WHERE o.manufacturer_id = ? 
    AND o.order_status IN ('Order Accepted', 'Order Rejected', 'Dispatched', 'Delivered')
  `;

  const params = [manufacturerId];

  if (search) {
    query += ` AND (o.id LIKE ? OR v.shop_name LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  if (statusFilter && statusFilter !== 'All') {
    query += ` AND o.order_status = ?`;
    params.push(statusFilter);
  }

  query += ` ORDER BY o.order_date DESC`;

  connection.query(query, params, (err, results) => {
    if (err) {
      console.error('Error fetching orders:', err);
      return res.status(500).send('Error fetching orders');
    }
    res.render('manufacturer/manage_orders', { orders: results, search, statusFilter });
  });
});


app.post('/manufacturer/order/dispatch/:orderId', (req, res) => {
  const manufacturerId = req.session.manufacturerId;

  // Session Control
  if (!manufacturerId) {
    req.session.message = "Please login first!";
    return res.redirect('/manufacturer_login');
  }
  const orderId = req.params.orderId;
  const status = 'Dispatched';

  const updateQuery = `
    UPDATE orders 
    SET order_status = ? 
    WHERE id = ?
  `;

  connection.query(updateQuery, [status, orderId], (err, result) => {
    if (err) {
      console.error('Error updating order status:', err);
      return res.status(500).send('Error dispatching order');
    }

    res.redirect('/manufacturer/manage-orders');
  });
});


// Start the server
app.listen(3000, () => {
    console.log(`Server running at http://localhost:${3000}`);
});