import React from "react";
import { Bar } from "react-chartjs-2";
import { dataTest, handlegetDataAPI } from "../../services/adminService"; // Correctly imports handlegetDataAPI

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

class BarChart extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            chartData: [],   

        }
        this.chartKey = Date.now(); // Used for forcing chart re-render if needed
    }

    // This method will fetch data and update the component's state
    async updateData() {
        this.setState({ loading: true, error: null }); // Set loading before starting fetch
        try {
            // Call handlegetDataAPI directly. It now returns the transformed array.
            const responseData = await handlegetDataAPI();
            // const responseData = dataTest;

            this.setState({
                chartData: responseData, // Set state with the actual array
                loading: false           // Set loading to false on success
            });
            console.log("Fetched data for chart:", responseData);
        } catch (error) {
            console.error("Error fetching chart data:", error);
            this.setState({
                error: error,            // Store the error
                loading: false,          // Set loading to false on error
                chartData: []            // Clear data on error
            });
        }
    }

    // componentDidMount is the best place to make the initial data fetch
    async componentDidMount() {
    this.setState({ loading: true, error: null });
    try {
        const responseData = await handlegetDataAPI(); // direct fetch here
        this.setState({
            chartData: responseData,
            loading: false
        });
        console.log("Fetched data for chart:", responseData);
    } catch (error) {
        console.error("Error fetching chart data:", error);
        this.setState({
            error: error,
            loading: false,
            chartData: []
        });
    }

    // Optional: keep auto-refresh
    this.updateInterval = setInterval(() => {
        this.updateData(); // still useful here
    }, 5000);
}

    componentWillUnmount() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }

    render() {
        // Destructure necessary state variables
        const { chartData, username, loading, error } = this.state;

        if (loading) {
            return <div className='bar-chart'>Loading...</div>;
        }

        if (error) {
            return <div className='bar-chart'>Failed to load chart.</div>;
        }

        if (!chartData || chartData.length === 0) {
            return <div className='bar-chart'>No data to display.</div>;
        }

        return (
            <>
                <div className='bar-chart' style={{ height: '400px' }}>
                    <Bar
                        key={this.chartKey} 
                        data={{
                            
                            labels: chartData.map((item) => item.label), 
                            datasets: [{
                                label: "Product Revenue", 
                                data: chartData.map((item) => item.value), 
                                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                                borderColor: 'rgba(75, 192, 192, 1)',
                                borderWidth: 1,
                            }],
                        }}
                        options={{ 
                            responsive: true,
                            maintainAspectRatio: false,
                            indexAxis: 'x',
                            plugins: {
                                title: {
                                    display: true,
                                    text: 'Product Revenue Chart',
                                },
                                legend: {
                                    position: 'top',
                                },
                            },
                            scales: {
                                x: {
                                    title: {
                                        display: true,
                                        text: 'Product',
                                    },
                                    ticks: { autoSkip: true, maxRotation: 45, minRotation: 0 },
                                },
                                y: {
                                    title: {
                                        display: true,
                                        text: 'Revenue',
                                    },
                                    beginAtZero: true,
                                    ticks: { precision: 0 },
                                },
                            },
                        }}
                    />
                </div>
            </>
        )
    }
}

export default BarChart;