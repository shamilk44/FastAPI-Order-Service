import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';

const API_BASE = '/api';

const NAVIGATION = [
  { label: 'Overview', icon: '◫' },
  { label: 'Products', icon: '▦' },
  { label: 'Orders', icon: '▤' },
  { label: 'Inventory', icon: '▣' },
  { label: 'Reports', icon: '▥' },
];

const INITIAL_FORM = {
  name: '',
  sku: '',
  description: '',
  price: '',
  stock_quantity: '',
};

async function apiRequest(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  const responseText = await response.text();

  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }
  }

  if (!response.ok) {
    let message = 'Request failed: ' + response.status;

    if (data && typeof data === 'object') {
      if (Array.isArray(data.detail)) {
        message = data.detail
          .map((item) => item.msg || JSON.stringify(item))
          .join(', ');
      } else if (data.detail) {
        message = String(data.detail);
      } else if (data.message) {
        message = String(data.message);
      }
    } else if (typeof data === 'string' && data) {
      message = data;
    }

    throw new Error(message);
  }

  return data;
}

function getProductList(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && Array.isArray(data.items)) {
    return data.items;
  }

  if (data && Array.isArray(data.products)) {
    return data.products;
  }

  if (data && Array.isArray(data.results)) {
    return data.results;
  }

  return [];
}

function formatCurrency(value) {
  const amount = Number(value || 0);

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number.isFinite(amount) ? amount : 0);
}

function getStockStatus(product) {
  const quantity = Number(product.stock_quantity || 0);

  if (quantity <= 0) {
    return 'Out of Stock';
  }

  if (quantity <= 10) {
    return 'Low Stock';
  }

  return 'In Stock';
}

function getProductIcon(index) {
  const icons = ['⌨️', '🖥️', '🖱️', '🎧', '📱', '💻'];

  return icons[index % icons.length];
}

function App() {
  const [activePage, setActivePage] = useState('Overview');
  const [products, setProducts] = useState([]);
  const [report, setReport] = useState(null);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiStatus, setApiStatus] = useState('checking');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [orderProductId, setOrderProductId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState('1');
  const [orderResult, setOrderResult] = useState(null);

  const loadProducts = useCallback(async () => {
    const data = await apiRequest('/products/');
    setProducts(getProductList(data));
  }, []);

  const loadReport = useCallback(async () => {
    try {
      const data = await apiRequest('/reports/summary');
      setReport(data);
    } catch {
      // The dashboard remains usable if the report endpoint
      // returns a different response or is temporarily unavailable.
      setReport(null);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');

    try {
      await loadProducts();
      setApiStatus('connected');
      await loadReport();
    } catch (err) {
      setApiStatus('disconnected');
      setError(
        err.message +
          '. Check that FastAPI and PostgreSQL are running and the frontend proxy is configured.'
      );
    } finally {
      setLoading(false);
    }
  }, [loadProducts, loadReport]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return products;
    }

    return products.filter((product) => {
      const searchableText = [
        product.name,
        product.sku,
        product.description,
        product.id,
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [products, search]);

  const totalProducts = products.length;

  const totalUnits = products.reduce(
    (total, product) => total + Number(product.stock_quantity || 0),
    0
  );

  const lowStockCount = products.filter((product) => {
    const quantity = Number(product.stock_quantity || 0);
    return quantity > 0 && quantity <= 10;
  }).length;

  const outOfStockCount = products.filter(
    (product) => Number(product.stock_quantity || 0) <= 0
  ).length;

  const inventoryValue = products.reduce(
    (total, product) =>
      total +
      Number(product.price || 0) * Number(product.stock_quantity || 0),
    0
  );

  function openPage(page) {
    setActivePage(page);
    setSearch('');
    setError('');
    setNotice('');
  }

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleAddProduct(event) {
    event.preventDefault();

    setSaving(true);
    setError('');
    setNotice('');

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      stock_quantity: Number(form.stock_quantity),
      is_active: true,
    };

    if (!payload.name || !payload.sku) {
      setError('Product name and SKU are required.');
      setSaving(false);
      return;
    }

    if (
      !Number.isFinite(payload.price) ||
      payload.price < 0 ||
      !Number.isInteger(payload.stock_quantity) ||
      payload.stock_quantity < 0
    ) {
      setError('Enter a valid price and a non-negative whole stock quantity.');
      setSaving(false);
      return;
    }

    try {
      await apiRequest('/products/', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setForm(INITIAL_FORM);
      setShowAddForm(false);
      setNotice('Product created successfully in the database.');
      await loadProducts();
      await loadReport();
    } catch (err) {
      setError('Could not create product: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProduct(product) {
    const confirmed = window.confirm(
      'Delete "' + product.name + '"? This action cannot be undone.'
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setNotice('');

    try {
      await apiRequest('/products/' + product.id, {
        method: 'DELETE',
      });

      setNotice('Product deleted successfully.');
      await loadProducts();
      await loadReport();
    } catch (err) {
      setError('Could not delete product: ' + err.message);
    }
  }

  async function handleCreateOrder(event) {
    event.preventDefault();

    setError('');
    setNotice('');
    setOrderResult(null);

    if (!orderProductId) {
      setError('Please select a product.');
      return;
    }

    const quantity = Number(orderQuantity);

    if (!Number.isInteger(quantity) || quantity < 1) {
      setError('Order quantity must be a positive whole number.');
      return;
    }

    /*
      This payload assumes the backend OrderCreate schema accepts
      product_id and quantity. If your schema uses different field
      names, FastAPI will show a validation error below.
    */
    try {
      const data = await apiRequest('/orders/', {
        method: 'POST',
        body: JSON.stringify({
          product_id: Number(orderProductId),
          quantity,
        }),
      });

      setOrderResult(data);
      setNotice('Order request submitted successfully.');
      await loadProducts();
      await loadReport();
    } catch (err) {
      setError(
        'The order was not accepted by the API: ' +
          err.message +
          ' Check the OrderCreate schema at /docs.'
      );
    }
  }

  function exportProducts() {
    const headers = [
      'ID',
      'Name',
      'SKU',
      'Price',
      'Stock Quantity',
      'Active',
    ];

    const rows = products.map((product) => [
      product.id,
      product.name,
      product.sku,
      product.price,
      product.stock_quantity,
      product.is_active,
    ]);

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => '"' + String(value ?? '').replaceAll('"', '""') + '"')
          .join(',')
      )
      .join('\r\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = 'stockly-products.csv';
    link.click();

    URL.revokeObjectURL(url);
  }

  function renderProductTable(showActions = true) {
    if (filteredProducts.length === 0) {
      return (
        <div className="empty-state">
          {search
            ? 'No products match your search.'
            : 'No products found. Add your first product to get started.'}
        </div>
      );
    }

    return (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>PRODUCT</th>
              <th>SKU</th>
              <th>PRICE</th>
              <th>STOCK</th>
              <th>STATUS</th>
              {showActions && <th>ACTIONS</th>}
            </tr>
          </thead>

          <tbody>
            {filteredProducts.map((product, index) => {
              const status = getStockStatus(product);
              const statusClass = status.toLowerCase().replaceAll(' ', '-');

              return (
                <tr key={product.id}>
                  <td>
                    <div className="product-cell">
                      <span className="product-icon">
                        {getProductIcon(index)}
                      </span>

                      <div>
                        <strong>{product.name}</strong>
                        <small>ID: {product.id}</small>
                      </div>
                    </div>
                  </td>

                  <td>{product.sku || '—'}</td>

                  <td className="price">
                    {formatCurrency(product.price)}
                  </td>

                  <td>{Number(product.stock_quantity || 0)}</td>

                  <td>
                    <span className={'status ' + statusClass}>
                      <span className="status-dot" />
                      {status}
                    </span>
                  </td>

                  {showActions && (
                    <td>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => handleDeleteProduct(product)}
                        title="Delete product"
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  function renderOverview() {
    return (
      <>
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              Total Products
              <span className="stat-icon purple">▦</span>
            </div>
            <div className="stat-value">{totalProducts}</div>
            <div className="stat-foot">Products from your API</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              Total Stock Units
              <span className="stat-icon blue">▣</span>
            </div>
            <div className="stat-value">{totalUnits.toLocaleString()}</div>
            <div className="stat-foot">Combined available quantity</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              Inventory Value
              <span className="stat-icon green">$</span>
            </div>
            <div className="stat-value">
              {formatCurrency(inventoryValue)}
            </div>
            <div className="stat-foot">Price multiplied by stock</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              Low Stock Items
              <span className="stat-icon orange">⚠</span>
            </div>
            <div className="stat-value">{lowStockCount}</div>
            <div className="stat-foot">
              {outOfStockCount} products out of stock
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Recent Products</h2>
              <p>Products retrieved from your FastAPI backend.</p>
            </div>

            <button
              type="button"
              className="text-button"
              onClick={() => openPage('Products')}
            >
              View all products →
            </button>
          </div>

          {renderProductTable(false)}
        </section>

        <section className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <h2>Inventory Snapshot</h2>
              <p>Current stock levels calculated from your products.</p>
            </div>
          </div>

          <div className="snapshot-grid">
            <div className="snapshot-item">
              <span className="snapshot-dot in-stock-dot" />
              <div>
                <strong>In Stock</strong>
                <small>More than 10 units available</small>
              </div>
              <span className="snapshot-label green-label">
                {products.filter((p) => Number(p.stock_quantity) > 10).length}
              </span>
            </div>

            <div className="snapshot-item">
              <span className="snapshot-dot low-stock-dot" />
              <div>
                <strong>Low Stock</strong>
                <small>Between 1 and 10 units available</small>
              </div>
              <span className="snapshot-label orange-label">
                {lowStockCount}
              </span>
            </div>

            <div className="snapshot-item">
              <span className="snapshot-dot out-stock-dot" />
              <div>
                <strong>Out of Stock</strong>
                <small>No units currently available</small>
              </div>
              <span className="snapshot-label red-label">
                {outOfStockCount}
              </span>
            </div>
          </div>
        </section>
      </>
    );
  }

  function renderProducts() {
    return (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Product Catalogue</h2>
            <p>Create, search, and manage database products.</p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => setShowAddForm((current) => !current)}
          >
            {showAddForm ? '× Cancel' : '+ Add Product'}
          </button>
        </div>

        {showAddForm && (
          <form className="add-form" onSubmit={handleAddProduct}>
            <label>
              Product Name *
              <input
                name="name"
                value={form.name}
                onChange={updateForm}
                placeholder="Wireless Keyboard"
                required
              />
            </label>

            <label>
              SKU *
              <input
                name="sku"
                value={form.sku}
                onChange={updateForm}
                placeholder="KEY-001"
                required
              />
            </label>

            <label>
              Price *
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={updateForm}
                placeholder="99.99"
                required
              />
            </label>

            <label>
              Stock Quantity *
              <input
                name="stock_quantity"
                type="number"
                min="0"
                step="1"
                value={form.stock_quantity}
                onChange={updateForm}
                placeholder="25"
                required
              />
            </label>

            <label>
              Description
              <input
                name="description"
                value={form.description}
                onChange={updateForm}
                placeholder="Product description"
              />
            </label>

            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Product'}
            </button>
          </form>
        )}

        <div className="table-toolbar">
          <label className="search-box">
            <span>⌕</span>
            <input
              type="search"
              placeholder="Search name, SKU or ID..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <span className="muted">
            {filteredProducts.length} products
          </span>
        </div>

        {renderProductTable(true)}
      </section>
    );
  }

  function renderOrders() {
    return (
      <>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Create Order</h2>
              <p>Submit an order to your FastAPI order endpoint.</p>
            </div>
          </div>

          <form className="add-form" onSubmit={handleCreateOrder}>
            <label>
              Select Product *
              <select
                value={orderProductId}
                onChange={(event) => setOrderProductId(event.target.value)}
                required
              >
                <option value="">Choose a product</option>

                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — Stock: {product.stock_quantity}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Quantity *
              <input
                type="number"
                min="1"
                step="1"
                value={orderQuantity}
                onChange={(event) => setOrderQuantity(event.target.value)}
                required
              />
            </label>

            <button type="submit" className="primary-button">
              Submit Order
            </button>
          </form>

          {orderResult && (
            <div className="panel-heading">
              <div>
                <h2>Order API Response</h2>
                <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {JSON.stringify(orderResult, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Order API</h2>
              <p>
                Your current backend exposes order creation and lookup by ID.
                It does not expose a list-all-orders endpoint in the routes
                configured for this project.
              </p>
            </div>
          </div>

          <div className="add-form">
            <label>
              Look Up Order ID
              <input
                id="lookup-order-id"
                type="number"
                min="1"
                placeholder="Enter an order ID"
              />
            </label>

            <button
              type="button"
              className="primary-button"
              onClick={async () => {
                const input = document.getElementById('lookup-order-id');
                const id = input.value.trim();

                if (!id) {
                  setError('Enter an order ID first.');
                  return;
                }

                setError('');
                setNotice('');
                setOrderResult(null);

                try {
                  const data = await apiRequest('/orders/' + id);
                  setOrderResult(data);
                } catch (err) {
                  setError('Could not retrieve order: ' + err.message);
                }
              }}
            >
              Find Order
            </button>
          </div>
        </section>
      </>
    );
  }

  function renderInventory() {
    return (
      <>
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              Total Units
              <span className="stat-icon blue">▣</span>
            </div>
            <div className="stat-value">{totalUnits}</div>
            <div className="stat-foot">Across all products</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              In Stock
              <span className="stat-icon green">✓</span>
            </div>
            <div className="stat-value">
              {products.filter((p) => Number(p.stock_quantity) > 10).length}
            </div>
            <div className="stat-foot">Healthy stock levels</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              Low Stock
              <span className="stat-icon orange">⚠</span>
            </div>
            <div className="stat-value">{lowStockCount}</div>
            <div className="stat-foot">Restocking may be needed</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              Out of Stock
              <span className="stat-icon purple">!</span>
            </div>
            <div className="stat-value">{outOfStockCount}</div>
            <div className="stat-foot">No units available</div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Stock Management</h2>
              <p>Live stock quantities from the product API.</p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={loadDashboard}
            >
              ↻ Refresh
            </button>
          </div>

          {renderProductTable(false)}
        </section>
      </>
    );
  }

  function renderReports() {
    return (
      <>
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              Products
              <span className="stat-icon purple">▦</span>
            </div>
            <div className="stat-value">{totalProducts}</div>
            <div className="stat-foot">Current product count</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              Stock Units
              <span className="stat-icon blue">▣</span>
            </div>
            <div className="stat-value">{totalUnits}</div>
            <div className="stat-foot">Total recorded quantity</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              Inventory Value
              <span className="stat-icon green">$</span>
            </div>
            <div className="stat-value">
              {formatCurrency(inventoryValue)}
            </div>
            <div className="stat-foot">Calculated from product data</div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              Low Stock
              <span className="stat-icon orange">⚠</span>
            </div>
            <div className="stat-value">{lowStockCount}</div>
            <div className="stat-foot">Products needing attention</div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Backend Report Summary</h2>
              <p>Response from GET /reports/summary.</p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={loadReport}
            >
              ↻ Refresh Report
            </button>
          </div>

          <div style={{ padding: '0 22px 22px' }}>
            {report ? (
              <pre
                style={{
                  padding: '16px',
                  borderRadius: '8px',
                  background: '#f7f8fc',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  fontSize: '12px',
                }}
              >
                {JSON.stringify(report, null, 2)}
              </pre>
            ) : (
              <p className="muted">
                The report endpoint did not return data. The product-based
                statistics above are calculated from the live product API.
              </p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Export Products</h2>
              <p>Download the currently loaded products as a CSV file.</p>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={exportProducts}
            >
              ↓ Export CSV
            </button>
          </div>
        </section>
      </>
    );
  }

  function renderPage() {
    if (loading) {
      return (
        <section className="panel">
          <div className="empty-state">Connecting to your backend...</div>
        </section>
      );
    }

    switch (activePage) {
      case 'Products':
        return renderProducts();
      case 'Orders':
        return renderOrders();
      case 'Inventory':
        return renderInventory();
      case 'Reports':
        return renderReports();
      default:
        return renderOverview();
    }
  }

  const subtitle =
    activePage === 'Overview'
      ? 'Here is what is happening with your inventory today.'
      : 'Manage and review your ' +
        activePage.toLowerCase() +
        ' at a glance.';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <div>
            Stockly
            <small>INVENTORY MANAGEMENT</small>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="navigation">
          {NAVIGATION.map((item) => (
            <button
              type="button"
              key={item.label}
              className={
                'nav-item ' +
                (activePage === item.label ? 'active' : '')
              }
              onClick={() => openPage(item.label)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>

              {item.label === 'Products' && (
                <span className="nav-count">{totalProducts}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">✦</div>
            <strong>Need a hand?</strong>
            <p>Check your API documentation to explore available endpoints.</p>
            <button
              type="button"
              onClick={() => window.open('http://localhost:8000/docs', '_blank')}
            >
              Open API Docs →
            </button>
          </div>

          <div className="profile">
            <div className="profile-avatar">AD</div>
            <div className="profile-info">
              <strong>Administrator</strong>
              <small>Inventory Manager</small>
            </div>
            <span className="profile-menu">•••</span>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{activePage}</strong>
          </div>

          <div className="topbar-right">
            <div className="system-status">
              <span
                style={{
                  background:
                    apiStatus === 'connected'
                      ? '#26b87c'
                      : apiStatus === 'checking'
                        ? '#e6a23c'
                        : '#e05252',
                }}
              />
              {apiStatus === 'connected'
                ? 'API Connected'
                : apiStatus === 'checking'
                  ? 'Connecting...'
                  : 'API Disconnected'}
            </div>

            <button
              type="button"
              className="icon-button"
              title="Refresh data"
              onClick={loadDashboard}
            >
              ↻
            </button>

            <div className="top-avatar">AD</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow">INVENTORY WORKSPACE</div>
              <h1>{activePage}</h1>
              <p className="page-subtitle">{subtitle}</p>
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => window.print()}
            >
              ⇩ Print Page
            </button>
          </section>

          {error && (
            <div
              role="alert"
              style={{
                marginBottom: '18px',
                padding: '13px 16px',
                border: '1px solid #f3caca',
                borderRadius: '9px',
                background: '#fff1f1',
                color: '#a83232',
                fontSize: '12px',
                overflowWrap: 'anywhere',
              }}
            >
              <strong>Error:</strong> {error}
              <button
                type="button"
                onClick={() => setError('')}
                style={{
                  float: 'right',
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'inherit',
                }}
              >
                ✕
              </button>
            </div>
          )}

          {notice && (
            <div
              role="status"
              style={{
                marginBottom: '18px',
                padding: '13px 16px',
                border: '1px solid #c8eadb',
                borderRadius: '9px',
                background: '#effbf5',
                color: '#15734d',
                fontSize: '12px',
              }}
            >
              {notice}
            </div>
          )}

          {renderPage()}

          <footer className="footer">
            <span>© 2026 Stockly Inventory</span>
            <span>
              <span className="footer-dot" />
              {apiStatus === 'connected'
                ? 'Connected to FastAPI'
                : apiStatus === 'checking'
                  ? 'Checking API connection'
                  : 'Check your API connection'}
              <span className="footer-separator">·</span>
              PostgreSQL via backend
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;