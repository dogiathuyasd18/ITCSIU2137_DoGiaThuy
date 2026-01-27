import React, { useState, useEffect } from 'react';
import { getAllUsers } from '../../services/adminService';
import '../../assets/styles/Users.scss';

const Users = () => {
    // This holds ALL users from the API, organized by status
    const [usersByStatus, setUsersByStatus] = useState({});
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [expandedStatus, setExpandedStatus] = useState({});
    const [statusFilter, setStatusFilter] = useState('all');
    const [metricFilters, setMetricFilters] = useState({
        price: 'all',
        quantity: 'all',
        revenue: 'all'
    });
    const [metricThresholds, setMetricThresholds] = useState({
        price: 0,
        quantity: 0,
        revenue: 0
    });

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await getAllUsers();
            console.log('Users result:', result);
            
            // The backend now returns { data: statusCounts, users: statusUsers }
            if (result && result.users) {
                const allRevenues = [];
                const allQuantities = [];
                const allPrices = [];

                const enhancedUsers = {};

                Object.entries(result.users).forEach(([status, users]) => {
                    enhancedUsers[status] = (users || []).map(user => {
                        const revenue = Number(user.revenue) || 0;
                        const quantity = Number(user.quantity) || 0;
                        const price = quantity > 0 ? revenue / quantity : 0;

                        if (revenue > 0) allRevenues.push(revenue);
                        if (quantity > 0) allQuantities.push(quantity);
                        if (price > 0) allPrices.push(price);

                        return {
                            ...user,
                            revenue,
                            quantity,
                            price
                        };
                    });
                });

                setUsersByStatus(enhancedUsers);
                setMetricThresholds({
                    price: computeMedian(allPrices),
                    quantity: computeMedian(allQuantities),
                    revenue: computeMedian(allRevenues)
                });
            } else {
                console.warn('Users data structure unexpected:', result);
                setError('No users data available. Expected structure: { data: {...}, users: {...} }');
            }
        } catch (e) {
            console.error('Error fetching users:', e);
            const errorMessage = e.response?.data?.message || e.message || 'Failed to load users from server.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const computeMedian = (arr = []) => {
        if (!arr || arr.length === 0) return 0;
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    };

    const handleMetricFilterChange = (e) => {
        const { name, value } = e.target;
        setMetricFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const passesMetricFilter = (value, filter, threshold) => {
        if (filter === 'all' || threshold === 0) return true;
        if (filter === 'low') {
            return value <= threshold;
        }
        return value > threshold;
    };

    const toggleStatus = (status) => {
        setExpandedStatus(prev => ({
            ...prev,
            [status]: !prev[status]
        }));
    };

    // Define colors for statuses (matching Products)
    const statusColors = {
        "Stars": "#28a745", "Hidden Gems": "#17a2b8", "Beloved but Underpriced": "#007bff",
        "New Opportunities": "#6f42c1", "Stars at Risk": "#ffc107", "Niche Traps": "#fd7e14",
        "Tourist Traps": "#dc3545", "Problem Areas": "#6c757d"
    };
    
    // Map each status to which features are LOW for that category
    // Features: Popularity (quantity), Profitability (revenue), Quality (rating)
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

    const visibleStatuses = statusFilter === 'all'
        ? statusOrder
        : statusOrder.filter(status => status === statusFilter);

    return (
        <div className="users-container">
            <div className="users-header">
                <div>
                    <h1>Users by Status</h1>
                    <p>View all users organized by their analysis status</p>
                </div>
                <button
                    onClick={loadUsers}
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
                    <label htmlFor="price-filter">Price</label>
                    <select
                        id="price-filter"
                        name="price"
                        value={metricFilters.price}
                        onChange={handleMetricFilterChange}
                    >
                        <option value="all">All</option>
                        <option value="low">Low (≤ {metricThresholds.price.toFixed(2)})</option>
                        <option value="high">High (&gt; {metricThresholds.price.toFixed(2)})</option>
                    </select>
                </div>
                <div className="filter-group">
                    <label htmlFor="quantity-filter">Quantity</label>
                    <select
                        id="quantity-filter"
                        name="quantity"
                        value={metricFilters.quantity}
                        onChange={handleMetricFilterChange}
                    >
                        <option value="all">All</option>
                        <option value="low">Low (≤ {metricThresholds.quantity.toLocaleString('en-US')})</option>
                        <option value="high">High (&gt; {metricThresholds.quantity.toLocaleString('en-US')})</option>
                    </select>
                </div>
                <div className="filter-group">
                    <label htmlFor="revenue-filter">Revenue</label>
                    <select
                        id="revenue-filter"
                        name="revenue"
                        value={metricFilters.revenue}
                        onChange={handleMetricFilterChange}
                    >
                        <option value="all">All</option>
                        <option value="low">Low (≤ ${metricThresholds.revenue.toLocaleString('en-US', { maximumFractionDigits: 2 })})</option>
                        <option value="high">High (&gt; ${metricThresholds.revenue.toLocaleString('en-US', { maximumFractionDigits: 2 })})</option>
                    </select>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            {loading ? (
                <div className="loading-text">Loading users...</div>
            ) : (
                <div className="users-content">
                    {visibleStatuses.map(status => {
                        const users = (usersByStatus[status] || []).filter(user => {
                            const price = user.price || 0;
                            const quantity = user.quantity || 0;
                            const revenue = user.revenue || 0;

                            return (
                                passesMetricFilter(price, metricFilters.price, metricThresholds.price) &&
                                passesMetricFilter(quantity, metricFilters.quantity, metricThresholds.quantity) &&
                                passesMetricFilter(revenue, metricFilters.revenue, metricThresholds.revenue)
                            );
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
                                        <span className="user-count">
                                            {users.length} {users.length === 1 ? 'user' : 'users'}
                                        </span>
                                    </div>
                                    <span className="expand-icon">
                                        {isExpanded ? '▼' : '▶'}
                                    </span>
                                </div>

                                {isExpanded && (
                                    <div className="users-list">
                                        {users.length === 0 ? (
                                            <div className="no-users">No users in this category</div>
                                        ) : (
                                            <div className="users-grid">
                                                {users.map((user, index) => (
                                                    <div key={user.id || index} className="user-card">
                                                        <div className="user-info">
                                                            <div className="user-name">
                                                                <strong>Name:</strong> {user.name || 'N/A'}
                                                            </div>
                                                        </div>
                                                        <div className="user-metrics">
                                                            <div className="metric-item">
                                                                <span className="metric-label">Revenue:</span>
                                                                <span className="metric-value">
                                                                    ${(user.revenue || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                            <div className="metric-item">
                                                                <span className="metric-label">Rating:</span>
                                                                <span className="metric-value">
                                                                    {(user.rating || 0).toFixed(2)}
                                                                </span>
                                                            </div>
                                                            <div className="metric-item">
                                                                <span className="metric-label">Quantity:</span>
                                                                <span className="metric-value">
                                                                    {(user.quantity || 0).toLocaleString('en-US')}
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

export default Users;

