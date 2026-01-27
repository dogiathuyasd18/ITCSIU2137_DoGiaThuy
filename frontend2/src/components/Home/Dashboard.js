import React, { useState, useEffect } from 'react';
import { getAnalysisStats, getAvailableYears, getHandleStatus, importTourismDataset, calculateElasticity } from '../../services/adminService';
import { formatVND } from '../../utils/currency';
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import '../../assets/styles/Dashboard.scss';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

// --- HELPER COMPONENT: STATUS GRID ---
const StatusGrid = ({ data }) => {
    if (!data) return <div className="no-data">No status data available</div>;

    const statusColors = {
        "Stars": "#27ae60", // Green
        "Hidden Gems": "#1abc9c", // Teal
        "Beloved but Underpriced": "#3498db", // Blue
        "New Opportunities": "#9b59b6", // Purple
        "Stars at Risk": "#f1c40f", // Yellow
        "Niche Traps": "#e67e22", // Orange
        "Tourist Traps": "#e74c3c", // Red
        "Problem Areas": "#95a5a6"  // Grey
    };

    const sortedData = Object.entries(data).sort(([, a], [, b]) => b - a);

    return (
        <div className="status-grid-container">
            {sortedData.map(([status, count]) => (
                <div className="matrix-card" key={status} style={{ borderLeft: `5px solid ${statusColors[status] || '#ccc'}` }}>
                    <div className="matrix-content">
                        <span className="matrix-count" style={{ color: statusColors[status] }}>{count}</span>
                        <span className="matrix-label">{status}</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- HELPER COMPONENT: KPI CARD ---
const KpiCard = ({ title, icon, sum, mean, type, color, showTotal = true }) => {
    const fmt = (val) => {
        if (val == null) return 'N/A';
        if (type === 'currency') return Number(val).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
        if (type === 'decimal') return Number(val).toFixed(2);
        return Number(val).toLocaleString('en-US');
    };

    const displayValue = showTotal ? sum : mean;
    const subtitle = showTotal ? 'Total' : 'Average';

    return (
        <div className="kpi-card" style={{ borderTop: `4px solid ${color}` }}>
            <div className="kpi-header">
                <div className="kpi-icon" style={{ backgroundColor: `${color}20`, color: color }}>{icon}</div>
                <div className="kpi-title">
                    <h3>{title}</h3>
                    <span className="kpi-value">{fmt(displayValue)}</span>
                    <span className="kpi-subtitle">{subtitle}</span>
                </div>
            </div>
            <div className="kpi-footer">
                <div className="kpi-comparison">
                    {showTotal ? (
                        <span>Average: <strong>{fmt(mean)}</strong></span>
                    ) : (
                        <span>Total: <strong>{fmt(sum)}</strong></span>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- MAIN DASHBOARD COMPONENT ---
const DashBoard = () => {
    const [stats, setStats] = useState({ revenue: {}, rating: {}, visitors: {} });
    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [importing, setImporting] = useState(false);
    const [importMsg, setImportMsg] = useState('');
    const [truncateBeforeImport, setTruncateBeforeImport] = useState(true);
    const [selectedYear, setSelectedYear] = useState(null);
    const [availableYears, setAvailableYears] = useState([]);
    const [predictions2026, setPredictions2026] = useState(null); // Predictions for 2026 based on 2025 data
    const [elasticityCalculating, setElasticityCalculating] = useState(false);
    const [elasticityResults, setElasticityResults] = useState(null);

    useEffect(() => {
        loadAvailableYears();
        loadData();
        loadPredictions2026();
        // Automatically calculate elasticity on dashboard load
        handleCalculateElasticity();
    }, []);

    useEffect(() => {
        loadData();
    }, [selectedYear]);

    const loadAvailableYears = async () => {
        try {
            const years = await getAvailableYears();
            setAvailableYears(years);
        } catch (e) {
            console.error('Error fetching available years:', e);
        }
    };

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [statsResult, statusResult] = await Promise.all([
                getAnalysisStats(selectedYear),
                getHandleStatus()
            ]);

            if (statsResult) setStats(statsResult);
            if (statusResult) setStatusData(statusResult.data || statusResult);

        } catch (e) {
            console.error('Error fetching data:', e);
            setError('Failed to load dashboard data.');
        } finally {
            setLoading(false);
        }
    };

    const loadPredictions2026 = async () => {
        try {
            // Fetch 2025 data to predict 2026
            const stats2025 = await getAnalysisStats(2025);
            if (stats2025 && stats2025.scenarioPredictions) {
                setPredictions2026(stats2025.scenarioPredictions);
            }
        } catch (e) {
            console.error('Error loading 2026 predictions:', e);
        }
    };

    const handleImportDataset = async () => {
        const ok = window.confirm(
            truncateBeforeImport
                ? 'This will DELETE and re-import tourism_data from tourism_dataset.csv. Continue?'
                : 'This will import tourism_dataset.csv and skip duplicate location IDs. Continue?'
        );
        if (!ok) return;

        setImporting(true);
        setImportMsg('');
        try {
            const res = await importTourismDataset({ truncate: truncateBeforeImport });
            if (res?.errCode === 0) {
                const d = res.data || {};
                setImportMsg(
                    `Imported ${d.inserted ?? 0} rows (processed ${d.processed ?? 0}). Total rows: ${d.afterCount ?? 'N/A'}.`
                );
                // Refresh dashboard numbers after import
                await loadData();
                // Automatically calculate elasticity after import
                await handleCalculateElasticity(false);
            } else {
                setImportMsg(res?.message || 'Import finished with an unexpected response.');
            }
        } catch (e) {
            setImportMsg(e?.message || 'Failed to import dataset.');
        } finally {
            setImporting(false);
        }
    };

    const handleCalculateElasticity = async (showMessage = true) => {
        setElasticityCalculating(true);
        if (showMessage) {
            setElasticityResults(null);
        }
        try {
            const res = await calculateElasticity();
            if (res?.errCode === 0) {
                setElasticityResults(res.results || []);
                if (showMessage) {
                    setImportMsg('Elasticity calculated and stored successfully!');
                }
            } else {
                if (showMessage) {
                    setImportMsg(res?.message || 'Failed to calculate elasticity.');
                }
            }
        } catch (e) {
            // Silently fail on auto-calculation, only show message if manually triggered
            if (showMessage) {
                setImportMsg(e?.message || 'Failed to calculate elasticity.');
            } else {
                console.log('Auto-elasticity calculation skipped (may need data):', e.message);
            }
        } finally {
            setElasticityCalculating(false);
        }
    };

    // --- UPDATED CHART CONFIGURATION (DUAL AXIS) ---
    const chartData = {
        labels: ['Metric Comparison'],
        datasets: [
            {
                label: 'Total Revenue',
                data: [stats.revenue?.sum || 0],
                backgroundColor: 'rgba(52, 152, 219, 0.7)', // Blue
                borderColor: 'rgba(52, 152, 219, 1)',
                borderWidth: 1,
                yAxisID: 'y', // Linked to Left Axis
                barPercentage: 0.6,
                categoryPercentage: 0.8
            },
            {
                label: 'Total Visitors',
                data: [stats.visitors?.sum || 0],
                backgroundColor: 'rgba(241, 196, 15, 0.7)', // Yellow
                borderColor: 'rgba(241, 196, 15, 1)',
                borderWidth: 1,
                yAxisID: 'y1', // Linked to Right Axis
                barPercentage: 0.6,
                categoryPercentage: 0.8
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: { position: 'top' },
            title: { 
                display: true, 
                text: 'Market Overview: Total Revenue vs. Total Visitors',
                padding: { bottom: 20 }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            // Custom formatting based on axis
                            if (context.dataset.yAxisID === 'y') {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                            } else {
                                label += context.parsed.y;
                            }
                        }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: {
                grid: { display: false } // Cleaner look
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: { display: true, text: 'Revenue ($)', color: '#2980b9' },
                ticks: { color: '#2980b9' },
                grid: { color: '#f0f0f0' } // Only show grid lines for the main axis
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: { display: true, text: 'Visitor Count', color: '#f39c12' },
                ticks: { color: '#f39c12' },
                grid: { drawOnChartArea: false } // Hides grid lines for this axis to prevent clutter
            },
        },
    };

    return (
        <div className="dashboard-container">
            {/* 1. Header Section */}
            <div className="dashboard-header">
                <div>
                    <h1>Dashboard {selectedYear && <span style={{ fontSize: '0.6em', color: '#7f8c8d', fontWeight: 'normal' }}>({selectedYear})</span>}</h1>
                    <p>Real-time analysis of Revenue, Quality, and Market Volume. {selectedYear && <span style={{ color: '#3498db' }}>Filtered by year {selectedYear}</span>}</p>
                </div>
                <div className="dashboard-actions">
                    {/* Year Filter */}
                    <div className="year-filter" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <label style={{ fontWeight: 600, fontSize: '0.9rem' }}>Filter by Year:</label>
                        <select
                            value={selectedYear || ''}
                            onChange={(e) => setSelectedYear(e.target.value ? parseInt(e.target.value, 10) : null)}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid #ddd',
                                background: '#fff',
                                color: '#333',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                minWidth: '120px'
                            }}
                        >
                            <option value="">All Years</option>
                            {availableYears.map(year => (
                                <option key={year} value={year}>
                                    {year}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {error && <div className="error-message">{error}</div>}
            {importMsg && <div className="info-message">{importMsg}</div>}
            
            {/* Elasticity Calculation Results */}
            {elasticityResults && elasticityResults.length > 0 && (
                <div style={{
                    margin: '1rem 0',
                    padding: '1.5rem',
                    background: '#fff',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                }}>
                    <h3 style={{ marginTop: 0, color: '#2c3e50' }}>📊 Elasticity Calculation Results</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                        {elasticityResults.map((result, idx) => (
                            <div key={idx} style={{
                                padding: '1rem',
                                background: '#f8f9fa',
                                borderRadius: '8px',
                                border: '1px solid #dee2e6'
                            }}>
                                <h4 style={{ margin: '0 0 0.5rem 0', color: '#3498db' }}>
                                    {result.from} → {result.to}
                                </h4>
                                {result.elasticity !== null ? (
                                    <div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#2c3e50', marginBottom: '0.5rem' }}>
                                            {Number(result.elasticity).toFixed(4)}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                                            <strong>Interpretation:</strong> {Math.abs(result.elasticity) > 1 ? 'Elastic' : Math.abs(result.elasticity) === 1 ? 'Unit Elastic' : 'Inelastic'} demand
                                        </div>
                                        {result.visitorsFrom && result.visitorsTo && (
                                            <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                                Visitors: {result.visitorsFrom.toLocaleString()} → {result.visitorsTo.toLocaleString()}
                                                <br />
                                                Price: {result.priceFrom} → {result.priceTo} (per visitor)
                                                <br />
                                                ΔVisitors: {result.percentChangeVisitors}%
                                                <br />
                                                ΔPrice: {result.percentChangePrice}%
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div style={{ color: '#888', fontStyle: 'italic' }}>
                                        {result.message || 'Could not calculate'}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#e3f2fd', borderRadius: '6px', fontSize: '0.85rem', color: '#1565c0' }}>
                        <strong>Note:</strong> Elasticity values have been saved to the database in the target year (e.g., 2023→2024 elasticity saved in 2024 row).
                        <br />
                        <strong>Formula:</strong> Elasticity = (% Change in Visitors) / (% Change in Average Price per Visitor)
                    </div>
                </div>
            )}

            {loading ? (
                <div className="loading-state">Loading intelligence data...</div>
            ) : (
                <div className="dashboard-content">
                    
                    {/* 1. KPI Ribbon */}
                    <div className="kpi-ribbon">
                        <KpiCard 
                            title="Total Revenue" 
                            icon="💰" 
                            sum={stats.revenue?.sum} 
                            mean={stats.revenue?.mean} 
                            type="currency"
                            color="#3498db"
                        />
                        <KpiCard 
                            title="Average Rating" 
                            icon="⭐" 
                            sum={stats.rating?.sum} 
                            mean={stats.rating?.mean} 
                            type="decimal"
                            color="#2ecc71"
                            showTotal={false}
                        />
                        <KpiCard 
                            title="Total Visitors" 
                            icon="👥" 
                            sum={stats.visitors?.sum} 
                            mean={stats.visitors?.mean} 
                            type="number"
                            color="#f1c40f"
                        />
                    </div>

                    {/* 3. Main Chart Section */}
                    <div className="chart-section-wrapper">
                        <div className="chart-card">
                            <Bar options={chartOptions} data={chartData} />
                        </div>
                    </div>

                    {/* 4. Strategic Matrix */}
                    <div className="matrix-section">
                        <div className="section-title">
                            <h3>Strategic Portfolio Matrix</h3>
                            <p>Distribution of locations based on Profitability, Popularity, and Quality benchmarks.</p>
                        </div>
                        <StatusGrid data={statusData} />
                    </div>

                    {/* 5. Revenue Predictions (Scenario Analysis) for 2026 */}
                    {predictions2026 && (
                        <div className="scenario-section" style={{
                            background: '#fff',
                            padding: '2rem',
                            borderRadius: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            marginTop: '2rem'
                        }}>
                            <div className="section-title">
                                <h3>🔮 Revenue Predictions (Scenario Analysis)</h3>
                                <p>
                                    Revenue projections for 2026 based on 2025 data from tourism_data table
                                    {predictions2026.count && ` (${predictions2026.count} locations)`}
                                </p>
                            </div>
                            
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                                gap: '20px',
                                marginTop: '1.5rem'
                            }}>
                                {/* Pessimistic Scenario */}
                                <div style={{
                                    background: 'linear-gradient(135deg, #fee 0%, #fdd 100%)',
                                    padding: '24px',
                                    borderRadius: '12px',
                                    border: '2px solid #e74c3c',
                                    boxShadow: '0 4px 8px rgba(231, 76, 60, 0.15)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '2rem', marginRight: '12px' }}>🔻</span>
                                        <h4 style={{ margin: 0, color: '#c0392b', fontSize: '1.1rem' }}>Pessimistic Scenario</h4>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px' }}>
                                        Worst-case revenue prediction
                                    </div>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#c0392b', marginBottom: '8px' }}>
                                        {predictions2026.pessimistic !== null && predictions2026.pessimistic !== undefined ? 
                                            formatVND(predictions2026.pessimistic) : 
                                            'N/A'
                                        }
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#999' }}>
                                        From database (pessimistic column) - 2025 data predicts 2026
                                    </div>
                                </div>

                                {/* Average Scenario */}
                                <div style={{
                                    background: 'linear-gradient(135deg, #fff9e6 0%, #ffeaa7 100%)',
                                    padding: '24px',
                                    borderRadius: '12px',
                                    border: '2px solid #f39c12',
                                    boxShadow: '0 4px 8px rgba(243, 156, 18, 0.15)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '2rem', marginRight: '12px' }}>📊</span>
                                        <h4 style={{ margin: 0, color: '#d68910', fontSize: '1.1rem' }}>Average Scenario</h4>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px' }}>
                                        Most likely revenue prediction
                                    </div>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#d68910', marginBottom: '8px' }}>
                                        {predictions2026.average !== null && predictions2026.average !== undefined ? 
                                            formatVND(predictions2026.average) : 
                                            'N/A'
                                        }
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#999' }}>
                                        From database (average column) - 2025 data predicts 2026
                                    </div>
                                </div>

                                {/* Optimistic Scenario */}
                                <div style={{
                                    background: 'linear-gradient(135deg, #eafaf1 0%, #d5f4e6 100%)',
                                    padding: '24px',
                                    borderRadius: '12px',
                                    border: '2px solid #27ae60',
                                    boxShadow: '0 4px 8px rgba(39, 174, 96, 0.15)'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '2rem', marginRight: '12px' }}>🔺</span>
                                        <h4 style={{ margin: 0, color: '#229954', fontSize: '1.1rem' }}>Optimistic Scenario</h4>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '8px' }}>
                                        Best-case revenue prediction
                                    </div>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#229954', marginBottom: '8px' }}>
                                        {predictions2026.optimistic !== null && predictions2026.optimistic !== undefined ? 
                                            formatVND(predictions2026.optimistic) : 
                                            'N/A'
                                        }
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: '#999' }}>
                                        From database (optimistic column) - 2025 data predicts 2026
                                    </div>
                                </div>
                            </div>

                            <div style={{ 
                                marginTop: '20px', 
                                padding: '15px', 
                                background: '#f8f9fa', 
                                borderRadius: '8px', 
                                fontSize: '0.9rem', 
                                color: '#666',
                                borderLeft: '4px solid #3498db'
                            }}>
                                <strong>📈 Scenario Analysis Explanation:</strong>
                                <ul style={{ margin: '10px 0 0 20px', padding: 0, lineHeight: '1.8' }}>
                                    <li><strong>Pessimistic:</strong> Average pessimistic revenue per location from tourism_data table. Represents worst-case scenario for risk planning.</li>
                                    <li><strong>Average:</strong> Average revenue per location from tourism_data table. Represents the most likely scenario (baseline forecast).</li>
                                    <li><strong>Optimistic:</strong> Average optimistic revenue per location from tourism_data table. Represents best-case scenario for potential upside.</li>
                                </ul>
                                <div style={{ marginTop: '12px', padding: '10px', background: '#fff', borderRadius: '6px', fontSize: '0.85rem' }}>
                                    <strong>Data Source:</strong> Values are averaged from pessimistic, average, and optimistic columns in the tourism_data table for year 2025 (per location), used to predict revenue per location for 2026.
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            )}
            
            <style>{`
                .dashboard-container { padding: 2rem; background-color: #f8f9fa; min-height: 100vh; font-family: 'Segoe UI', sans-serif; }
                .dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
                .dashboard-header h1 { margin: 0; color: #2c3e50; font-size: 1.8rem; }
                .dashboard-header p { margin: 5px 0 0; color: #7f8c8d; }
                
                .refresh-btn { background: #fff; border: 1px solid #ddd; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
                .refresh-btn:hover { background: #f1f1f1; border-color: #bbb; }

                .kpi-ribbon { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
                .kpi-card { background: #fff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 6px rgba(0,0,0,0.04); display: flex; flex-direction: column; justify-content: space-between; }
                .kpi-header { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1rem; }
                .kpi-icon { width: 45px; height: 45px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
                .kpi-title h3 { margin: 0; font-size: 0.9rem; color: #7f8c8d; text-transform: uppercase; letter-spacing: 0.5px; }
                .kpi-value { display: block; font-size: 1.8rem; font-weight: 700; color: #2c3e50; margin-top: 5px; }
                .kpi-subtitle { font-size: 0.8rem; color: #95a5a6; }
                .kpi-footer { border-top: 1px solid #eee; padding-top: 0.8rem; font-size: 0.85rem; color: #7f8c8d; }
                .kpi-comparison { display: flex; justify-content: space-between; align-items: center; }
                .skew-badge { padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; }
                .skew-pos { background: #e8f8f5; color: #16a085; }
                .skew-neg { background: #fef9e7; color: #f39c12; }

                .chart-section-wrapper { background: #fff; padding: 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 2rem; height: 450px; }
                .chart-card { height: 100%; width: 100%; }

                .matrix-section { background: #fff; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
                .section-title { margin-bottom: 1.5rem; text-align: center; }
                .section-title h3 { margin: 0; color: #2c3e50; }
                .section-title p { color: #95a5a6; margin-top: 5px; }
                
                .status-grid-container { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1rem; }
                .matrix-card { background: #f8f9fa; padding: 1rem; border-radius: 8px; transition: transform 0.2s; }
                .matrix-card:hover { transform: translateY(-2px); background: #f1f3f5; }
                .matrix-content { display: flex; flex-direction: column; align-items: flex-start; }
                .matrix-count { font-size: 1.5rem; font-weight: 700; }
                .matrix-label { font-size: 0.9rem; color: #555; margin-top: 4px; }
                
                @media (max-width: 1200px) {
                    .status-grid-container { grid-template-columns: repeat(4, minmax(0, 1fr)); }
                }
                @media (max-width: 992px) {
                    .status-grid-container { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                }
                @media (max-width: 576px) {
                    .status-grid-container { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default DashBoard;