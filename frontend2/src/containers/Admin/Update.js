import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminProducts, deleteProduct } from "../../services/adminService";
import "../../assets/styles/AdminUpdate.scss";

export const Update = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [deletingSku, setDeletingSku] = useState(null); // Track which product is being deleted
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const fetchProducts = async () => {
        setLoading(true);
        setError("");
        try {
            const response = await getAdminProducts();
            const list = response?.data;
            if (Array.isArray(list)) {
                setProducts(list);
            } else if (list) {
                setProducts([list]);
            } else {
                setProducts([]);
            }
        } catch (err) {
            const message = err.response?.data?.errMessage || err.message || "Failed to load products";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleUpdate = (product) => {
        navigate("/admin/update-detail", {
            state: { product }
        })
    }

    const handleDelete = async (product) => {
        const sku = product.stock_keeping_unit;
        const productName = product.name || product.product?.name || sku;
        
        if (!window.confirm(`Are you sure you want to delete product "${productName}" (SKU: ${sku})? This action cannot be undone.`)) {
            return;
        }

        setDeletingSku(sku);
        setError("");
        setSuccess("");
        
        try {
            const response = await deleteProduct(sku);
            console.log("Delete successful:", response);
            setSuccess(`Product "${productName}" deleted successfully!`);
            
            // Refresh the product list
            await fetchProducts();
            
            // Clear success message after 3 seconds
            setTimeout(() => {
                setSuccess("");
            }, 3000);
        } catch (error) {
            console.error("Delete failed:", error);
            const errorMessage = error.response?.data?.errMessage || error.message || "Failed to delete product";
            setError(errorMessage);
        } finally {
            setDeletingSku(null);
        }
    };

    return (
        <div className="admin-update-page">
            <div className="admin-update-header">
                <h2>Existing Products</h2>
                <div className="admin-update-actions">
                <button
                    onClick={() => navigate("/admin/update-product")}
                    className="admin-update-btn primary"
                >
                    Create new product
                </button>
                </div>
            </div>
            {loading && <p>Loading products...</p>}
            {error && (
                <div className="admin-update-alert error">
                    {error}
                </div>
            )}
            {success && (
                <div className="admin-update-alert success">
                    {success}
                </div>
            )}
            {!loading && !error && products.length === 0 && <p>No products found.</p>}
            {!loading && !error && products.length > 0 && (
                <div className="admin-update-tableWrap">
                    <table className="admin-update-table">
                        <thead>
                            <tr>
                                <th>SKU</th>
                                <th>Name</th>
                                <th>Price</th>
                                <th>Description</th>
                                <th className="admin-update-actionCell"></th>

                            </tr>
                        </thead>
                        <tbody>
                            {products.map((product) => (
                                <tr key={product.stock_keeping_unit}>
                                    <td>{product.stock_keeping_unit}</td>
                                    <td>{product.name || product.product?.name || "N/A"}</td>
                                    <td>{product.price ?? "-"}</td>
                                    {/* <td style={tableCellStyle}>{product.product?.category_id ?? "-"}</td> */}
                                    <td className="desc">{product.description || "-"}</td>
                                    {/* <td style={tableCellStyle}>{product.id ?? "-"}</td> */}
                                    <td className="admin-update-actionCell">
                                        <div className="admin-update-actionRow">
                                            <button
                                                onClick={() => handleUpdate(product)}
                                                className="admin-update-btn ghost"
                                                disabled={deletingSku === product.stock_keeping_unit}
                                            >
                                                Update
                                            </button>
                                            <button
                                                onClick={() => handleDelete(product)}
                                                className="admin-update-btn danger"
                                                disabled={deletingSku === product.stock_keeping_unit}
                                            >
                                                {deletingSku === product.stock_keeping_unit ? "Deleting..." : "Delete"}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

        </div>
    );
};