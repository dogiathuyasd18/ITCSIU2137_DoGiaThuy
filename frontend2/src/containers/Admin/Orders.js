import { useState, useEffect } from "react";
import axios from "axios";

export default function Orders() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all products when page loads
  useEffect(() => {
    fetchAllProducts();
  }, []);

  const fetchAllProducts = async () => {
    try {
      const token = localStorage.getItem("access_token");

      const res = await axios.get("http://localhost:8080/api/admin/order", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      // backend returns: { errCode, errMessage, data: [...] }
      setProducts(res.data.data);
    } catch (err) {
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Product Schedule List</h2>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table
          border="1"
          cellPadding="10"
          style={{ borderCollapse: "collapse", width: "100%" }}
        >
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              <th>SKU</th>
              <th>Name</th>
              <th>Start Date</th>
              <th>End Date</th>
            </tr>
          </thead>

          <tbody>
            {products.length > 0 ? (
              products.map((item, index) => (
                <tr key={index}>
                  <td>{item.sku || 'N/A'}</td>
                  <td>{item.name || 'N/A'}</td>
                  <td>
                    {item.start_date 
                      ? new Date(item.start_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'N/A'}
                  </td>
                  <td>
                    {item.end_date 
                      ? new Date(item.end_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })
                      : 'N/A'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" style={{ textAlign: "center" }}>
                  No product schedules found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
