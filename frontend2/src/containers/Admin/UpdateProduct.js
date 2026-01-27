import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getHandleCreate, getCategories, getCountries } from "../../services/adminService";
import "../../assets/styles/UpdateProduct.scss";

export const UpdateProduct = () => {
    const navigate = useNavigate();
    const [formProduct, setFormProduct] = useState({
        productName: "",
        stock_keeping_unit: "",
        price: "",
        description: "",
        country: "",
        category: "",
    });
    const [categories, setCategories] = useState([]);
    const [countries, setCountries] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const fetchDropdownData = async () => {
            try {
                const [categoriesRes, countriesRes] = await Promise.all([
                    getCategories(),
                    getCountries()
                ]);
                setCategories(categoriesRes?.data || []);
                setCountries(countriesRes?.data || []);
            } catch (error) {
                console.error("Error fetching categories/countries:", error);
            }
        };
        fetchDropdownData();
    }, []);

    const handleOnChange = (event) => {
        const { name, value, type } = event.target;
        let processedValue = value;
        if (type === "number") {
            processedValue = value === "" ? "" : parseFloat(value);
        } else if (event.target.tagName === "SELECT") {
            processedValue = value;
        }

        setFormProduct((prevProduct) => ({
            ...prevProduct,
            [name]: processedValue,
        }));
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        setIsSubmitting(true);
        try {
            await getHandleCreate(formProduct);
            setFormProduct({
                productName: "",
                stock_keeping_unit: "",
                price: "",
                description: "",
                country: "",
                category: "",
            });
            alert("Product created successfully!");
            navigate("/admin/update");
        } catch (error) {
            console.error("Error creating product:", error);
            const errorMessage = error.response?.data?.errMessage || error.message || "Failed to create product";
            alert(`Error: ${errorMessage}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="update-product-page">
            <div className="update-product-header">
                <h2>Create / Update Product</h2>
                <div className="update-product-actions">
                    <button
                        className="up-btn secondary"
                        onClick={() => navigate("/admin/update")}
                        type="button"
                    >
                        ← Back
                    </button>
                </div>
            </div>

            <div className="update-product-card">
                <h3 className="update-product-card__title">Create Product</h3>

                <form onSubmit={handleCreate} className="update-product-form">
                    <div className="up-field">
                        <label>Name</label>
                        <input
                            type="text"
                            name="productName"
                            value={formProduct.productName}
                            onChange={handleOnChange}
                            required
                            placeholder="e.g. Giza Pyramids & Sphinx Tour"
                        />
                    </div>

                    <div className="up-field">
                        <label>Stock Keeping Unit</label>
                        <input
                            type="text"
                            name="stock_keeping_unit"
                            value={formProduct.stock_keeping_unit}
                            onChange={handleOnChange}
                            required
                            placeholder="e.g. SKU-001"
                        />
                    </div>

                    <div className="up-field">
                        <label>Price</label>
                        <input
                            type="number"
                            name="price"
                            value={formProduct.price}
                            onChange={handleOnChange}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                        />
                    </div>

                    <div className="up-field">
                        <label>Category</label>
                        <select
                            name="category"
                            value={formProduct.category || ""}
                            onChange={handleOnChange}
                        >
                            <option value="">Select a category</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.category_name}
                                </option>
                            ))}
                        </select>
                        <small>Saved to `category_id` in `product` table</small>
                    </div>

                    <div className="up-field">
                        <label>Country</label>
                        <select
                            name="country"
                            value={formProduct.country || ""}
                            onChange={handleOnChange}
                        >
                            <option value="">Select a country</option>
                            {countries.map((country) => (
                                <option key={country.id} value={country.id}>
                                    {country.country_name}
                                </option>
                            ))}
                        </select>
                        <small>Saved to `country_id` in `product` table</small>
                    </div>

                    <div className="up-field full">
                        <label>Description</label>
                        <textarea
                            name="description"
                            value={formProduct.description}
                            onChange={handleOnChange}
                            placeholder="Short description of the tour..."
                        />
                    </div>

                    <div className="update-product-footer">
                        <button type="submit" className="up-submit" disabled={isSubmitting}>
                            {isSubmitting ? "Submitting..." : "Submit"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


