import adminService from "../services/adminService";
import db from '../models/index.js';

let handleDataChart = async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        let chartData;
        
        if (fromDate && toDate) {
            chartData = await adminService.handleDataChart(fromDate, toDate);
        } else {
            chartData = await adminService.handleDataChart();
        }
        
        return res.status(200).json({
            errCode: 0,
            errMessage: 'OK',
            data: chartData
        });
    } catch (error) {
        console.error('Error in handleDataChart:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: `Failed to retrieve chart data: ${error.message}`
        });
    }
};

let getHandleCreate = async (req, res) => {
    try {
        const { 
            productName, 
            stock_keeping_unit, 
            price, 
            description,
            category,
            country
        } = req.body;

        if (!productName || productName.trim() === "") {
            return res.status(400).json({
                errCode: 1,
                errMessage: 'Product name is required'
            });
        }

        if (!stock_keeping_unit) {
            return res.status(400).json({
                errCode: 2,
                errMessage: 'Stock keeping unit (SKU) is required'
            });
        }

        // Check if SKU already exists
        const existingProductItem = await db.ProductItem.findOne({
            where: { stock_keeping_unit: stock_keeping_unit }
        });

        if (existingProductItem) {
            return res.status(400).json({
                errCode: 3,
                errMessage: `Product item with SKU ${stock_keeping_unit} already exists`
            });
        }

        // Helper function to get category_id from product_category table
        const getCategoryId = async (categoryInput) => {
            if (!categoryInput || categoryInput === '') return 1; // Default to 1 if not provided
            
            // Try to parse as integer (ID from dropdown)
            const categoryId = parseInt(categoryInput);
            if (!isNaN(categoryId) && categoryId > 0) {
                // Verify the category exists in product_category table
                const cat = await db.ProductCategory.findByPk(categoryId);
                if (cat) {
                    return categoryId; // Return the ID directly
                }
                throw new Error(`Category with ID ${categoryId} not found in product_category table`);
            }
            
            // If not a valid ID, try to find by name (backward compatibility)
            const cat = await db.ProductCategory.findOne({
                where: { category_name: categoryInput }
            });
            if (cat) {
                return cat.id;
            }
            throw new Error(`Category "${categoryInput}" not found in product_category table`);
        };

        // Helper function to get country_id from product_country table
        const getCountryId = async (countryInput) => {
            if (!countryInput || countryInput === '') return null; // No default for country
            
            // Try to parse as integer (ID from dropdown)
            const countryId = parseInt(countryInput);
            if (!isNaN(countryId) && countryId > 0) {
                // Verify the country exists in product_country table
                const cty = await db.ProductCountry.findByPk(countryId);
                if (cty) {
                    return countryId; // Return the ID directly
                }
                throw new Error(`Country with ID ${countryId} not found in product_country table`);
            }
            
            // If not a valid ID, try to find by name (backward compatibility)
            const cty = await db.ProductCountry.findOne({
                where: { country_name: countryInput }
            });
            if (cty) {
                return cty.id;
            }
            throw new Error(`Country "${countryInput}" not found in product_country table`);
        };

        // Get category_id and country_id from product_category and product_country tables
        const categoryId = await getCategoryId(category);
        const countryId = await getCountryId(country);

        // Create Product with category_id and country_id from respective tables
        const product = await db.Product.create({
            name: productName.trim(),
            category_id: categoryId, // ID from product_category table
            country_id: countryId     // ID from product_country table
        });

        const productItem = await db.ProductItem.create({
            stock_keeping_unit: stock_keeping_unit,
            price: price ? parseFloat(price) : 0,
            description: description || "",
            product_id: product.id
            // Note: ProductItem model doesn't have a 'name' field, so we don't set it here
        });

        return res.status(201).json({
            errCode: 0,
            errMessage: 'Product created successfully',
            data: {
                product: {
                    id: product.id,
                    name: product.name,
                    category_id: product.category_id, // ID from product_category table
                    country_id: product.country_id     // ID from product_country table
                },
                productItem: {
                    stock_keeping_unit: productItem.stock_keeping_unit,
                    price: productItem.price,
                    description: productItem.description,
                    product_id: productItem.product_id
                }
            }
        });

    } catch (error) {
        console.error('Error in getHandleCreate:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: `Failed to create product: ${error.message}`
        });
    }
}

let getHandleUpdate = async (req, res) => {
    try {
        const { 
            productName, 
            stock_keeping_unit, 
            price, 
            description,
            country,
            category
        } = req.body;

        // Validate required fields
        if (!stock_keeping_unit) {
            return res.status(400).json({
                errCode: 1,
                errMessage: 'Stock keeping unit (SKU) is required'
            });
        }

        // Call the service function with all parameters
        const data = await adminService.handleUpdateData({
            productName,
            stock_keeping_unit,
            price,
            description,
            country,
            category
        });

        return res.status(200).json({
            errCode: 0,
            errMessage: `Product ${data.action} successfully`,
            data: {
                productItem: {
                    stock_keeping_unit: data.productItem.stock_keeping_unit,
                    price: data.productItem.price,
                    description: data.productItem.description,
                    product_id: data.productItem.product_id
                },
                product: data.product ? {
                    id: data.product.id,
                    name: data.product.name,
                    category_id: data.product.category_id,
                    country_id: data.product.country_id
                } : null
            }
        });

    } catch (error) {
        console.error('Error in getHandleUpdate:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: `Failed to update product: ${error.message}`
        });
    }
}

let getProducts= async (req, res) =>{
    try {
        const { stock_keeping_unit } = req.query;
        const data = await adminService.getProducts(
            stock_keeping_unit ? { stock_keeping_unit } : {}
        );


        if (stock_keeping_unit && (!data || data.length === 0)) {
            return res.status(404).json({
                errCode: 1,
                errMessage: `Product with SKU ${stock_keeping_unit} not found`
            });
        }

        return res.status(200).json({
            errCode: 0,
            errMessage: 'OK',
            data: stock_keeping_unit ? data[0] : data
        });
    } catch (error) {
        console.error('Error in getProducts:',error);
        return res.status(500).json({
            errCode:-1,
            errMessage: `Failed to get product: ${error.message}`
        })
    }
}

let getTimeTravel = async (req, res) => {
    try {
      const { stock_keeping_unit } = req.query;
  
      const data = await adminService.getTimeTravel(
        stock_keeping_unit ? { stock_keeping_unit } : {}
      );
  
      if (stock_keeping_unit && data.length === 0) {
        return res.status(404).json({
          errCode: 1,
          errMessage: `Product with SKU ${stock_keeping_unit} not found`,
        });
      }
  
      return res.status(200).json({
        errCode: 0,
        errMessage: "OK",
        data, // always array
      });
    } catch (error) {
      console.error("Error in getTimeTravel:", error);
      return res.status(500).json({
        errCode: -1,
        errMessage: `Failed to get product: ${error.message}`,
      });
    }
  };

// Get travel dates by product_id (for booking form)
let getTravelDatesByProductId = async (req, res) => {
    try {
        const { productId } = req.query;
        
        if (!productId) {
            return res.status(400).json({
                errCode: 1,
                errMessage: "productId is required"
            });
        }
        
        const data = await adminService.getTravelDatesByProductId(parseInt(productId));
        
        return res.status(200).json({
            errCode: 0,
            errMessage: "OK",
            data: data || []
        });
    } catch (error) {
        console.error("Error in getTravelDatesByProductId:", error);
        return res.status(500).json({
            errCode: -1,
            errMessage: `Failed to get travel dates: ${error.message}`
        });
    }
};

// Get all categories
let getCategories = async (req, res) => {
    try {
        const categories = await db.ProductCategory.findAll({
            attributes: ['id', 'category_name'],
            order: [['category_name', 'ASC']]
        });

        return res.status(200).json({
            errCode: 0,
            errMessage: 'OK',
            data: categories
        });
    } catch (error) {
        console.error('Error in getCategories:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: `Failed to get categories: ${error.message}`
        });
    }
};

// Get all countries
let getCountries = async (req, res) => {
    try {
        const countries = await db.ProductCountry.findAll({
            attributes: ['id', 'country_name'],
            order: [['country_name', 'ASC']]
        });

        return res.status(200).json({
            errCode: 0,
            errMessage: 'OK',
            data: countries
        });
    } catch (error) {
        console.error('Error in getCountries:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: `Failed to get countries: ${error.message}`
        });
    }
};

// Delete product
let deleteProduct = async (req, res) => {
    try {
        const { stock_keeping_unit } = req.body;

        if (!stock_keeping_unit) {
            return res.status(400).json({
                errCode: 1,
                errMessage: 'Stock keeping unit (SKU) is required'
            });
        }

        // Find the product item by SKU
        const productItem = await db.ProductItem.findOne({
            where: { stock_keeping_unit }
        });

        if (!productItem) {
            return res.status(404).json({
                errCode: 2,
                errMessage: `Product item with SKU ${stock_keeping_unit} not found`
            });
        }

        const productId = productItem.product_id;

        // Delete the product item first (due to foreign key constraints)
        await productItem.destroy();

        // Check if there are other product items for this product
        const remainingItems = await db.ProductItem.count({
            where: { product_id: productId }
        });

        // If no other items exist, delete the product
        if (remainingItems === 0) {
            const product = await db.Product.findByPk(productId);
            if (product) {
                await product.destroy();
            }
        }

        return res.status(200).json({
            errCode: 0,
            errMessage: 'Product deleted successfully',
            data: {
                stock_keeping_unit: stock_keeping_unit
            }
        });

    } catch (error) {
        console.error('Error in deleteProduct:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: `Failed to delete product: ${error.message}`
        });
    }
};
    
// Update product_time (time travel)
let getHandleUpdateTimeTravel = async (req, res) => {
    try {
        const { stock_keeping_unit, start_date, end_date, productName } = req.body;

        if (!stock_keeping_unit) {
            return res.status(400).json({
                errCode: 1,
                errMessage: "SKU is required"
            });
        }

        if (!start_date || !end_date) {
            return res.status(400).json({
                errCode: 2,
                errMessage: "Start date and end date are required"
            });
        }

        // If productName is provided, update the product name
        if (productName) {
            try {
                const productItem = await db.ProductItem.findOne({
                    where: { stock_keeping_unit },
                    include: [{ model: db.Product }]
                });

                if (productItem && productItem.Product) {
                    await productItem.Product.update({
                        name: productName
                    });
                    console.log('Product name updated:', productName);
                } else if (productItem && productItem.product_id) {
                    // If Product is not included, update directly
                    const product = await db.Product.findByPk(productItem.product_id);
                    if (product) {
                        await product.update({ name: productName });
                        console.log('Product name updated:', productName);
                    }
                }
            } catch (nameError) {
                console.error('Error updating product name:', nameError);
                // Continue even if name update fails
            }
        }

        const data = await adminService.handleUpdateTimeTravel({
            stock_keeping_unit,
            start_date,
            end_date,
            quantity: req.body.quantity,
            price: req.body.price,
            description: req.body.description
        });

        return res.status(200).json({
            errCode: 0,
            errMessage: "Time travel updated successfully",
            data
        });

    } catch (error) {
        console.error("Error in getHandleUpdateTimeTravel:", error);
        return res.status(500).json({
            errCode: -1,
            errMessage: `Failed: ${error.message}`
        });
    }
};





let getPriceOptimizationSuggestions = async (req, res) => {
    try {
        const response = await adminService.getPriceOptimizationSuggestions(req, res);
        return response;
    } catch (error) {
        console.error('Error in getPriceOptimizationSuggestions controller:', error);
        return res.status(500).json({
            errCode: -1,
            message: `Failed to get price optimization suggestions: ${error.message}`
        });
    }
};

export default {
    handleDataChart,
    getHandleCreate,
    getHandleUpdate,
    getProducts,
    getTimeTravel,
    getTravelDatesByProductId,
    getHandleUpdateTimeTravel,
    getCategories,
    getCountries,
    deleteProduct,
    getPriceOptimizationSuggestions
}; 
export { handleDataChart, getHandleUpdate, getHandleUpdateTimeTravel, getTimeTravel, getTravelDatesByProductId, getCategories, getCountries, deleteProduct }; 