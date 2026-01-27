import React, { useState, useEffect } from 'react';
import { getHandleStatus } from '../../services/adminService';
import '../../assets/styles/Products.scss';

const Products = () => {
    const [productsByStatus, setProductsByStatus] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [expandedStatus, setExpandedStatus] = useState({});
    const [statusFilter, setStatusFilter] = useState('all');
    const [filters, setFilters] = useState({ country: 'all', category: 'all' });
    const [filterOptions, setFilterOptions] = useState({ countries: [], categories: [] });

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await getHandleStatus();
            
            if (result && result.products) {
                setProductsByStatus(result.products);
            } else {
                console.warn('Products data structure unexpected:', result);
                setError('No products data available');
            }
        } catch (e) {
            console.error('Error fetching products:', e);
            const errorMessage = e.response?.data?.message || e.message || 'Failed to load products from server.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const toggleStatus = (status) => {
        setExpandedStatus(prev => ({
            ...prev,
            [status]: !prev[status]
        }));
    };

    const statusColors = {
        "Stars": "#28a745", "Hidden Gems": "#17a2b8", "Beloved but Underpriced": "#007bff",
        "New Opportunities": "#6f42c1", "Stars at Risk": "#ffc107", "Niche Traps": "#fd7e14",
        "Tourist Traps": "#dc3545", "Problem Areas": "#6c757d"
    };
    
    const lowFeaturesByStatus = {
        "Stars": [],
        "Hidden Gems": ["Popularity"],
        "Beloved but Underpriced": ["Profitability"],
        "New Opportunities": ["Popularity", "Profitability"],
        "Stars at Risk": ["Quality"],
        "Niche Traps": ["Popularity", "Quality"],
        "Tourist Traps": ["Profitability", "Quality"],
        "Problem Areas": ["Popularity", "Profitability", "Quality"]
    };

    const statusOrder = [
        "Stars", "Hidden Gems", "Beloved but Underpriced", "New Opportunities",
        "Stars at Risk", "Niche Traps", "Tourist Traps", "Problem Areas"
    ];

    useEffect(() => {
        const allProducts = Object.values(productsByStatus).flat();
        if (allProducts.length === 0) {
            setFilterOptions({ countries: [], categories: [] });
            return;
        }
        const countries = [...new Set(allProducts.map(p => p.country).filter(Boolean))].sort();
        const categories = [...new Set(allProducts.map(p => p.category).filter(Boolean))].sort();
        setFilterOptions({ countries, categories });
    }, [productsByStatus]);

    const visibleStatuses = statusFilter === 'all'
        ? statusOrder
        : statusOrder.filter(status => status === statusFilter);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    return (
        <div className="products-container">
            <div className="products-header">
                <div>
                    <h1>Products by Status</h1>
                    <p>View all location IDs organized by their analysis status</p>
                </div>
                <button
                    onClick={loadProducts}
                    disabled={loading}
                    className="refresh-btn"
                >
                    {loading ? 'Loading...' : '🔄 Refresh'}
                </button>
            </div>

            <div className="filter-bar">
                <div className="filter-group">
                    <label htmlFor="status-filter">Filter by Status</label>
                    <select
                        id="status-filter"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        {statusOrder.map(status => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-group">
                    <label htmlFor="country-filter">Country</label>
                    <select
                        id="country-filter"
                        name="country"
                        value={filters.country}
                        onChange={handleFilterChange}
                    >
                        <option value="all">All Countries</option>
                        {filterOptions.countries.map(country => (
                            <option key={country} value={country}>{country}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-group">
                    <label htmlFor="category-filter">Category</label>
                    <select
                        id="category-filter"
                        name="category"
                        value={filters.category}
                        onChange={handleFilterChange}
                    >
                        <option value="all">All Categories</option>
                        {filterOptions.categories.map(category => (
                            <option key={category} value={category}>{category}</option>
                        ))}
                    </select>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            {loading ? (
                <div className="loading-text">Loading products...</div>
            ) : (
                <div className="products-content">
                    {visibleStatuses.map(status => {
                        const products = (productsByStatus[status] || []).filter(product => {
                            const matchesCountry = filters.country === 'all' || product.country === filters.country;
                            const matchesCategory = filters.category === 'all' || product.category === filters.category;
                            return matchesCountry && matchesCategory;
                        });
                        const isExpanded = expandedStatus[status];
                        const color = statusColors[status] || '#ccc';

                        return (
                            <div key={status} className="status-section">
                                <div 
                                    className="status-header"
                                    style={{ borderTop: `4px solid ${color}` }}
                                    onClick={() => toggleStatus(status)}
                                >
                                    <div className="status-title-group">
                                        <h3 style={{ color: color }}>
                                            {status}
                                            {Array.isArray(lowFeaturesByStatus[status]) && lowFeaturesByStatus[status].length > 0 && (
                                                <span style={{ marginLeft: 8, color: '#6c757d', fontSize: '0.95rem', fontWeight: 500 }}>
                                                    - Low: {lowFeaturesByStatus[status].join(', ')}
                                                </span>
                                            )}
                                        </h3>
                                        <span className="product-count">
                                            {products.length} {products.length === 1 ? 'location' : 'locations'}
                                        </span>
                                    </div>
                                    <span className="expand-icon">
                                        {isExpanded ? '▼' : '▶'}
                                    </span>
                                </div>

                                {isExpanded && (
                                    <div className="products-list">
                                        {products.length === 0 ? (
                                            <div className="no-products">No locations in this category</div>
                                        ) : (
                                            <div className="products-grid">
                                                {products.map((product, index) => (
                                                    <div key={index} className="product-card">
                                                        <div className="product-location-id">
                                                            <strong>Location ID:</strong> {product.location_id}
                                                        </div>
                                                        <div className="product-metrics">
                                                            <div className="metric-item">
                                                                <span className="metric-label">Revenue:</span>
                                                                <span className="metric-value">
                                                                    ${product.revenue?.toLocaleString('en-US', { maximumFractionDigits: 2 }) || 'N/A'}
                                                                </span>
                                                            </div>
                                                            <div className="metric-item">
                                                                <span className="metric-label">Rating:</span>
                                                                <span className="metric-value">
                                                                    {product.rating?.toFixed(2) || 'N/A'}
                                                                </span>
                                                            </div>
                                                            <div className="metric-item">
                                                                <span className="metric-label">Visitors:</span>
                                                                <span className="metric-value">
                                                                    {product.visitors?.toLocaleString('en-US') || 'N/A'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Products;