import { useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { handleUpdateTimeTravel, handleGetTimeTravel } from "../../services/adminService";
import "../../assets/styles/UpdateDetails.scss";

export const UpdateDetail = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const product = location.state?.product;

    // Initialize date fields from existing data or set to current date
    const getInitialDate = (dateString) => {
        if (dateString) {
            // Parse existing date string (YYYY-MM-DD format)
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
            }
        }
        // Default to current date
        return new Date().toISOString().split('T')[0];
    };

    const [form, setForm] = useState({
        productName: product?.name || product?.product?.name || "",
        stock_keeping_unit: product?.stock_keeping_unit || "",
        price: product?.price || "",
        description: product?.description || "",
        start_date: getInitialDate(product?.start_date),
        end_date: getInitialDate(product?.end_date),
        quantity: ""
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [loadingDates, setLoadingDates] = useState(false);

    // Fetch time travel data when component loads
    useEffect(() => {
        const fetchTimeTravelData = async () => {
            if (product?.stock_keeping_unit) {
                setLoadingDates(true);
                try {
                    const timeTravelData = await handleGetTimeTravel(product.stock_keeping_unit);
                    if (timeTravelData?.data && Array.isArray(timeTravelData.data) && timeTravelData.data.length > 0) {
                        const latestSchedule = timeTravelData.data[0]; // Get the most recent schedule
                        setForm(prev => ({
                            ...prev,
                            start_date: getInitialDate(latestSchedule.start_date),
                            end_date: getInitialDate(latestSchedule.end_date),
                            quantity: latestSchedule.quantity || latestSchedule.available_quantity || ""
                        }));
                    }
                } catch (error) {
                    console.error("Error fetching time travel data:", error);
                    // Don't show error, just use default dates
                } finally {
                    setLoadingDates(false);
                }
            }
        };
        fetchTimeTravelData();
    }, [product?.stock_keeping_unit]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm({ ...form, [name]: value });
    };

    const handleUpdate = async (event) => {
        event.preventDefault(); // Stop page refresh
        setIsSubmitting(true);
        setError("");
        setSuccess("");

        try {
            // Validate that end_date is not before start_date
            if (form.end_date && form.start_date && new Date(form.end_date) < new Date(form.start_date)) {
                setError("End date cannot be before start date");
                setIsSubmitting(false);
                return;
            }

            // Prepare data for update (dates are already in YYYY-MM-DD format from date input)
            const updateData = {
                productName: form.productName,
                stock_keeping_unit: form.stock_keeping_unit,
                price: form.price,
                description: form.description,
                start_date: form.start_date,
                end_date: form.end_date,
                quantity: form.quantity
            };

            // Pass the form data to your service
            const response = await handleUpdateTimeTravel(updateData);
            console.log("Update successful:", response);
            setSuccess("Product updated successfully!");

            // Optionally navigate back after a delay
            setTimeout(() => {
                navigate("/admin/update");
            }, 1500);
        } catch (error) {
            console.error("Update failed:", error);
            const errorMessage = error.response?.data?.errMessage || error.message || "Failed to update product";
            setError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="update-container">
            <form onSubmit={handleUpdate}>
                <h2>Update Product</h2>

                {error && (
                    <div style={{
                        color: "red",
                        marginBottom: "15px",
                        padding: "10px",
                        backgroundColor: "#ffe6e6",
                        borderRadius: "4px"
                    }}>
                        {error}
                    </div>
                )}

                {success && (
                    <div style={{
                        color: "green",
                        marginBottom: "15px",
                        padding: "10px",
                        backgroundColor: "#e6ffe6",
                        borderRadius: "4px"
                    }}>
                        {success}
                    </div>
                )}

                <div className="form-group">
                    <label>Product Name *</label>
                    <input
                        name="productName"
                        value={form.productName}
                        onChange={handleChange}
                        placeholder="Enter product name"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Stock Keeping Unit (SKU) *</label>
                    <input
                        name="stock_keeping_unit"
                        value={form.stock_keeping_unit}
                        onChange={handleChange}
                        placeholder="Enter SKU"
                        required
                    />
                    <small style={{ color: "#666", fontSize: "12px" }}>
                        You can update the SKU, but it must be unique
                    </small>
                </div>
                
                <div className="form-group">
                    <label>Quantity</label>
                    <input
                        type="number"
                        name="quantity"
                        value={form.quantity}
                        onChange={handleChange}
                        placeholder="Enter quantity"
                        min="0"
                        style={{
                            width: "100%",
                            padding: "8px",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            fontSize: "14px"
                        }}
                    />
                    <small style={{ color: "#666", fontSize: "12px", display: "block", marginTop: "4px" }}>
                        Enter the quantity available for this schedule
                    </small>
                </div>

                <div className="form-group">
                    <label>Price</label>
                    <input
                        type="number"
                        name="price"
                        value={form.price}
                        onChange={handleChange}
                        placeholder="Enter price"
                        min="0"
                        step="0.01"
                    />
                </div>

                <div className="form-group">
                    <label>Description</label>
                    <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        placeholder="Enter product description"
                        rows="4"
                    />
                </div>

                <div className="form-group">
                    <label>Start Date</label>
                    <input
                        type="date"
                        name="start_date"
                        value={form.start_date}
                        onChange={handleChange}
                        style={{
                            width: "100%",
                            padding: "8px",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            fontSize: "14px"
                        }}
                    />
                    <small style={{ color: "#666", fontSize: "12px", display: "block", marginTop: "4px" }}>
                        Select the start date for the product
                    </small>
                </div>

                <div className="form-group">
                    <label>End Date</label>
                    <input
                        type="date"
                        name="end_date"
                        value={form.end_date}
                        onChange={handleChange}
                        min={form.start_date || undefined}
                        style={{
                            width: "100%",
                            padding: "8px",
                            border: "1px solid #ddd",
                            borderRadius: "4px",
                            fontSize: "14px"
                        }}
                    />
                    <small style={{ color: "#666", fontSize: "12px", display: "block", marginTop: "4px" }}>
                        Select the end date for the product (must be after start date)
                    </small>
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                    <button
                        type="submit"
                        className="submit-button"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Updating..." : "Save Update"}
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate("/admin/update")}
                        style={{
                            padding: "10px 20px",
                            backgroundColor: "#6c757d",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer"
                        }}
                    >
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    );
};