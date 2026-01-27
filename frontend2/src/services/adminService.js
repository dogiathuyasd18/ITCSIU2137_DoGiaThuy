import axios from 'axios';

const handlegetDataAPI = async (fromDate = null, toDate = null) => {
    try {
        let url = "http://localhost:8080/api/get-data-chart";

        // Add date parameters if provided
        if (fromDate && toDate) {
            url += `?fromDate=${fromDate}&toDate=${toDate}`;
        }

        const token = localStorage.getItem('access_token');
        const req = await axios.get(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        console.log("Success from AdminService", req.data); // This will log the object: { data: [...] }

        // Use product_name from backend if available
        const transformedData = req.data.data.map(item => ({
            label: item.product_name || `Product ID: ${item.product_id}`,
            value: parseFloat(item.revenue || 0),
        }));

        return transformedData; // Return the transformed array

    } catch (err) {
        console.error("Failed to fetch data:", err.response?.data || err.message);
        throw err; // Re-throw the error for proper handling in calling code
    }
};

const handleUpdateDataAPI = async () => {
    try {

    } catch (err) {

    }
}

let dataTest = [{
    "label": "A",
    "value": 32
},
{
    "label": "B",
    "value": 45
},
{
    "label": "C",
    "value": 90
}];

const getAnalysisStats = async (year = null) => {
    try {
        let url = "http://localhost:8080/api/analysis/stats";
        if (year) {
            url += `?year=${year}`;
        }
        const token = localStorage.getItem('access_token');

        // console.log('Fetching stats from:', url);
        // console.log('Token available:', !!token);

        const res = await axios.get(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        // console.log('Raw response:', res.data);

        // Backend returns: { data: { revenue: {...}, rating: {...} } }
        if (res.data && res.data.data) {
            const statsData = res.data.data;
            console.log('Extracted stats data:', statsData);
            return statsData;
        }

        // Fallback if data structure is different (maybe backend returns directly)
        if (res.data && (res.data.revenue || res.data.rating)) {
            console.log('Using direct data structure');
            return res.data;
        }

        console.warn('Unexpected response structure:', res.data);
        return {};
    } catch (err) {
        console.error("Failed to fetch analysis stats:", err);
        if (err.response) {
            console.error("Response status:", err.response.status);
            console.error("Response data:", err.response.data);
            if (err.response.status === 401) {
                throw new Error('Unauthorized: Please log in as admin');
            } else if (err.response.status === 403) {
                throw new Error('Forbidden: Admin access required');
            }
        }
        throw err;
    }
};

const getAvailableYears = async () => {
    try {
        const url = "http://localhost:8080/api/analysis/years";
        const token = localStorage.getItem('access_token');

        const res = await axios.get(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (res.data && res.data.errCode === 0 && res.data.data) {
            return res.data.data;
        }

        return [];
    } catch (err) {
        console.error("Failed to fetch available years:", err);
        return [];
    }
};

const calculateElasticity = async () => {
    try {
        const url = "http://localhost:8080/api/analysis/calculate-elasticity";
        const token = localStorage.getItem('access_token');

        const res = await axios.post(url, {}, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (res.data && res.data.errCode === 0) {
            return res.data;
        }
        throw new Error(res.data?.message || 'Failed to calculate elasticity');
    } catch (e) {
        console.error('Error calculating elasticity:', e);
        throw e;
    }
};

const getHandleStatus = async () => {
    try {
        // Use a relative URL if your axios is configured with a baseURL, 
        // otherwise use the full URL as before: "http://localhost:8080/api/analysis/status"
        const url = "http://localhost:8080/api/analysis/status";
        const token = localStorage.getItem('access_token');

        const res = await axios.get(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        // The backend now returns { data: statusCounts, products: statusProducts, statistics, revenueAnalysis, conclusions }
        // axios wraps this in its own 'data' object: res.data
        if (res.data) {
            return {
                data: res.data.data || res.data,
                products: res.data.products || {},
                statistics: res.data.statistics || null,
                revenueAnalysis: res.data.revenueAnalysis || null,
                conclusions: res.data.conclusions || null
            };
        } else {
            // Fallback if the structure is different
            return res.data;
        }

    } catch (err) {
        console.error("Failed to fetch analysis stats:", err);

        // Enhanced error handling for easier debugging
        if (err.response) {
            console.error("Server Error:", err.response.status, err.response.data);
            if (err.response.status === 401) {
                throw new Error('Unauthorized: Please log in as admin.');
            } else if (err.response.status === 403) {
                throw new Error('Forbidden: You do not have admin permissions.');
            }
        } else if (err.request) {
            console.error("Network Error: No response received", err.request);
            throw new Error('Network error. Please check your connection.');
        }

        throw err; // Re-throw so the calling component can handle it (e.g., show error message)
    }
};

const getCrossTab = async () => {
    try {
        const url = "http://localhost:8080/api/analysis/crosstab";
        const token = localStorage.getItem('access_token');

        const res = await axios.get(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        // The backend returns { data: { categoryReport, countryReport, priceReport } }
        if (res.data && res.data.data) {
            return res.data.data;
        } else {
            return res.data;
        }

    } catch (err) {
        console.error("Failed to fetch crosstab data:", err);

        if (err.response) {
            console.error("Server Error:", err.response.status, err.response.data);
            if (err.response.status === 401) {
                throw new Error('Unauthorized: Please log in as admin.');
            } else if (err.response.status === 403) {
                throw new Error('Forbidden: You do not have admin permissions.');
            }
        } else if (err.request) {
            console.error("Network Error: No response received", err.request);
            throw new Error('Network error. Please check your connection.');
        }

        throw err;
    }
};

const getChiSquareAnalysis = async () => {
    try {
        const url = "http://localhost:8080/api/analysis/chi-square";
        const token = localStorage.getItem('access_token');

        const res = await axios.get(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        // The backend returns { errCode, message, data: { tests, medians } }
        if (res.data && res.data.errCode === 0) {
            return res.data.data;
        } else {
            return res.data;
        }

    } catch (err) {
        console.error("Failed to fetch Chi-Square analysis:", err);

        if (err.response) {
            console.error("Server Error:", err.response.status, err.response.data);
            if (err.response.status === 401) {
                throw new Error('Unauthorized: Please log in as admin.');
            } else if (err.response.status === 403) {
                throw new Error('Forbidden: You do not have admin permissions.');
            }
        } else if (err.request) {
            console.error("Network Error: No response received", err.request);
            throw new Error('Network error. Please check your connection.');
        }

        throw err;
    }
};

const getAllUsers = async () => {
    try {
        const url = "http://localhost:8080/api/analysis/users";
        const token = localStorage.getItem('access_token');

        const res = await axios.get(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        // Backend returns { data: statusCounts, users: statusUsers }
        // Return the entire response data so component can access both data and users
        console.log('getAllUsers response:', res.data);
        return res.data;

    } catch (err) {
        console.error("Failed to fetch users:", err);

        if (err.response) {
            console.error("Server Error:", err.response.status, err.response.data);
            if (err.response.status === 401) {
                throw new Error('Unauthorized: Please log in as admin.');
            } else if (err.response.status === 403) {
                throw new Error('Forbidden: You do not have admin permissions.');
            }
        } else if (err.request) {
            console.error("Network Error: No response received", err.request);
            throw new Error('Network error. Please check your connection.');
        }

        throw err;
    }
}

const getHandleCreate = async (formProduct) => {
    try {
        const url = "http://localhost:8080/api/create";
        const token = localStorage.getItem("access_token");

        const res = await axios.post(url, formProduct, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        return res.data;

    } catch (error) {
        console.error("Error in getHandleCreate:", error);
        // Throw the error so the component's .catch() block can see it
        throw error;
    }
}

const getHandleUpdate = async (formProduct) => {
    try {
        const url = "http://localhost:8080/api/update";
        const token = localStorage.getItem("access_token");

        const res = await axios.put(url, formProduct, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        return res.data;

    } catch (error) {
        console.error("Error in getHandleUpdate:", error);
        // Throw the error so the component's .catch() block can see it
        throw error;
    }
}

const getAdminProducts = async (stockKeepingUnit) => {
    try {
        const token = localStorage.getItem("access_token");
        const query = stockKeepingUnit ? `?stock_keeping_unit=${encodeURIComponent(stockKeepingUnit)}` : '';
        const url = `http://localhost:8080/api/admin/products${query}`;

        const res = await axios.get(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        return res.data;

    } catch (error) {
        console.error("Error in getAdminProducts:", error);
        // Throw the error so the component's .catch() block can see it
        throw error;
    }
}


const handleUpdateTimeTravel = async (formData) => {
    try {
        const token = localStorage.getItem("access_token");
        const url = `http://localhost:8080/api/admin/update-time-travel`;
        
        // Prepare the payload with all form data
        const payload = {
            stock_keeping_unit: formData.stock_keeping_unit,
            productName: formData.productName,
            price: formData.price,
            description: formData.description,
            start_date: formData.start_date,
            end_date: formData.end_date,
            quantity: formData.quantity
        };
        
        const res = await axios.post(url, payload, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        
        return res.data;
    } catch (error) {
        console.error("Error in handleUpdateTimeTravel:", error);
        throw error;
    }
}

const handleGetTimeTravel = async (stockKeepingUnit) => {
    try {
        const token = localStorage.getItem("access_token");
        const query = stockKeepingUnit
            ? `?stock_keeping_unit=${encodeURIComponent(stockKeepingUnit)}`
            : "";

        const url = `http://localhost:8080/api/admin/order${query}`;

        const res = await axios.get(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        return res.data;
    } catch (error) {
        console.error("Error in getAdminProducts:", error);
        throw error;
    }
};

const getCategories = async () => {
    try {
        const url = "http://localhost:8080/api/admin/categories";
        const token = localStorage.getItem("access_token");

        const res = await axios.get(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        return res.data;

    } catch (error) {
        console.error("Error in getCategories:", error);
        throw error;
    }
};

const getCountries = async () => {
    try {
        const url = "http://localhost:8080/api/admin/countries";
        const token = localStorage.getItem("access_token");

        const res = await axios.get(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        return res.data;

    } catch (error) {
        console.error("Error in getCountries:", error);
        throw error;
    }
};

const deleteProduct = async (stock_keeping_unit) => {
    try {
        const url = "http://localhost:8080/api/delete";
        const token = localStorage.getItem("access_token");

        const res = await axios.delete(url, {
            data: { stock_keeping_unit },
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        return res.data;

    } catch (error) {
        console.error("Error in deleteProduct:", error);
        throw error;
    }
};

const getOrderSchedules = async () => {
    try {
        const url = "http://localhost:8080/api/admin/order";
        const token = localStorage.getItem('access_token');

        const res = await axios.get(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        // Backend returns: { errCode, errMessage, data: [...] }
        if (res.data && res.data.data) {
            return res.data.data;
        }
        return res.data || [];
    } catch (err) {
        console.error("Failed to fetch order schedules:", err);
        if (err.response) {
            console.error("Server Error:", err.response.status, err.response.data);
            if (err.response.status === 401) {
                throw new Error('Unauthorized: Please log in as admin.');
            } else if (err.response.status === 403) {
                throw new Error('Forbidden: You do not have admin permissions.');
            }
        }
        throw err;
    }
};

const importTourismDataset = async ({ truncate = true } = {}) => {
    try {
        const url = "http://localhost:8080/api/admin/import-tourism-data";
        const token = localStorage.getItem('access_token');

        const res = await axios.post(url, { truncate }, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        return res.data;
    } catch (err) {
        console.error("Failed to import tourism dataset:", err);
        if (err.response) {
            console.error("Server Error:", err.response.status, err.response.data);
            if (err.response.status === 401) {
                throw new Error('Unauthorized: Please log in as admin.');
            } else if (err.response.status === 403) {
                throw new Error('Forbidden: You do not have admin permissions.');
            }
        }
        throw err;
    }
};

const setPriceExperiment = async ({ percentage, active = true } = {}) => {
    try {
        const url = "http://localhost:8080/api/admin/experiment/price";
        const token = localStorage.getItem('access_token');
        const res = await axios.post(url, { percentage, active }, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        return res.data;
    } catch (err) {
        console.error("Failed to set price experiment:", err);
        throw err;
    }
};

const getPriceExperimentReport = async () => {
    try {
        const url = "http://localhost:8080/api/admin/experiment/price/report";
        const token = localStorage.getItem('access_token');
        const res = await axios.get(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        return res.data;
    } catch (err) {
        console.error("Failed to get price experiment report:", err);
        throw err;
    }
};

const getPriceOptimizationSuggestions = async (year = null) => {
    try {
        let url = "http://localhost:8080/api/analysis/price-optimization";
        if (year) {
            url += `?year=${year}`;
        }
        const token = localStorage.getItem('access_token');
        const res = await axios.get(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        return res.data;
    } catch (err) {
        console.error("Failed to get price optimization suggestions:", err);
        throw err;
    }
};

export { handlegetDataAPI, dataTest, getHandleStatus, getAnalysisStats, getAvailableYears, getCrossTab, getChiSquareAnalysis, getAllUsers, getHandleCreate, getHandleUpdate, getAdminProducts, handleGetTimeTravel, handleUpdateTimeTravel, getCategories, getCountries, deleteProduct, getOrderSchedules, importTourismDataset, setPriceExperiment, getPriceExperimentReport, calculateElasticity, getPriceOptimizationSuggestions };