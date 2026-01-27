import React, { useState, useEffect } from 'react';
import { getCrossTab, getHandleStatus, getOrderSchedules, getAnalysisStats, getAvailableYears, getPriceOptimizationSuggestions } from '../../services/adminService';
import { formatVND } from '../../utils/currency';
import { Bar, Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import '../../assets/styles/Analytics.scss';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend
);

const Analytics = () => {
    const [analyticsData, setAnalyticsData] = useState({
        categoryReport: [],
        countryReport: [],
        priceReport: []
    });
    const [statusData, setStatusData] = useState({
        statistics: null,
        revenueAnalysis: null,
        conclusions: null,
        products: null
    });
    const [orderSchedules, setOrderSchedules] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('category');
    const [availableYears, setAvailableYears] = useState([]);
    const [yearComparison, setYearComparison] = useState({
        year1: null,
        year2: null
    });
    const [yearComparisonData, setYearComparisonData] = useState(null);
    const [selectedPredictionYear, setSelectedPredictionYear] = useState(null); // Single year to show predictions for (like Dashboard)
    const [predictionDataMap, setPredictionDataMap] = useState(new Map()); // Map of year -> prediction stats
    const [metricCorrelationScope, setMetricCorrelationScope] = useState('category'); // category | country
    const [metricCorrelationMethod, setMetricCorrelationMethod] = useState('pearson'); // pearson | spearman
    const [priceOptimizationData, setPriceOptimizationData] = useState(null);
    const [loadingOptimization, setLoadingOptimization] = useState(false);

    useEffect(() => {
        loadAnalytics();
        loadStatusData();
        loadOrderSchedules();
        loadAvailableYears();
    }, []);

    useEffect(() => {
        if (yearComparison.year1 && yearComparison.year2) {
            loadYearComparison();
            // Auto-set prediction year: Year 2 (latest year) by default
            setSelectedPredictionYear(yearComparison.year2);
        } else {
            setYearComparisonData(null);
            setSelectedPredictionYear(null);
            setPredictionDataMap(new Map());
        }
    }, [yearComparison.year1, yearComparison.year2]);

    useEffect(() => {
        if (selectedPredictionYear) {
            loadPredictionData();
        } else {
            setPredictionDataMap(new Map());
        }
    }, [selectedPredictionYear]);

    const loadAvailableYears = async () => {
        try {
            const years = await getAvailableYears();
            setAvailableYears(years || []);
            // Auto-select: Year 2 = latest year, Year 1 = previous year
            // Years are returned in descending order (latest first) from backend
            if (years && years.length >= 2) {
                // years[0] = latest year, years[1] = previous year
                setYearComparison({
                    year1: years[1], // Previous year (second in descending order)
                    year2: years[0]  // Latest year (first in descending order)
                });
            } else if (years && years.length === 1) {
                // Only one year available, set it as Year 2
                setYearComparison({
                    year1: null,
                    year2: years[0] // Latest (and only) year
                });
            }
        } catch (e) {
            console.error('Error fetching available years:', e);
        }
    };

    const loadYearComparison = async () => {
        try {
            const [stats1, stats2] = await Promise.all([
                getAnalysisStats(yearComparison.year1),
                getAnalysisStats(yearComparison.year2)
            ]);

            if (stats1 && stats2) {
                setYearComparisonData({
                    year1: {
                        year: yearComparison.year1,
                        stats: stats1
                    },
                    year2: {
                        year: yearComparison.year2,
                        stats: stats2
                    }
                });
            }
        } catch (e) {
            console.error('Error loading year comparison:', e);
            setYearComparisonData(null);
        }
    };

    const loadPredictionData = async () => {
        try {
            if (!selectedPredictionYear) return;
            
            const stats = await getAnalysisStats(selectedPredictionYear);
            const newMap = new Map();
            
            if (stats && stats.scenarioPredictions) {
                newMap.set(selectedPredictionYear, stats);
            }

            setPredictionDataMap(newMap);
        } catch (e) {
            console.error('Error loading prediction data:', e);
            setPredictionDataMap(new Map());
        }
    };

    const loadPriceOptimization = async (year = null) => {
        setLoadingOptimization(true);
        try {
            const data = await getPriceOptimizationSuggestions(year);
            setPriceOptimizationData(data);
        } catch (e) {
            console.error('Error loading price optimization:', e);
            setPriceOptimizationData(null);
        } finally {
            setLoadingOptimization(false);
        }
    };

    const loadOrderSchedules = async () => {
        try {
            const result = await getOrderSchedules();
            if (result && Array.isArray(result)) {
                setOrderSchedules(result);
            }
        } catch (e) {
            console.error('Error fetching order schedules:', e);
            // Don't set error state for order schedules, as it's supplementary
        }
    };

    const loadAnalytics = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await getCrossTab();
            
            if (result) {
                setAnalyticsData({
                    categoryReport: result.categoryReport || [],
                    countryReport: result.countryReport || [],
                    priceReport: result.priceReport || []
                });
            } else {
                console.warn('Analytics data structure unexpected:', result);
                setError('No analytics data available');
            }
        } catch (e) {
            console.error('Error fetching analytics:', e);
            const errorMessage = e.response?.data?.message || e.message || 'Failed to load analytics from server.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const loadStatusData = async () => {
        try {
            const result = await getHandleStatus();
            if (result) {
                setStatusData({
                    statistics: result.statistics || null,
                    revenueAnalysis: result.revenueAnalysis || null,
                    conclusions: result.conclusions || null,
                    // Row-level data (locations) grouped by status; used for per-component correlations
                    products: result.products || null
                });
            }
        } catch (e) {
            console.error('Error fetching status data:', e);
            // Don't set error state for status data, as it's supplementary
        }
    };

    const formatCurrency = (value) => {
        // Use VND formatting instead of USD
        return formatVND(value);
    };

    const formatNumber = (value) => {
        return new Intl.NumberFormat('en-US').format(value);
    };

    // --- Correlation helpers (Pearson + Spearman) ---
    const toFiniteNumber = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };

    const pearsonCorrelation = (xs, ys) => {
        const paired = [];
        for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
            const x = toFiniteNumber(xs[i]);
            const y = toFiniteNumber(ys[i]);
            if (x === null || y === null) continue;
            paired.push([x, y]);
        }
        const n = paired.length;
        // Allow n=2 so small categories (e.g., only 2 locations) don't show N/A.
        // Note: correlation with n=2 is not very reliable (often becomes ±1).
        if (n < 2) return null;

        const meanX = paired.reduce((s, [x]) => s + x, 0) / n;
        const meanY = paired.reduce((s, [, y]) => s + y, 0) / n;

        let num = 0;
        let sumSqX = 0;
        let sumSqY = 0;
        for (const [x, y] of paired) {
            const dx = x - meanX;
            const dy = y - meanY;
            num += dx * dy;
            sumSqX += dx * dx;
            sumSqY += dy * dy;
        }
        const den = Math.sqrt(sumSqX * sumSqY);
        return den === 0 ? null : num / den;
    };

    const rankArray = (arr) => {
        // Returns average ranks for ties (1..n)
        const items = arr.map((v, i) => ({ v, i }));
        items.sort((a, b) => a.v - b.v);

        const ranks = new Array(arr.length);
        let idx = 0;
        while (idx < items.length) {
            let j = idx;
            while (j + 1 < items.length && items[j + 1].v === items[idx].v) j++;

            // average rank for ties (1-based ranks)
            const avgRank = (idx + j) / 2 + 1;
            for (let k = idx; k <= j; k++) {
                ranks[items[k].i] = avgRank;
            }
            idx = j + 1;
        }
        return ranks;
    };

    const spearmanCorrelation = (xs, ys) => {
        const pairedX = [];
        const pairedY = [];
        for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
            const x = toFiniteNumber(xs[i]);
            const y = toFiniteNumber(ys[i]);
            if (x === null || y === null) continue;
            pairedX.push(x);
            pairedY.push(y);
        }
        if (pairedX.length < 2) return null;
        const rx = rankArray(pairedX);
        const ry = rankArray(pairedY);
        return pearsonCorrelation(rx, ry);
    };

    const interpretPearson = (r) => {
        if (r === null || r === undefined || Number.isNaN(Number(r))) {
            return { strength: 'N/A', direction: 'N/A', note: 'Not enough data' };
        }
        const v = Number(r);
        const abs = Math.abs(v);
        const direction = v > 0 ? 'Positive' : v < 0 ? 'Negative' : 'Neutral';
        let strength = 'Weak';
        if (abs >= 0.7) strength = 'Strong';
        else if (abs >= 0.3) strength = 'Moderate';
        return { strength, direction, note: `${strength} ${direction.toLowerCase()} relationship` };
    };

    const flattenStatusRows = () => {
        const rows = [];
        if (!statusData?.products) return rows;
        Object.values(statusData.products).forEach((group) => {
            if (!Array.isArray(group)) return;
            group.forEach((row) => rows.push(row));
        });
        return rows;
    };

    // Generate colors for charts
    const generateColors = (count) => {
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
            '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384',
            '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'
        ];
        return colors.slice(0, count);
    };

    // Prepare chart data for country revenue
    const prepareCountryChartData = () => {
        if (!statusData.revenueAnalysis || !statusData.revenueAnalysis.byCountry) {
            return null;
        }

        const data = statusData.revenueAnalysis.byCountry;
        return {
            labels: data.map(item => item.country),
            datasets: [{
                label: 'Revenue Percentage',
                data: data.map(item => typeof item.percentage === 'number' ? item.percentage : parseFloat(item.percentage)),
                backgroundColor: generateColors(data.length),
                borderColor: '#fff',
                borderWidth: 2
            }]
        };
    };

    // Prepare chart data for category revenue
    const prepareCategoryChartData = () => {
        if (!statusData.revenueAnalysis || !statusData.revenueAnalysis.byCategory) {
            return null;
        }

        const data = statusData.revenueAnalysis.byCategory;
        return {
            labels: data.map(item => item.category),
            datasets: [{
                label: 'Revenue Percentage',
                data: data.map(item => typeof item.percentage === 'number' ? item.percentage : parseFloat(item.percentage)),
                backgroundColor: generateColors(data.length),
                borderColor: '#fff',
                borderWidth: 2
            }]
        };
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const label = context.label || '';
                        const value = context.parsed.y || 0;
                        return `${label}: ${value.toFixed(2)}%`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return value + '%';
                    }
                },
                title: {
                    display: true,
                    text: 'Revenue Percentage (%)'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Country'
                }
            }
        }
    };

    const categoryChartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const label = context.label || '';
                        const value = context.parsed.y || 0;
                        return `${label}: ${value.toFixed(2)}%`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return value + '%';
                    }
                },
                title: {
                    display: true,
                    text: 'Revenue Percentage (%)'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Category'
                }
            }
        }
    };

    // Generate distribution data for skewness visualization
    const generateSkewnessDistribution = (stats, metricName) => {
        if (!stats || stats.mean === null || stats.standardDeviation === null || stats.standardDeviation === 0) {
            return null;
        }

        const mean = stats.mean;
        const stdDev = stats.standardDeviation;
        const skewness = stats.skewness || 0;
        const median = stats.median || mean;
        const mode = stats.mode || mean;

        // Generate x values (data points)
        const numPoints = 100;
        const range = stdDev * 4; // Show 4 standard deviations on each side
        // Start from 0 (or mean - range if mean is very small) to avoid negative values
        const minX = Math.max(0, mean - range);
        const maxX = mean + range;
        const step = (maxX - minX) / numPoints;
        
        const labels = [];
        const distributionData = [];
        const meanData = [];
        const medianData = [];
        const modeData = [];

        for (let i = 0; i <= numPoints; i++) {
            const x = minX + i * step;
            labels.push(x.toFixed(2));
            
            // Generate skewed normal distribution
            // Using a transformation based on skewness
            const z = (x - mean) / stdDev;
            let adjustedZ = z;
            
            // Apply skewness transformation
            if (skewness !== 0) {
                // Use Johnson SU transformation approximation
                const skewFactor = skewness / 2;
                adjustedZ = z - skewFactor * (z * z - 1);
            }
            
            // Calculate probability density (normal distribution with skewness adjustment)
            const pdf = Math.exp(-0.5 * adjustedZ * adjustedZ) / (stdDev * Math.sqrt(2 * Math.PI));
            
            // Scale for visualization
            const scaledPdf = pdf * 1000; // Scale factor for better visualization
            distributionData.push(scaledPdf);
            
            // Mark positions of mean, median, mode
            const tolerance = step;
            meanData.push(Math.abs(x - mean) < tolerance ? scaledPdf * 1.1 : null);
            medianData.push(Math.abs(x - median) < tolerance ? scaledPdf * 1.1 : null);
            modeData.push(Math.abs(x - mode) < tolerance ? scaledPdf * 1.1 : null);
        }

        return {
            labels,
            datasets: [
                {
                    label: 'Distribution',
                    data: distributionData,
                    borderColor: '#36A2EB',
                    backgroundColor: 'rgba(54, 162, 235, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                },
                {
                    label: 'Mean',
                    data: meanData,
                    borderColor: '#FF6384',
                    backgroundColor: '#FF6384',
                    borderWidth: 3,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    showLine: false
                },
                {
                    label: 'Median',
                    data: medianData,
                    borderColor: '#FFCE56',
                    backgroundColor: '#FFCE56',
                    borderWidth: 3,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    showLine: false
                },
                {
                    label: 'Mode',
                    data: modeData,
                    borderColor: '#4BC0C0',
                    backgroundColor: '#4BC0C0',
                    borderWidth: 3,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    showLine: false
                }
            ]
        };
    };

    const skewnessChartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                display: true,
                position: 'top'
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        if (context.datasetIndex === 0) {
                            return `Frequency: ${context.parsed.y.toFixed(2)}`;
                        }
                        return context.dataset.label;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Frequency'
                }
            },
            x: {
                beginAtZero: true,
                min: 0,
                title: {
                    display: true,
                    text: 'Value'
                }
            }
        }
    };

    // Calculate conclusions for Category and Country reports
    const calculateConclusions = (report) => {
        if (!report || report.length === 0) return null;

        // Calculate medians
        const revenues = report.map(r => r.totalRevenue).filter(v => v !== null);
        const visitors = report.map(r => r.totalVisitors).filter(v => v !== null);
        const ratings = report.map(r => r.avgRating || 0).filter(v => v !== null);

        const getMedian = (arr) => {
            if (arr.length === 0) return 0;
            const sorted = [...arr].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        };

        const medRevenue = getMedian(revenues);
        const medVisitors = getMedian(visitors);
        const medRating = getMedian(ratings);

        // Find items based on conditions
        const highestRevenue = report.reduce((max, item) => 
            item.totalRevenue > max.totalRevenue ? item : max, report[0]);
        
        const mostPopular = report.reduce((max, item) => 
            item.totalVisitors > max.totalVisitors ? item : max, report[0]);
        
        const mostPleasure = report.reduce((max, item) => 
            (item.avgRating || 0) > (max.avgRating || 0) ? item : max, report[0]);

        const needImprovePrice = report.filter(item => 
            item.totalRevenue < medRevenue && 
            item.totalVisitors > medVisitors && 
            (item.avgRating || 0) > medRating
        );

        const needImproveMarketing = report.filter(item => 
            item.totalVisitors < medVisitors && 
            item.totalRevenue > medRevenue && 
            (item.avgRating || 0) > medRating
        );

        const needImproveQuality = report.filter(item => 
            (item.avgRating || 0) < medRating && 
            item.totalRevenue > medRevenue && 
            item.totalVisitors > medVisitors
        );

        return {
            medians: { medRevenue, medVisitors, medRating },
            highestRevenue,
            mostPopular,
            mostPleasure,
            needImprovePrice,
            needImproveMarketing,
            needImproveQuality
        };
    };

    const categoryConclusions = calculateConclusions(analyticsData.categoryReport);
    const countryConclusions = calculateConclusions(analyticsData.countryReport);

    // Process order schedule data for bar chart
    const processOrderScheduleData = (schedules) => {
        if (!schedules || schedules.length === 0) return null;

        // Group schedules by product name or SKU
        const scheduleMap = {};
        
        schedules.forEach(schedule => {
            const key = schedule.name || schedule.sku || 'Unknown Product';
            if (!scheduleMap[key]) {
                scheduleMap[key] = {
                    name: key,
                    sku: schedule.sku || 'N/A',
                    count: 0,
                    schedules: []
                };
            }
            scheduleMap[key].count++;
            scheduleMap[key].schedules.push({
                startDate: schedule.start_date,
                endDate: schedule.end_date
            });
        });

        // Convert to array and sort by count
        const scheduleData = Object.values(scheduleMap).sort((a, b) => b.count - a.count);

        return {
            labels: scheduleData.map(item => item.name),
            data: scheduleData.map(item => item.count),
            fullData: scheduleData
        };
    };

    const orderScheduleChartData = processOrderScheduleData(orderSchedules);

    // Chart options for order schedules
    const orderScheduleChartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: true,
                text: 'Orders by Product Schedule',
                padding: { bottom: 20 },
                font: {
                    size: 18,
                    weight: 'bold'
                }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `Schedules: ${context.parsed.y}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    stepSize: 1
                },
                title: {
                    display: true,
                    text: 'Number of Schedules'
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Product Name'
                },
                ticks: {
                    maxRotation: 45,
                    minRotation: 45
                }
            }
        }
    };

    // Calculate price analysis conclusions
    const calculatePriceConclusions = (priceReport) => {
        if (!priceReport || priceReport.length === 0) return null;

        // Calculate total revenue across all price segments
        const totalRevenue = priceReport.reduce((sum, segment) => sum + segment.totalRevenue, 0);

        // Calculate percentile rank and categorize each segment
        const segmentsWithRank = priceReport.map(segment => {
            const percentileRank = totalRevenue > 0 ? (segment.totalRevenue / totalRevenue) * 100 : 0;
            
            let category = '';
            if (percentileRank >= 90) {
                category = 'superior';
            } else if (percentileRank >= 70) {
                category = 'high';
            } else if (percentileRank >= 40) {
                category = 'average';
            } else {
                category = 'low';
            }

            return {
                ...segment,
                percentileRank,
                category
            };
        });

        // Group by category
        const superior = segmentsWithRank.filter(s => s.category === 'superior');
        const high = segmentsWithRank.filter(s => s.category === 'high');
        const average = segmentsWithRank.filter(s => s.category === 'average');
        const low = segmentsWithRank.filter(s => s.category === 'low');

        return {
            totalRevenue,
            segments: segmentsWithRank,
            superior,
            high,
            average,
            low
        };
    };

    const priceConclusions = calculatePriceConclusions(analyticsData.priceReport);

    // Calculate conclusions between two chosen factors
    const calculateFactorComparison = (factor1, factor2) => {
        if (!analyticsData[`${factor1}Report`] || !analyticsData[`${factor2}Report`]) {
            return null;
        }

        const report1 = analyticsData[`${factor1}Report`];
        const report2 = analyticsData[`${factor2}Report`];

        if (!report1.length || !report2.length) {
            return null;
        }

        // Calculate medians for both factors
        const getMedian = (arr, key) => {
            const values = arr.map(r => r[key]).filter(v => v !== null && v !== undefined);
            if (values.length === 0) return 0;
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
        };

        const medRevenue1 = getMedian(report1, 'totalRevenue');
        const medVisitors1 = getMedian(report1, 'totalVisitors');
        const medRating1 = getMedian(report1, 'avgRating');
        const medRevenue2 = getMedian(report2, 'totalRevenue');
        const medVisitors2 = getMedian(report2, 'totalVisitors');
        const medRating2 = getMedian(report2, 'avgRating');

        // Find top performers in each factor
        const topRevenue1 = report1.reduce((max, item) => 
            item.totalRevenue > max.totalRevenue ? item : max, report1[0]);
        const topVisitors1 = report1.reduce((max, item) => 
            item.totalVisitors > max.totalVisitors ? item : max, report1[0]);
        const topRating1 = report1.reduce((max, item) => 
            (item.avgRating || 0) > (max.avgRating || 0) ? item : max, report1[0]);

        const topRevenue2 = report2.reduce((max, item) => 
            item.totalRevenue > max.totalRevenue ? item : max, report2[0]);
        const topVisitors2 = report2.reduce((max, item) => 
            item.totalVisitors > max.totalVisitors ? item : max, report2[0]);
        const topRating2 = report2.reduce((max, item) => 
            (item.avgRating || 0) > (max.avgRating || 0) ? item : max, report2[0]);

        // Calculate distribution similarity (comparing patterns, not true correlation)
        const calculateDistributionSimilarity = (arr1, arr2, key) => {
            const values1 = arr1.map(r => r[key]).filter(v => v !== null && v !== undefined);
            const values2 = arr2.map(r => r[key]).filter(v => v !== null && v !== undefined);
            
            if (values1.length === 0 || values2.length === 0) return null;
            
            // Normalize values to 0-1 range for comparison
            const max1 = Math.max(...values1);
            const max2 = Math.max(...values2);
            const maxOverall = Math.max(max1, max2);
            
            if (maxOverall === 0) return null;
            
            const normalized1 = values1.map(v => v / maxOverall);
            const normalized2 = values2.map(v => v / maxOverall);
            
            // Calculate coefficient of variation similarity
            const mean1 = normalized1.reduce((a, b) => a + b, 0) / normalized1.length;
            const mean2 = normalized2.reduce((a, b) => a + b, 0) / normalized2.length;
            
            const std1 = Math.sqrt(normalized1.reduce((sum, v) => sum + Math.pow(v - mean1, 2), 0) / normalized1.length);
            const std2 = Math.sqrt(normalized2.reduce((sum, v) => sum + Math.pow(v - mean2, 2), 0) / normalized2.length);
            
            const cv1 = mean1 === 0 ? 0 : std1 / mean1;
            const cv2 = mean2 === 0 ? 0 : std2 / mean2;
            
            // Similarity based on how close the coefficients of variation are
            // Returns a value between -1 and 1, where 1 means very similar distribution patterns
            const cvDiff = Math.abs(cv1 - cv2);
            const similarity = 1 - Math.min(cvDiff, 1);
            
            // Adjust sign based on whether both are high or low variance
            return (cv1 + cv2) / 2 > 0.5 ? similarity : -similarity;
        };

        const revenueCorrelation = calculateDistributionSimilarity(report1, report2, 'totalRevenue');
        const visitorsCorrelation = calculateDistributionSimilarity(report1, report2, 'totalVisitors');
        const ratingCorrelation = calculateDistributionSimilarity(report1, report2, 'avgRating');

        // Performance comparison
        const totalRevenue1 = report1.reduce((sum, item) => sum + (item.totalRevenue || 0), 0);
        const totalRevenue2 = report2.reduce((sum, item) => sum + (item.totalRevenue || 0), 0);
        const totalVisitors1 = report1.reduce((sum, item) => sum + (item.totalVisitors || 0), 0);
        const totalVisitors2 = report2.reduce((sum, item) => sum + (item.totalVisitors || 0), 0);

        return {
            factor1: {
                name: factor1,
                topRevenue: topRevenue1,
                topVisitors: topVisitors1,
                topRating: topRating1,
                medRevenue: medRevenue1,
                medVisitors: medVisitors1,
                medRating: medRating1,
                totalRevenue: totalRevenue1,
                totalVisitors: totalVisitors1,
                count: report1.length
            },
            factor2: {
                name: factor2,
                topRevenue: topRevenue2,
                topVisitors: topVisitors2,
                topRating: topRating2,
                medRevenue: medRevenue2,
                medVisitors: medVisitors2,
                medRating: medRating2,
                totalRevenue: totalRevenue2,
                totalVisitors: totalVisitors2,
                count: report2.length
            },
            correlations: {
                revenue: revenueCorrelation,
                visitors: visitorsCorrelation,
                rating: ratingCorrelation
            },
            insights: {
                revenueDominance: totalRevenue1 > totalRevenue2 ? factor1 : factor2,
                visitorsDominance: totalVisitors1 > totalVisitors2 ? factor1 : factor2,
                revenueRatio: totalRevenue2 > 0 ? (totalRevenue1 / totalRevenue2).toFixed(2) : 'N/A',
                visitorsRatio: totalVisitors2 > 0 ? (totalVisitors1 / totalVisitors2).toFixed(2) : 'N/A'
            }
        };
    };

    // Factor comparison removed - now using year comparison instead
    // const factorComparisonData = calculateFactorComparison(
    //     factorComparison.factor1, 
    //     factorComparison.factor2
    // );

    const renderPriceConclusions = (conclusions) => {
        if (!conclusions) return null;

        // Only show categories that have segments
        const categoriesToShow = [];
        
        if (conclusions.superior.length > 0) {
            categoriesToShow.push({
                type: 'superior',
                title: '⭐ Superior (≥90%)',
                segments: conclusions.superior,
                detail: 'Revenue contribution ≥ 90% of total',
                className: 'highlight'
            });
        }
        
        if (conclusions.high.length > 0) {
            categoriesToShow.push({
                type: 'high',
                title: '📈 High (70-89%)',
                segments: conclusions.high,
                detail: 'Revenue contribution 70-89% of total',
                style: { background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white', borderLeftColor: '#4facfe' }
            });
        }
        
        if (conclusions.average.length > 0) {
            categoriesToShow.push({
                type: 'average',
                title: '📊 Average (40-69%)',
                segments: conclusions.average,
                detail: 'Revenue contribution 40-69% of total',
                style: { 
                    background: '#1565C0', // dark blue
                    borderLeftColor: '#0D47A1',
                    color: '#FFFFFF' // ensures text visible
                }
            });            
        }
        
        if (conclusions.low.length > 0) {
            categoriesToShow.push({
                type: 'low',
                title: '⚠️ Low (<40%)',
                segments: conclusions.low,
                detail: 'Revenue contribution < 40% of total',
                className: 'warning'
            });
        }

        if (categoriesToShow.length === 0) return null;

        return (
            <div className="conclusions-section">
                <h3>Price Analysis Conclusions</h3>
                <div className="conclusions-grid">
                    {categoriesToShow.map((category, idx) => (
                        <div 
                            key={idx} 
                            className={`conclusion-card ${category.className || ''}`}
                            style={category.style}
                        >
                            <div className="conclusion-title">{category.title}</div>
                            <div className="conclusion-value">
                                <ul>
                                    {category.segments.map((segment, segIdx) => (
                                        <li key={segIdx}>
                                            {segment.title}: {segment.percentileRank.toFixed(2)}%
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div className="conclusion-detail">
                                {category.detail}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderConclusions = (conclusions, type) => {
        if (!conclusions) return null;

        return (
            <div className="conclusions-section">
                <h3>Key Insights & Conclusions</h3>
                {/* Force a balanced 3 + 3 layout for the 6 insight cards */}
                <div
                    className="conclusions-grid"
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: '1rem'
                    }}
                >
                    <div className="conclusion-card highlight">
                        <div className="conclusion-title">🏆 Highest Revenue</div>
                        <div className="conclusion-value">{conclusions.highestRevenue?.name || 'N/A'}</div>
                        <div className="conclusion-detail">
                            {conclusions.highestRevenue && formatCurrency(conclusions.highestRevenue.totalRevenue)}
                        </div>
                    </div>

                    <div className="conclusion-card highlight">
                        <div className="conclusion-title">👥 Most Popularity</div>
                        <div className="conclusion-value">{conclusions.mostPopular?.name || 'N/A'}</div>
                        <div className="conclusion-detail">
                            {conclusions.mostPopular && formatNumber(conclusions.mostPopular.totalVisitors)} visitors
                        </div>
                    </div>

                    <div className="conclusion-card highlight">
                        <div className="conclusion-title">⭐ Most Pleasure</div>
                        <div className="conclusion-value">{conclusions.mostPleasure?.name || 'N/A'}</div>
                        <div className="conclusion-detail">
                            {conclusions.mostPleasure && (conclusions.mostPleasure.avgRating?.toFixed(2) || 'N/A')} rating
                        </div>
                    </div>

                    <div className="conclusion-card warning">
                        <div className="conclusion-title">💰 Need Improve Price</div>
                        <div className="conclusion-value">
                            {conclusions.needImprovePrice.length > 0 ? (
                                <ul>
                                    {conclusions.needImprovePrice.map((item, idx) => (
                                        <li key={idx}>{item.name}</li>
                                    ))}
                                </ul>
                            ) : 'None'}
                        </div>
                        {/* <div className="conclusion-detail">
                            Revenue &lt; Median, but Quantity & Rating &gt; Median
                        </div> */}
                    </div>

                    <div className="conclusion-card warning">
                        <div className="conclusion-title">📢 Need Improve Marketing</div>
                        <div className="conclusion-value">
                            {conclusions.needImproveMarketing.length > 0 ? (
                                <ul>
                                    {conclusions.needImproveMarketing.map((item, idx) => (
                                        <li key={idx}>{item.name}</li>
                                    ))}
                                </ul>
                            ) : 'None'}
                        </div>
                        {/* <div className="conclusion-detail">
                            Popularity &lt; Median, but Revenue & Rating &gt; Median
                        </div> */}
                    </div>

                    <div className="conclusion-card warning">
                        <div className="conclusion-title">✨ Need Improve Quality</div>
                        <div className="conclusion-value">
                            {conclusions.needImproveQuality.length > 0 ? (
                                <ul>
                                    {conclusions.needImproveQuality.map((item, idx) => (
                                        <li key={idx}>{item.name}</li>
                                    ))}
                                </ul>
                            ) : 'None'}
                        </div>
                        {/* <div className="conclusion-detail">
                            Rating &lt; Median, but Revenue & Quantity &gt; Median
                        </div> */}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="analytics-container">
            <div className="analytics-header">
                <div>
                    <h1>Analytics - Cross Tabulation</h1>
                    <p>Detailed analysis of relationships between categories, countries, and pricing</p>
                </div>
                <button
                    onClick={loadAnalytics}
                    disabled={loading}
                    className="refresh-btn"
                >
                    {loading ? 'Loading...' : '🔄 Refresh'}
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            {loading ? (
                <div className="loading-text">Loading analytics...</div>
            ) : (
                <div className="analytics-content">
                    {/* Tab Navigation */}
                    <div className="tabs">
                        <button
                            className={`tab ${activeTab === 'category' ? 'active' : ''}`}
                            onClick={() => setActiveTab('category')}
                        >
                            Category Analysis
                        </button>
                        <button
                            className={`tab ${activeTab === 'country' ? 'active' : ''}`}
                            onClick={() => setActiveTab('country')}
                        >
                            Country Analysis
                        </button>
                        <button
                            className={`tab ${activeTab === 'price' ? 'active' : ''}`}
                            onClick={() => setActiveTab('price')}
                        >
                            Price Analysis
                        </button>
                        <button
                            className={`tab ${activeTab === 'skewness' ? 'active' : ''}`}
                            onClick={() => setActiveTab('skewness')}
                        >
                            Skewness Analysis
                        </button>
                        <button
                            className={`tab ${activeTab === 'comparison' ? 'active' : ''}`}
                            onClick={() => setActiveTab('comparison')}
                        >
                            Revenue Comparison
                        </button>
                        <button
                            className={`tab ${activeTab === 'methods' ? 'active' : ''}`}
                            onClick={() => setActiveTab('methods')}
                        >
                            Methods
                        </button>
                        <button
                            className={`tab ${activeTab === 'schedules' ? 'active' : ''}`}
                            onClick={() => setActiveTab('schedules')}
                        >
                            Order Schedules
                        </button>
                    </div>

                    {/* Category Report */}
                    {activeTab === 'category' && (
                        <div className="report-section">
                            <h2>Category Performance</h2>
                            <div className="table-container">
                                <table className="analytics-table">
                                    <thead>
                                        <tr>
                                            <th>Category</th>
                                            <th>Total Revenue</th>
                                            <th>Total Visitors</th>
                                            <th>Avg Rating</th>
                                            <th>Avg ARPV</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analyticsData.categoryReport.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="no-data">No category data available</td>
                                            </tr>
                                        ) : (
                                            analyticsData.categoryReport.map((item, index) => (
                                                <tr key={index}>
                                                    <td><strong>{item.name || 'N/A'}</strong></td>
                                                    <td>{formatCurrency(item.totalRevenue)}</td>
                                                    <td>{formatNumber(item.totalVisitors)}</td>
                                                    <td>{item.avgRating?.toFixed(2) || 'N/A'}</td>
                                                    <td>{formatCurrency(item.avgArpv)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {renderConclusions(categoryConclusions, 'category')}
                        </div>
                    )}

                    {/* Country Report */}
                    {activeTab === 'country' && (
                        <div className="report-section">
                            <h2>Country Performance</h2>
                            <div className="table-container">
                                <table className="analytics-table">
                                    <thead>
                                        <tr>
                                            <th>Country</th>
                                            <th>Total Revenue</th>
                                            <th>Total Visitors</th>
                                            <th>Avg Rating</th>
                                            <th>Avg ARPV</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analyticsData.countryReport.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="no-data">No country data available</td>
                                            </tr>
                                        ) : (
                                            analyticsData.countryReport.map((item, index) => (
                                                <tr key={index}>
                                                    <td><strong>{item.name || 'N/A'}</strong></td>
                                                    <td>{formatCurrency(item.totalRevenue)}</td>
                                                    <td>{formatNumber(item.totalVisitors)}</td>
                                                    <td>{item.avgRating?.toFixed(2) || 'N/A'}</td>
                                                    <td>{formatCurrency(item.avgArpv)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {renderConclusions(countryConclusions, 'country')}
                        </div>
                    )}

                    {/* Price Report */}
                    {activeTab === 'price' && (
                        <div className="report-section">
                            <h2>Price (ARPV) Analysis</h2>
                            <div className="table-container">
                                <table className="analytics-table">
                                    <thead>
                                        <tr>
                                            <th>Price Segment</th>
                                            <th>Total Revenue</th>
                                            <th>Total Visitors</th>
                                            <th>Count</th>
                                            <th>Avg Revenue</th>
                                            <th>Avg Visitors</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {analyticsData.priceReport.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="no-data">No price data available</td>
                                            </tr>
                                        ) : (
                                            analyticsData.priceReport.map((item, index) => (
                                                <tr key={index}>
                                                    <td><strong>{item.title || 'N/A'}</strong></td>
                                                    <td>{formatCurrency(item.totalRevenue)}</td>
                                                    <td>{formatNumber(item.totalVisitors)}</td>
                                                    <td>{formatNumber(item.count)}</td>
                                                    <td>{formatCurrency(item.avgRevenue)}</td>
                                                    <td>{formatNumber(item.avgVisitors)}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Price Percentage Chart */}
                            {priceConclusions && priceConclusions.segments && priceConclusions.segments.length > 0 && (
                                <div style={{ 
                                    marginTop: '2rem', 
                                    marginBottom: '2rem', 
                                    padding: '1.5rem', 
                                    backgroundColor: '#fff', 
                                    borderRadius: '12px', 
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                    minHeight: '550px'
                                }}>
                                    <h3 style={{ marginBottom: '1rem', color: '#333', fontSize: '1.25rem', fontWeight: '600' }}>Revenue Distribution by Price Segment</h3>
                                    <p style={{ marginBottom: '1.5rem', color: '#666', fontSize: '0.95rem' }}>
                                        Percentage of total revenue contributed by each price segment.
                                    </p>
                                    <div style={{ height: '420px', width: '100%' }}>
                                    <Bar 
                                        data={{
                                            labels: priceConclusions.segments.map(segment => segment.title || 'N/A'),
                                            datasets: [{
                                                label: 'Revenue Percentage (%)',
                                                data: priceConclusions.segments.map(segment => segment.percentileRank),
                                                backgroundColor: priceConclusions.segments.map(segment => {
                                                    if (segment.category === 'superior') return 'rgba(40, 167, 69, 0.7)'; // Green
                                                    if (segment.category === 'high') return 'rgba(0, 123, 255, 0.7)'; // Blue
                                                    if (segment.category === 'average') return 'rgba(255, 193, 7, 0.7)'; // Yellow
                                                    return 'rgba(220, 53, 69, 0.7)'; // Red for low
                                                }),
                                                borderColor: priceConclusions.segments.map(segment => {
                                                    if (segment.category === 'superior') return 'rgba(40, 167, 69, 1)';
                                                    if (segment.category === 'high') return 'rgba(0, 123, 255, 1)';
                                                    if (segment.category === 'average') return 'rgba(255, 193, 7, 1)';
                                                    return 'rgba(220, 53, 69, 1)';
                                                }),
                                                borderWidth: 1
                                            }]
                                        }} 
                                        options={{
                                            responsive: true,
                                                maintainAspectRatio: false,
                                                layout: {
                                                    padding: {
                                                        top: 10,
                                                        bottom: 20,
                                                        left: 10,
                                                        right: 10
                                                    }
                                                },
                                            plugins: {
                                                legend: {
                                                    display: false
                                                },
                                                title: {
                                                    display: false
                                                },
                                                tooltip: {
                                                    callbacks: {
                                                        label: function(context) {
                                                            const segment = priceConclusions.segments[context.dataIndex];
                                                            return [
                                                                `Revenue: ${formatCurrency(segment.totalRevenue)}`,
                                                                `Percentage: ${segment.percentileRank.toFixed(2)}%`,
                                                                `Category: ${segment.category.charAt(0).toUpperCase() + segment.category.slice(1)}`
                                                            ];
                                                        }
                                                        },
                                                        padding: 10
                                                }
                                            },
                                            scales: {
                                                y: {
                                                    beginAtZero: true,
                                                    max: 100,
                                                    ticks: {
                                                        callback: function(value) {
                                                            return value + '%';
                                                            },
                                                            padding: 8
                                                    },
                                                    title: {
                                                        display: true,
                                                            text: 'Revenue Percentage (%)',
                                                            padding: {
                                                                bottom: 10
                                                            }
                                                    }
                                                },
                                                x: {
                                                    title: {
                                                        display: true,
                                                            text: 'Price Segment',
                                                            padding: {
                                                                top: 10
                                                            }
                                                    },
                                                    ticks: {
                                                        maxRotation: 0,
                                                            minRotation: 0,
                                                            padding: 10
                                                    }
                                                }
                                            }
                                        }} 
                                    />
                                    </div>
                                </div>
                            )}

                            {renderPriceConclusions(priceConclusions)}
                        </div>
                    )}

                    {/* Skewness Analysis */}
                    {activeTab === 'skewness' && (
                        <div className="report-section">
                            <h2>Skewness Distribution Analysis</h2>
                            <p className="analysis-description">
                                Skewness measures the asymmetry of a distribution. 
                                <strong> Positive skewness</strong> (right-skewed) means the tail extends to the right (Mean &gt; Median &gt; Mode).
                                <strong> Negative skewness</strong> (left-skewed) means the tail extends to the left (Mean &lt; Median &lt; Mode).
                                <strong> Zero skewness</strong> indicates a symmetric distribution.
                            </p>
                            
                            {statusData.statistics && (
                                <div className="skewness-results">
                                    {/* Revenue Skewness */}
                                    {statusData.statistics.revenue && generateSkewnessDistribution(statusData.statistics.revenue, 'revenue') && (
                                        <div style={{ marginBottom: '3rem', padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                            <h3 style={{ marginBottom: '1rem', color: '#333' }}>Revenue Distribution</h3>
                                            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                                                    <div>
                                                        <strong>Skewness:</strong> 
                                                        <span style={{
                                                            color: Math.abs(statusData.statistics.revenue.skewness || 0) < 0.5 ? '#28a745' : 
                                                                   Math.abs(statusData.statistics.revenue.skewness || 0) < 1 ? '#ffc107' : '#dc3545',
                                                            marginLeft: '0.5rem',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {statusData.statistics.revenue.skewness?.toFixed(3) || 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div><strong>Mean:</strong> {formatCurrency(statusData.statistics.revenue.mean)}</div>
                                                    <div><strong>Median:</strong> {formatCurrency(statusData.statistics.revenue.median)}</div>
                                                    <div><strong>Mode:</strong> {formatCurrency(statusData.statistics.revenue.mode)}</div>
                                                </div>
                                            </div>
                                            <div style={{ height: '400px' }}>
                                                <Line 
                                                    data={generateSkewnessDistribution(statusData.statistics.revenue, 'revenue')} 
                                                    options={skewnessChartOptions} 
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Rating Skewness */}
                                    {statusData.statistics.rating && generateSkewnessDistribution(statusData.statistics.rating, 'rating') && (
                                        <div style={{ marginBottom: '3rem', padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                            <h3 style={{ marginBottom: '1rem', color: '#333' }}>Rating Distribution</h3>
                                            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                                                    <div>
                                                        <strong>Skewness:</strong> 
                                                        <span style={{
                                                            color: Math.abs(statusData.statistics.rating.skewness || 0) < 0.5 ? '#28a745' : 
                                                                   Math.abs(statusData.statistics.rating.skewness || 0) < 1 ? '#ffc107' : '#dc3545',
                                                            marginLeft: '0.5rem',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {statusData.statistics.rating.skewness?.toFixed(3) || 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div><strong>Mean:</strong> {statusData.statistics.rating.mean?.toFixed(2) || 'N/A'}</div>
                                                    <div><strong>Median:</strong> {statusData.statistics.rating.median?.toFixed(2) || 'N/A'}</div>
                                                    <div><strong>Mode:</strong> {statusData.statistics.rating.mode?.toFixed(2) || 'N/A'}</div>
                                                    </div>
                                            </div>
                                            <div style={{ height: '400px' }}>
                                                <Line 
                                                    data={generateSkewnessDistribution(statusData.statistics.rating, 'rating')} 
                                                    options={skewnessChartOptions} 
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Visitors Skewness */}
                                    {statusData.statistics.visitors && generateSkewnessDistribution(statusData.statistics.visitors, 'visitors') && (
                                        <div style={{ marginBottom: '3rem', padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                            <h3 style={{ marginBottom: '1rem', color: '#333' }}>Visitors Distribution</h3>
                                            <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                                                    <div>
                                                        <strong>Skewness:</strong> 
                                                        <span style={{
                                                            color: Math.abs(statusData.statistics.visitors.skewness || 0) < 0.5 ? '#28a745' : 
                                                                   Math.abs(statusData.statistics.visitors.skewness || 0) < 1 ? '#ffc107' : '#dc3545',
                                                            marginLeft: '0.5rem',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {statusData.statistics.visitors.skewness?.toFixed(3) || 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div><strong>Mean:</strong> {formatNumber(statusData.statistics.visitors.mean)}</div>
                                                    <div><strong>Median:</strong> {formatNumber(statusData.statistics.visitors.median)}</div>
                                                    <div><strong>Mode:</strong> {formatNumber(statusData.statistics.visitors.mode)}</div>
                                                    </div>
                                            </div>
                                            <div style={{ height: '400px' }}>
                                                <Line 
                                                    data={generateSkewnessDistribution(statusData.statistics.visitors, 'visitors')} 
                                                    options={skewnessChartOptions} 
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {(!statusData.statistics || (!statusData.statistics.revenue && !statusData.statistics.rating && !statusData.statistics.visitors)) && (
                                        <div className="no-data">Loading skewness analysis...</div>
                                    )}
                                                        </div>
                                                    )}
                                                </div>
                    )}

                    {/* Revenue Comparison */}
                    {activeTab === 'comparison' && (
                        <div className="report-section">
                            <h2>Revenue Comparison Analysis</h2>
                            <p className="analysis-description" style={{ marginBottom: '2rem' }}>
                                Compare revenue metrics between two years to understand trends and performance changes.
                            </p>

                            {/* Year Selection */}
                            <div style={{ 
                                marginBottom: '2rem', 
                                padding: '1.5rem', 
                                backgroundColor: '#f8f9fa', 
                                borderRadius: '12px',
                                display: 'flex',
                                gap: '2rem',
                                alignItems: 'center',
                                flexWrap: 'wrap'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <label style={{ fontWeight: 'bold' }}>Year 1:</label>
                                    <select
                                        value={yearComparison.year1 || ''}
                                        onChange={(e) => {
                                            const newValue = e.target.value ? parseInt(e.target.value, 10) : null;
                                            if (newValue !== yearComparison.year2) {
                                                setYearComparison({ ...yearComparison, year1: newValue });
                                            } else {
                                                // Swap years if trying to select the same one
                                                setYearComparison({ 
                                                    year1: newValue, 
                                                    year2: yearComparison.year1 
                                                });
                                            }
                                        }}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            borderRadius: '8px',
                                            border: '1px solid #ddd',
                                            fontSize: '1rem',
                                            minWidth: '120px'
                                        }}
                                    >
                                        <option value="">Select Year</option>
                                        {availableYears.map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ fontSize: '1.5rem', color: '#666' }}>vs</div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <label style={{ fontWeight: 'bold' }}>Year 2:</label>
                                    <select
                                        value={yearComparison.year2 || ''}
                                        onChange={(e) => {
                                            const newValue = e.target.value ? parseInt(e.target.value, 10) : null;
                                            if (newValue !== yearComparison.year1) {
                                                setYearComparison({ ...yearComparison, year2: newValue });
                                            } else {
                                                // Swap years if trying to select the same one
                                                setYearComparison({ 
                                                    year1: yearComparison.year2, 
                                                    year2: newValue 
                                                });
                                            }
                                        }}
                                        style={{
                                            padding: '0.5rem 1rem',
                                            borderRadius: '8px',
                                            border: '1px solid #ddd',
                                            fontSize: '1rem',
                                            minWidth: '120px'
                                        }}
                                    >
                                        <option value="">Select Year</option>
                                        {availableYears.map(year => (
                                            <option key={year} value={year}>{year}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {yearComparisonData ? (
                                <div>
                                    {/* Key Insights */}
                                    <div className="conclusions-section" style={{ marginBottom: '2rem' }}>
                                        <h3>Year Comparison Insights</h3>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                            gap: '1.25rem',
                                            marginTop: '1.5rem'
                                        }}>
                                            <div className="conclusion-card highlight" style={{
                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                color: '#fff',
                                                padding: '1.5rem',
                                                borderRadius: '12px',
                                                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                                                minHeight: '160px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between'
                                            }}>
                                                <div className="conclusion-title" style={{ fontSize: '0.95rem', marginBottom: '0.75rem', opacity: 0.95 }}>💰 Total Revenue Leader</div>
                                                <div className="conclusion-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                                    {yearComparisonData.year1.stats.revenue?.sum > yearComparisonData.year2.stats.revenue?.sum 
                                                        ? yearComparisonData.year1.year 
                                                        : yearComparisonData.year2.year}
                                                </div>
                                                <div className="conclusion-detail" style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                                                    {yearComparisonData.year1.stats.revenue?.sum > yearComparisonData.year2.stats.revenue?.sum 
                                                        ? formatCurrency(yearComparisonData.year1.stats.revenue?.sum || 0)
                                                        : formatCurrency(yearComparisonData.year2.stats.revenue?.sum || 0)}
                                                </div>
                                            </div>

                                            <div className="conclusion-card highlight" style={{
                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                color: '#fff',
                                                padding: '1.5rem',
                                                borderRadius: '12px',
                                                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                                                minHeight: '160px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between'
                                            }}>
                                                <div className="conclusion-title" style={{ fontSize: '0.95rem', marginBottom: '0.75rem', opacity: 0.95 }}>👥 Total Visitors Leader</div>
                                                <div className="conclusion-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                                    {yearComparisonData.year1.stats.visitors?.sum > yearComparisonData.year2.stats.visitors?.sum 
                                                        ? yearComparisonData.year1.year 
                                                        : yearComparisonData.year2.year}
                                                </div>
                                                <div className="conclusion-detail" style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                                                    {yearComparisonData.year1.stats.visitors?.sum > yearComparisonData.year2.stats.visitors?.sum 
                                                        ? formatNumber(yearComparisonData.year1.stats.visitors?.sum || 0) + ' visitors'
                                                        : formatNumber(yearComparisonData.year2.stats.visitors?.sum || 0) + ' visitors'}
                                                </div>
                                            </div>

                                            <div className="conclusion-card highlight" style={{
                                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                color: '#fff',
                                                padding: '1.5rem',
                                                borderRadius: '12px',
                                                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                                                minHeight: '160px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between'
                                            }}>
                                                <div className="conclusion-title" style={{ fontSize: '0.95rem', marginBottom: '0.75rem', opacity: 0.95 }}>⭐ Average Rating Leader</div>
                                                <div className="conclusion-value" style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                                                    {yearComparisonData.year1.stats.rating?.mean > yearComparisonData.year2.stats.rating?.mean
                                                        ? yearComparisonData.year1.year 
                                                        : yearComparisonData.year2.year}
                                                </div>
                                                <div className="conclusion-detail" style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                                                    {yearComparisonData.year1.stats.rating?.mean > yearComparisonData.year2.stats.rating?.mean
                                                        ? (yearComparisonData.year1.stats.rating?.mean?.toFixed(2) || 'N/A') + ' rating'
                                                        : (yearComparisonData.year2.stats.rating?.mean?.toFixed(2) || 'N/A') + ' rating'}
                                                </div>
                                            </div>

                                            <div className="conclusion-card" style={{
                                                background: '#fff',
                                                border: '2px solid #e0e0e0',
                                                padding: '1.5rem',
                                                borderRadius: '12px',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                                minHeight: '160px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between'
                                            }}>
                                                <div className="conclusion-title" style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: '#333', fontWeight: '600' }}>📊 Revenue Growth</div>
                                                <div className="conclusion-value" style={{
                                                    fontSize: '2rem',
                                                    fontWeight: 'bold',
                                                    marginBottom: '0.5rem',
                                                    color: yearComparisonData.year2.stats.revenue?.sum > yearComparisonData.year1.stats.revenue?.sum ? '#28a745' : '#dc3545'
                                                }}>
                                                    {yearComparisonData.year1.stats.revenue?.sum && yearComparisonData.year2.stats.revenue?.sum
                                                        ? (((yearComparisonData.year2.stats.revenue.sum - yearComparisonData.year1.stats.revenue.sum) / yearComparisonData.year1.stats.revenue.sum) * 100).toFixed(2) + '%'
                                                        : 'N/A'}
                                                </div>
                                                <div className="conclusion-detail" style={{ fontSize: '0.9rem', color: '#666' }}>
                                                    {yearComparisonData.year1.year} → {yearComparisonData.year2.year}
                                                </div>
                                            </div>

                                            <div className="conclusion-card" style={{
                                                background: '#fff',
                                                border: '2px solid #e0e0e0',
                                                padding: '1.5rem',
                                                borderRadius: '12px',
                                                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                                                minHeight: '160px',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'space-between'
                                            }}>
                                                <div className="conclusion-title" style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: '#333', fontWeight: '600' }}>👥 Visitors Growth</div>
                                                <div className="conclusion-value" style={{
                                                    fontSize: '2rem',
                                                    fontWeight: 'bold',
                                                    marginBottom: '0.5rem',
                                                    color: yearComparisonData.year2.stats.visitors?.sum > yearComparisonData.year1.stats.visitors?.sum ? '#28a745' : '#dc3545'
                                                }}>
                                                    {yearComparisonData.year1.stats.visitors?.sum && yearComparisonData.year2.stats.visitors?.sum
                                                        ? (((yearComparisonData.year2.stats.visitors.sum - yearComparisonData.year1.stats.visitors.sum) / yearComparisonData.year1.stats.visitors.sum) * 100).toFixed(2) + '%'
                                                        : 'N/A'}
                                                </div>
                                                <div className="conclusion-detail" style={{ fontSize: '0.9rem', color: '#666' }}>
                                                    {yearComparisonData.year1.year} → {yearComparisonData.year2.year}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Revenue Comparison Chart */}
                                    {yearComparisonData.year1.stats.revenue && yearComparisonData.year2.stats.revenue && (
                                        <div style={{ 
                                            marginBottom: '2rem', 
                                            padding: '1.5rem', 
                                            backgroundColor: '#fff', 
                                            borderRadius: '12px', 
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                            height: '450px'
                                        }}>
                                            <h3 style={{ marginBottom: '1.5rem', color: '#333', fontSize: '1.25rem', fontWeight: '600' }}>Revenue Comparison</h3>
                                            <div style={{ height: '380px' }}>
                                                <Bar 
                                                    data={{
                                                        labels: ['Total Revenue', 'Mean Revenue', 'Median Revenue'],
                                                        datasets: [
                                                            {
                                                                label: `${yearComparisonData.year1.year}`,
                                                                data: [
                                                                    yearComparisonData.year1.stats.revenue.sum || 0,
                                                                    yearComparisonData.year1.stats.revenue.mean || 0,
                                                                    yearComparisonData.year1.stats.revenue.median || 0
                                                                ],
                                                                backgroundColor: 'rgba(52, 152, 219, 0.7)',
                                                                borderColor: 'rgba(52, 152, 219, 1)',
                                                                borderWidth: 1
                                                            },
                                                            {
                                                                label: `${yearComparisonData.year2.year}`,
                                                                data: [
                                                                    yearComparisonData.year2.stats.revenue.sum || 0,
                                                                    yearComparisonData.year2.stats.revenue.mean || 0,
                                                                    yearComparisonData.year2.stats.revenue.median || 0
                                                                ],
                                                                backgroundColor: 'rgba(46, 204, 113, 0.7)',
                                                                borderColor: 'rgba(46, 204, 113, 1)',
                                                                borderWidth: 1
                                                            }
                                                        ]
                                                    }} 
                                                    options={{
                                                        responsive: true,
                                                        maintainAspectRatio: false,
                                                        layout: {
                                                            padding: {
                                                                top: 10,
                                                                bottom: 10,
                                                                left: 10,
                                                                right: 10
                                                            }
                                                        },
                                                        plugins: {
                                                            legend: {
                                                                display: true,
                                                                position: 'top',
                                                                align: 'center',
                                                                labels: {
                                                                    padding: 15,
                                                                    font: {
                                                                        size: 12
                                                                    },
                                                                    usePointStyle: true
                                                                }
                                                            },
                                                            title: {
                                                                display: false
                                                            },
                                                            tooltip: {
                                                                callbacks: {
                                                                    label: function(context) {
                                                                        return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                                                                    }
                                                                },
                                                                padding: 10
                                                            }
                                                        },
                                                        scales: {
                                                            y: {
                                                                beginAtZero: true,
                                                                ticks: {
                                                                    callback: function(value) {
                                                                        return formatCurrency(value);
                                                                    },
                                                                    padding: 8
                                                                },
                                                                title: {
                                                                    display: true,
                                                                    text: 'Revenue',
                                                                    padding: {
                                                                        bottom: 10
                                                                    }
                                                                }
                                                            },
                                                            x: {
                                                                ticks: {
                                                                    padding: 10
                                                                },
                                                                title: {
                                                                    display: true,
                                                                    text: 'Metrics',
                                                                    padding: {
                                                                        top: 10
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }} 
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Detailed Comparison Table */}
                                    <div style={{ marginBottom: '2rem' }}>
                                        <h3>Detailed Revenue Comparison</h3>
                                        <div className="table-container">
                                            <table className="analytics-table">
                                                <thead>
                                                    <tr>
                                                        <th>Metric</th>
                                                        <th>{yearComparisonData.year1.year}</th>
                                                        <th>{yearComparisonData.year2.year}</th>
                                                        <th>Difference</th>
                                                        <th>Change %</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr>
                                                        <td><strong>Total Revenue</strong></td>
                                                        <td>{formatCurrency(yearComparisonData.year1.stats.revenue?.sum || 0)}</td>
                                                        <td>{formatCurrency(yearComparisonData.year2.stats.revenue?.sum || 0)}</td>
                                                        <td style={{
                                                            color: yearComparisonData.year2.stats.revenue?.sum > yearComparisonData.year1.stats.revenue?.sum ? '#28a745' : '#dc3545',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {formatCurrency(Math.abs((yearComparisonData.year2.stats.revenue?.sum || 0) - (yearComparisonData.year1.stats.revenue?.sum || 0)))}
                                                            {yearComparisonData.year2.stats.revenue?.sum > yearComparisonData.year1.stats.revenue?.sum ? ' ↑' : ' ↓'}
                                                        </td>
                                                        <td style={{
                                                            color: yearComparisonData.year2.stats.revenue?.sum > yearComparisonData.year1.stats.revenue?.sum ? '#28a745' : '#dc3545',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {yearComparisonData.year1.stats.revenue?.sum && yearComparisonData.year2.stats.revenue?.sum
                                                                ? (((yearComparisonData.year2.stats.revenue.sum - yearComparisonData.year1.stats.revenue.sum) / yearComparisonData.year1.stats.revenue.sum) * 100).toFixed(2) + '%'
                                                                : 'N/A'}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td><strong>Mean Revenue</strong></td>
                                                        <td>{formatCurrency(yearComparisonData.year1.stats.revenue?.mean || 0)}</td>
                                                        <td>{formatCurrency(yearComparisonData.year2.stats.revenue?.mean || 0)}</td>
                                                        <td style={{
                                                            color: yearComparisonData.year2.stats.revenue?.mean > yearComparisonData.year1.stats.revenue?.mean ? '#28a745' : '#dc3545',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {formatCurrency(Math.abs((yearComparisonData.year2.stats.revenue?.mean || 0) - (yearComparisonData.year1.stats.revenue?.mean || 0)))}
                                                            {yearComparisonData.year2.stats.revenue?.mean > yearComparisonData.year1.stats.revenue?.mean ? ' ↑' : ' ↓'}
                                                        </td>
                                                        <td style={{
                                                            color: yearComparisonData.year2.stats.revenue?.mean > yearComparisonData.year1.stats.revenue?.mean ? '#28a745' : '#dc3545',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {yearComparisonData.year1.stats.revenue?.mean && yearComparisonData.year2.stats.revenue?.mean
                                                                ? (((yearComparisonData.year2.stats.revenue.mean - yearComparisonData.year1.stats.revenue.mean) / yearComparisonData.year1.stats.revenue.mean) * 100).toFixed(2) + '%'
                                                                : 'N/A'}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td><strong>Total Visitors</strong></td>
                                                        <td>{formatNumber(yearComparisonData.year1.stats.visitors?.sum || 0)}</td>
                                                        <td>{formatNumber(yearComparisonData.year2.stats.visitors?.sum || 0)}</td>
                                                        <td style={{
                                                            color: yearComparisonData.year2.stats.visitors?.sum > yearComparisonData.year1.stats.visitors?.sum ? '#28a745' : '#dc3545',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {formatNumber(Math.abs((yearComparisonData.year2.stats.visitors?.sum || 0) - (yearComparisonData.year1.stats.visitors?.sum || 0)))}
                                                            {yearComparisonData.year2.stats.visitors?.sum > yearComparisonData.year1.stats.visitors?.sum ? ' ↑' : ' ↓'}
                                                        </td>
                                                        <td style={{
                                                            color: yearComparisonData.year2.stats.visitors?.sum > yearComparisonData.year1.stats.visitors?.sum ? '#28a745' : '#dc3545',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {yearComparisonData.year1.stats.visitors?.sum && yearComparisonData.year2.stats.visitors?.sum
                                                                ? (((yearComparisonData.year2.stats.visitors.sum - yearComparisonData.year1.stats.visitors.sum) / yearComparisonData.year1.stats.visitors.sum) * 100).toFixed(2) + '%'
                                                                : 'N/A'}
                                                        </td>
                                                    </tr>
                                                    <tr>
                                                        <td><strong>Mean Rating</strong></td>
                                                        <td>{yearComparisonData.year1.stats.rating?.mean?.toFixed(2) || 'N/A'}</td>
                                                        <td>{yearComparisonData.year2.stats.rating?.mean?.toFixed(2) || 'N/A'}</td>
                                                        <td style={{
                                                            color: yearComparisonData.year2.stats.rating?.mean > yearComparisonData.year1.stats.rating?.mean ? '#28a745' : '#dc3545',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {yearComparisonData.year1.stats.rating?.mean && yearComparisonData.year2.stats.rating?.mean
                                                                ? Math.abs(yearComparisonData.year2.stats.rating.mean - yearComparisonData.year1.stats.rating.mean).toFixed(2)
                                                                : 'N/A'}
                                                            {yearComparisonData.year1.stats.rating?.mean && yearComparisonData.year2.stats.rating?.mean && yearComparisonData.year2.stats.rating.mean > yearComparisonData.year1.stats.rating.mean ? ' ↑' : ' ↓'}
                                                        </td>
                                                        <td style={{
                                                            color: yearComparisonData.year2.stats.rating?.mean > yearComparisonData.year1.stats.rating?.mean ? '#28a745' : '#dc3545',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            {yearComparisonData.year1.stats.rating?.mean && yearComparisonData.year2.stats.rating?.mean
                                                                ? (((yearComparisonData.year2.stats.rating.mean - yearComparisonData.year1.stats.rating.mean) / yearComparisonData.year1.stats.rating.mean) * 100).toFixed(2) + '%'
                                                                : 'N/A'}
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Price Optimization Suggestions */}
                                    <div className="price-optimization-section" style={{
                                        background: '#fff',
                                        padding: '2rem',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                        marginTop: '2rem',
                                        marginBottom: '2rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                                    <div>
                                                <h3 style={{ margin: 0, color: '#333', fontSize: '1.5rem', fontWeight: '600' }}>💰 Price Optimization Suggestions</h3>
                                                <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.95rem' }}>
                                                    Get AI-powered price adjustment recommendations based on elasticity analysis to maximize revenue
                                                </p>
                                                    </div>
                                            <button
                                                onClick={() => loadPriceOptimization(yearComparisonData?.year2?.year || null)}
                                                disabled={loadingOptimization}
                                                style={{
                                                    padding: '0.75rem 1.5rem',
                                                    borderRadius: '8px',
                                                    border: 'none',
                                                    background: loadingOptimization ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                    color: '#fff',
                                                    fontWeight: '600',
                                                    cursor: loadingOptimization ? 'not-allowed' : 'pointer',
                                                    fontSize: '0.95rem',
                                                    boxShadow: loadingOptimization ? 'none' : '0 4px 8px rgba(102, 126, 234, 0.3)',
                                                    transition: 'all 0.3s ease'
                                                }}
                                            >
                                                {loadingOptimization ? 'Loading...' : '🔍 Get Suggestions'}
                                            </button>
                                        </div>

                                        {priceOptimizationData ? (
                                            priceOptimizationData.errCode === 0 ? (
                                                    <div>
                                                    {/* Current Data Summary */}
                                                    <div style={{
                                                        padding: '1.5rem',
                                                        background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                                                        borderRadius: '10px',
                                                        marginBottom: '1.5rem'
                                                    }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                                            <div>
                                                                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Year</div>
                                                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#333' }}>{priceOptimizationData.year}</div>
                                                    </div>
                                                    <div>
                                                                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Elasticity</div>
                                                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#333' }}>
                                                                    {priceOptimizationData.elasticity}
                                                    </div>
                                                                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                                                                    {priceOptimizationData.elasticityInterpretation}
                                                </div>
                                            </div>
                                                    <div>
                                                                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Current Revenue</div>
                                                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#333' }}>
                                                                    {formatCurrency(parseFloat(priceOptimizationData.currentData.totalRevenue))}
                                                                </div>
                                                    </div>
                                                    <div>
                                                                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Current Price (ARPV)</div>
                                                                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#333' }}>
                                                                    {formatCurrency(parseFloat(priceOptimizationData.currentData.currentPrice))}
                                                    </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Best Suggestion */}
                                                    {priceOptimizationData.bestSuggestion && (
                                                        <div style={{
                                                            padding: '1.5rem',
                                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                            borderRadius: '12px',
                                                            color: '#fff',
                                                            marginBottom: '1.5rem',
                                                            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                                                                <span style={{ fontSize: '2rem', marginRight: '0.75rem' }}>⭐</span>
                                                                <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>Best Recommendation</h4>
                                                            </div>
                                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                                    <div>
                                                                    <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.5rem' }}>Price Change</div>
                                                                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                                                        {priceOptimizationData.bestSuggestion.priceChangePercent > 0 ? '+' : ''}
                                                                        {priceOptimizationData.bestSuggestion.priceChangePercent}%
                                                    </div>
                                                </div>
                                                                <div>
                                                                    <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.5rem' }}>Expected Revenue Change</div>
                                                                    <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                                                        {priceOptimizationData.bestSuggestion.expectedRevenueChangePercent > 0 ? '+' : ''}
                                                                        {priceOptimizationData.bestSuggestion.expectedRevenueChangePercent}%
                                            </div>
                                        </div>
                                                                <div>
                                                                    <div style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '0.5rem' }}>New Expected Revenue</div>
                                                                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                                                        {formatCurrency(parseFloat(priceOptimizationData.bestSuggestion.expectedRevenue))}
                                    </div>
                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* All Suggestions Table */}
                                                    {priceOptimizationData.allSuggestions && priceOptimizationData.allSuggestions.length > 0 && (
                                                        <div>
                                                            <h4 style={{ marginBottom: '1rem', color: '#333', fontSize: '1.1rem' }}>All Price Adjustment Scenarios</h4>
                                                            <div className="table-container">
                                                                <table className="analytics-table">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Price Change</th>
                                                                            <th>New Price</th>
                                                                            <th>Expected Quantity Change</th>
                                                                            <th>Expected New Quantity</th>
                                                                            <th>Expected Revenue</th>
                                                                            <th>Revenue Change</th>
                                                                            <th>Revenue Change %</th>
                                                                            <th>Status</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {priceOptimizationData.allSuggestions.map((suggestion, index) => (
                                                                            <tr key={index} style={{
                                                                                background: suggestion.recommendation === 'recommended' ? '#f0f9ff' : 'transparent'
                                                                            }}>
                                                                                <td style={{ fontWeight: 'bold' }}>
                                                                                    {suggestion.priceChangePercent > 0 ? '+' : ''}
                                                                                    {suggestion.priceChangePercent}%
                                                                                </td>
                                                                                <td>{formatCurrency(parseFloat(suggestion.newPrice))}</td>
                                                                                <td>
                                                                                    {suggestion.expectedQuantityChangePercent > 0 ? '+' : ''}
                                                                                    {suggestion.expectedQuantityChangePercent}%
                                                                                </td>
                                                                                <td>{formatNumber(suggestion.expectedNewQuantity)}</td>
                                                                                <td style={{ fontWeight: 'bold' }}>
                                                                                    {formatCurrency(parseFloat(suggestion.expectedRevenue))}
                                                                                </td>
                                                                                <td style={{
                                                                                    color: parseFloat(suggestion.expectedRevenueChange) > 0 ? '#28a745' : '#dc3545',
                                                                                    fontWeight: 'bold'
                                                                                }}>
                                                                                    {parseFloat(suggestion.expectedRevenueChange) > 0 ? '+' : ''}
                                                                                    {formatCurrency(parseFloat(suggestion.expectedRevenueChange))}
                                                                                </td>
                                                                                <td style={{
                                                                                    color: parseFloat(suggestion.expectedRevenueChangePercent) > 0 ? '#28a745' : '#dc3545',
                                                                                    fontWeight: 'bold'
                                                                                }}>
                                                                                    {parseFloat(suggestion.expectedRevenueChangePercent) > 0 ? '+' : ''}
                                                                                    {suggestion.expectedRevenueChangePercent}%
                                                                                </td>
                                                                                <td>
                                                                                    {suggestion.recommendation === 'recommended' ? (
                                                                                        <span style={{
                                                                                            padding: '0.25rem 0.75rem',
                                                                                            borderRadius: '12px',
                                                                                            background: '#28a745',
                                                                                            color: '#fff',
                                                                                            fontSize: '0.85rem',
                                                                                            fontWeight: '600'
                                                                                        }}>✓ Recommended</span>
                                                                                    ) : suggestion.recommendation === 'maintain' ? (
                                                                                        <span style={{
                                                                                            padding: '0.25rem 0.75rem',
                                                                                            borderRadius: '12px',
                                                                                            background: '#ffc107',
                                                                                            color: '#333',
                                                                                            fontSize: '0.85rem',
                                                                                            fontWeight: '600'
                                                                                        }}>Maintain</span>
                                                                                    ) : (
                                                                                        <span style={{
                                                                                            padding: '0.25rem 0.75rem',
                                                                                            borderRadius: '12px',
                                                                                            background: '#dc3545',
                                                                                            color: '#fff',
                                                                                            fontSize: '0.85rem',
                                                                                            fontWeight: '600'
                                                                                        }}>Not Recommended</span>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                </div>
                            )}
                                                </div>
                                            ) : (
                                                <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                                                    {priceOptimizationData.message || 'Unable to generate price optimization suggestions'}
                                                </div>
                                            )
                                        ) : (
                                            <div style={{ padding: '2rem', textAlign: 'center', color: '#666', background: '#f8f9fa', borderRadius: '8px' }}>
                                                Click "Get Suggestions" to generate price optimization recommendations based on elasticity analysis.
                        </div>
                    )}
                                    </div>

                                    {/* Revenue Predictions (Scenario Analysis) from tourism_data */}
                                    {yearComparisonData && (
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
                                                    Future revenue projections from tourism_data table. Select a year to view predictions for the next year.
                                                </p>
                                    </div>

                                            {/* Prediction Year Filter (Dropdown like Dashboard) */}
                                            <div style={{ 
                                                marginTop: '1.5rem', 
                                                marginBottom: '1.5rem', 
                                                padding: '1rem', 
                                                backgroundColor: '#f8f9fa', 
                                                borderRadius: '8px',
                                                border: '1px solid #dee2e6',
                                                display: 'flex',
                                                gap: '12px',
                                                alignItems: 'center',
                                                flexWrap: 'wrap'
                                            }}>
                                                <label style={{ 
                                                    fontWeight: 'bold', 
                                                    fontSize: '0.95rem',
                                                    color: '#333'
                                                }}>
                                                    Select Base Year:
                                                </label>
                                        <select
                                                    value={selectedPredictionYear || ''}
                                                    onChange={(e) => setSelectedPredictionYear(e.target.value ? parseInt(e.target.value, 10) : null)}
                                            style={{
                                                        padding: '8px 12px',
                                                        borderRadius: '6px',
                                                border: '1px solid #ddd',
                                                        background: '#fff',
                                                        color: '#333',
                                                        cursor: 'pointer',
                                                fontSize: '0.95rem',
                                                        minWidth: '140px'
                                                    }}
                                                >
                                                    <option value="">Select Year</option>
                                                    {/* Year 1 → Predicts Year 1 + 1 */}
                                                    {yearComparisonData.year1 && (
                                                        <option value={yearComparisonData.year1.year}>
                                                            {yearComparisonData.year1.year} → Predicts {yearComparisonData.year1.year + 1}
                                                        </option>
                                                    )}
                                                    {/* Year 2 (Latest) → Predicts Year 2 + 1 */}
                                                    <option value={yearComparisonData.year2.year}>
                                                        {yearComparisonData.year2.year} (Latest) → Predicts {yearComparisonData.year2.year + 1}
                                                    </option>
                                                    {/* Additional years from availableYears if they exist */}
                                                    {availableYears.filter(y => 
                                                        y > yearComparisonData.year2.year
                                                    ).map(year => (
                                                        <option key={year} value={year}>
                                                            {year} → Predicts {year + 1}
                                                        </option>
                                                    ))}
                                        </select>
                                                <div style={{ 
                                                    fontSize: '0.85rem', 
                                                    color: '#666',
                                                    fontStyle: 'italic'
                                                }}>
                                                    Based on comparison: {yearComparisonData.year1.year} vs {yearComparisonData.year2.year}
                                                    </div>
                                    </div>

                                            {/* Display predictions for NEXT year (selected year + 1) */}
                                            {selectedPredictionYear && predictionDataMap.has(selectedPredictionYear) ? (
                                                (() => {
                                                    const predStats = predictionDataMap.get(selectedPredictionYear);
                                                    const predictedYear = selectedPredictionYear + 1; // Predictions are for the NEXT year
                                                    if (!predStats || !predStats.scenarioPredictions) {
                                                        return (
                                                            <div style={{ 
                                                                padding: '2rem', 
                                                                textAlign: 'center', 
                                                                color: '#666',
                                                                background: '#f8f9fa',
                                                                borderRadius: '8px'
                                                            }}>
                                                                No prediction data available for {predictedYear} (based on {selectedPredictionYear} data).
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                    <div>
                                                            <h4 style={{ 
                                                                marginBottom: '1rem', 
                                                                color: '#333', 
                                                                fontSize: '1.1rem',
                                                                paddingBottom: '0.5rem',
                                                                borderBottom: '2px solid #e0e0e0'
                                                            }}>
                                                                Predictions for {predictedYear} (based on {selectedPredictionYear} data)
                                                                {predStats.scenarioPredictions.count && 
                                                                    ` (${predStats.scenarioPredictions.count} locations)`}
                                                            </h4>
                                                            <div style={{ 
                                                                display: 'grid', 
                                                                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                                                                gap: '20px'
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
                                                                        {predStats.scenarioPredictions.pessimistic !== null && predStats.scenarioPredictions.pessimistic !== undefined ? 
                                                                            formatVND(predStats.scenarioPredictions.pessimistic) : 
                                                                            'N/A'
                                                                        }
                                            </div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#999' }}>
                                                                        From database (pessimistic column) - {selectedPredictionYear} data predicts {predictedYear}
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
                                                                        {predStats.scenarioPredictions.average !== null && predStats.scenarioPredictions.average !== undefined ? 
                                                                            formatVND(predStats.scenarioPredictions.average) : 
                                                                            'N/A'
                                                                        }
                                            </div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#999' }}>
                                                                        From database (average column) - {selectedPredictionYear} data predicts {predictedYear}
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
                                                                        {predStats.scenarioPredictions.optimistic !== null && predStats.scenarioPredictions.optimistic !== undefined ? 
                                                                            formatVND(predStats.scenarioPredictions.optimistic) : 
                                                                            'N/A'
                                                                        }
                                                                    </div>
                                                                    <div style={{ fontSize: '0.75rem', color: '#999' }}>
                                                                        From database (optimistic column) - {selectedPredictionYear} data predicts {predictedYear}
                                                                    </div>
                                                                </div>
                                                </div>
                                            </div>
                                        );
                                                })()
                                            ) : selectedPredictionYear ? (
                                                <div style={{ 
                                                    padding: '2rem', 
                                                    textAlign: 'center', 
                                                    color: '#666',
                                                    background: '#f8f9fa',
                                                    borderRadius: '8px'
                                                }}>
                                                    Loading prediction data for {selectedPredictionYear + 1} (based on {selectedPredictionYear} data)...
                                                </div>
                                            ) : (
                                                <div style={{ 
                                                    padding: '2rem', 
                                                    textAlign: 'center', 
                                                    color: '#666',
                                                    background: '#f8f9fa',
                                                    borderRadius: '8px'
                                                }}>
                                                    Please select a base year to view predictions for the next year.
                                                </div>
                                            )}

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
                                                    <strong>Data Source:</strong> Values are averaged from pessimistic, average, and optimistic columns in the tourism_data table (per location).
                                                    <br />
                                                    <strong>Prediction Logic:</strong> When you select a year (e.g., 2025), the system uses the optimistic, average, and pessimistic values from that year's data to predict revenue per location for the next year (2026).
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                                    </div>
                                                ) : (
                                <div className="no-data">
                                    {!yearComparison.year1 || !yearComparison.year2
                                        ? 'Please select two years to compare revenue metrics.'
                                        : 'Loading comparison data...'}
                                </div>
                            )}
                                                    </div>
                                                )}

                    {/* Methods (Illustration / Explanation) */}
                    {activeTab === 'methods' && (
                        <div className="report-section">
                            <h2>Metric Correlation Analysis</h2>
                            <p className="analysis-description" style={{ marginBottom: '1.5rem' }}>
                                Correlation analysis between Revenue, Rating, and Quantity metrics for each {metricCorrelationScope === 'country' ? 'Country' : 'Category'}.
                            </p>

                            {/* Filter Controls */}
                            <div style={{ 
                                marginBottom: '1.5rem', 
                                padding: '1rem', 
                                backgroundColor: '#f8f9fa', 
                                borderRadius: '8px',
                                display: 'flex',
                                gap: '1rem',
                                alignItems: 'center',
                                flexWrap: 'wrap'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>Scope:</label>
                                    <select
                                        value={metricCorrelationScope}
                                        onChange={(e) => setMetricCorrelationScope(e.target.value)}
                                style={{
                                            padding: '0.5rem 0.75rem',
                                            borderRadius: '8px',
                                            border: '1px solid #ddd',
                                            fontSize: '0.95rem',
                                            background: 'white',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="category">Category</option>
                                        <option value="country">Country</option>
                                    </select>
                                    </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <label style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>Method:</label>
                                        <select
                                        value={metricCorrelationMethod}
                                        onChange={(e) => setMetricCorrelationMethod(e.target.value)}
                                            style={{
                                                padding: '0.5rem 0.75rem',
                                                borderRadius: '8px',
                                                border: '1px solid #ddd',
                                                fontSize: '0.95rem',
                                            background: 'white',
                                            cursor: 'pointer'
                                            }}
                                        >
                                        <option value="pearson">Pearson (linear)</option>
                                        <option value="spearman">Spearman (rank)</option>
                                        </select>
                                    </div>
                                                </div>

                                                    {(() => {
                                                        const rows = flattenStatusRows();
                                                        const key = metricCorrelationScope === 'country' ? 'country' : 'category';

                                                        // Build map: componentName -> rows
                                                        const byComponent = new Map();
                                                        rows.forEach((r) => {
                                                            const name = (r && r[key]) ? String(r[key]) : null;
                                                            if (!name) return;
                                                            if (!byComponent.has(name)) byComponent.set(name, []);
                                                            byComponent.get(name).push(r);
                                                        });

                                                        const components = Array.from(byComponent.entries())
                                                            .map(([name, items]) => {
                                                                const revenues = items.map(it => it?.revenue);
                                                                const qty = items.map(it => it?.visitors);
                                        const ratings = items.map(it => it?.rating);
                                        const corr = metricCorrelationMethod === 'spearman' ? spearmanCorrelation : pearsonCorrelation;

                                        const rRevRating = corr(revenues, ratings);
                                        const rRevQty = corr(revenues, qty);
                                        const rRatingQty = corr(ratings, qty);

                                                                return {
                                                                    name,
                                                                    n: items.length,
                                            rRevRating,
                                                                    rRevQty,
                                            rRatingQty
                                                                };
                                                            })
                                                            // Sort by sample size desc, then name
                                                            .sort((a, b) => (b.n - a.n) || a.name.localeCompare(b.name));

                                                        const colorFor = (val) => {
                                                            if (val == null) return '#6c757d';
                                                            const a = Math.abs(val);
                                                            if (a >= 0.7) return '#28a745';
                                                            if (a >= 0.3) return '#ffc107';
                                                            return '#dc3545';
                                                        };

                                                        if (!rows.length) {
                                                            return (
                                                                <div className="no-data">
                                                                    No row-level data loaded yet. Please refresh/reload to fetch `/api/analysis/status`.
                                                                </div>
                                                            );
                                                        }

                                                        if (!components.length) {
                                                            return <div className="no-data">No components found.</div>;
                                                        }

                                                        return (
                                                            <div className="table-container">
                                                                <table className="analytics-table">
                                                                    <thead>
                                                                        <tr>
                                                                            <th>{metricCorrelationScope === 'country' ? 'Country' : 'Category'}</th>
                                                    <th>Revenue ↔ Rating</th>
                                                                            <th>Revenue ↔ Quantity</th>
                                                    <th>Rating ↔ Quantity</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {components.map((c) => (
                                                                            <tr key={c.name}>
                                                                                <td><strong>{c.name}</strong></td>
                                                        <td style={{ fontWeight: 'bold', color: colorFor(c.rRevRating) }}>
                                                            {c.rRevRating != null ? Number(c.rRevRating).toFixed(3) : 'N/A'}
                                                                                </td>
                                                                                <td style={{ fontWeight: 'bold', color: colorFor(c.rRevQty) }}>
                                                                                    {c.rRevQty != null ? Number(c.rRevQty).toFixed(3) : 'N/A'}
                                                                                </td>
                                                        <td style={{ fontWeight: 'bold', color: colorFor(c.rRatingQty) }}>
                                                            {c.rRatingQty != null ? Number(c.rRatingQty).toFixed(3) : 'N/A'}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        );
                                                    })()}
                        </div>
                    )}

                    {/* Order Schedules */}
                    {activeTab === 'schedules' && (
                        <div className="report-section">
                            <h2>Order Schedules by Product</h2>
                            <p className="analysis-description" style={{ marginBottom: '2rem', color: '#666' }}>
                                Bar chart showing the number of schedules (orders) for each product. 
                                This helps identify which products have the most scheduled availability periods.
                            </p>

                            {orderScheduleChartData ? (
                                <div>
                                    {/* Bar Chart */}
                                    <div style={{ 
                                        marginBottom: '2rem', 
                                        padding: '1.5rem', 
                                        backgroundColor: '#fff', 
                                        borderRadius: '12px', 
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                                        height: '500px'
                                    }}>
                                        <Bar 
                                            data={{
                                                labels: orderScheduleChartData.labels,
                                                datasets: [{
                                                    label: 'Number of Schedules',
                                                    data: orderScheduleChartData.data,
                                                    backgroundColor: 'rgba(52, 152, 219, 0.7)',
                                                    borderColor: 'rgba(52, 152, 219, 1)',
                                                    borderWidth: 1
                                                }]
                                            }} 
                                            options={orderScheduleChartOptions} 
                                        />
                                    </div>

                                    {/* Schedule Details Table */}
                                    <div>
                                        <h3 style={{ marginBottom: '1rem', color: '#333' }}>Schedule Details</h3>
                                        <div className="table-container">
                                            <table className="analytics-table">
                                                <thead>
                                                    <tr>
                                                        <th>Product Name</th>
                                                        <th>SKU</th>
                                                        <th>Number of Schedules</th>
                                                        <th>Schedule Dates</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {orderScheduleChartData.fullData.length === 0 ? (
                                                        <tr>
                                                            <td colSpan="4" className="no-data">No schedule data available</td>
                                                        </tr>
                                                    ) : (
                                                        orderScheduleChartData.fullData.map((item, index) => (
                                                            <tr key={index}>
                                                                <td><strong>{item.name}</strong></td>
                                                                <td>{item.sku}</td>
                                                                <td>{item.count}</td>
                                                                <td>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                                        {item.schedules.slice(0, 3).map((schedule, sIdx) => (
                                                                            <div key={sIdx} style={{ fontSize: '0.85rem', color: '#666' }}>
                                                                                {schedule.startDate && schedule.endDate ? (
                                                                                    <>
                                                                                        {new Date(schedule.startDate).toLocaleDateString('en-US', { 
                                                                                            month: 'short', 
                                                                                            day: 'numeric',
                                                                                            year: 'numeric'
                                                                                        })} - {new Date(schedule.endDate).toLocaleDateString('en-US', { 
                                                                                            month: 'short', 
                                                                                            day: 'numeric',
                                                                                            year: 'numeric'
                                                                                        })}
                                                                                    </>
                                                                                ) : 'N/A'}
                                                                            </div>
                                                                        ))}
                                                                        {item.schedules.length > 3 && (
                                                                            <div style={{ fontSize: '0.85rem', color: '#999', fontStyle: 'italic' }}>
                                                                                +{item.schedules.length - 3} more schedule(s)
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="no-data">
                                    {orderSchedules.length === 0 
                                        ? 'No order schedule data available. Please ensure orders are loaded.'
                                        : 'Processing schedule data...'}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Analytics;

